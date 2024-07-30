// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';

import {
	DiagnosticSeverity,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

import { TextEncoder } from 'util';
import { Parser } from './parser/parser';
import { Generator } from './generator/generator';
import { LatexGenerator } from './generator/latex-generator';
import { Config } from './foundation/config';
import { LixCompletionProvider } from './extension/languageProvider';
import { Context } from './extension/context';
import { LabelProvider, MathLabelProvider } from './extension/viewProvider';
import { LatexProvider } from './extension/documentProvider';
import { MessageType } from './foundation/message';
import { ResultState } from './foundation/result';


// let client: LanguageClient;

let config: Config;

let lixContext: Context;

let documentProvider = new LatexProvider();

let diagnosticCollection: vscode.DiagnosticCollection;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Register the Commands

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.generate', async () => {
			generate();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.helloWorld', async () => {
			// The code you place here will be executed every time your command is executed
			// Display a message box to the user
			//vscode.window.showInformationMessage('Hello World from LiX!');
			helloWorld();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.parse', async () => {
			parse();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.compile', async () => {
			compile();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.test', async () => {
			let msg = "";
			if(workspace.name) {
				msg=msg.concat(workspace.name,":");
			}
			else {
				msg=msg.concat("None:");
			}
			for(let doc of workspace.textDocuments) {
				msg=msg.concat(doc.fileName, ";");
			}
			vscode.window.showInformationMessage(msg);

		})
	);


	// document provider

	//vscode.window.showInformationMessage(`extensionPath:${context.extensionPath};globalStorage:${context.globalStorageUri.fsPath};Storage:${context.storageUri?.path};logPath:${context.logUri.fsPath}`);

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider("lix", documentProvider)
	);

	// load configs

	config = new Config(context.extensionUri);
	let success = await config.readAll();
	console.log(`Configs loading success: ${success}`);
	//console.log(`math.json: ${config.get("math")}`);
	//config.set("label", '{"labels": ["paragraph", "title"]}');
	//await config.saveAll();

	lixContext = new Context(config);

	// diagnostic

	diagnosticCollection = vscode.languages.createDiagnosticCollection("lix");
	context.subscriptions.push(diagnosticCollection);

	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider({ scheme: "file", language: "lix" }, new LixCompletionProvider(lixContext), "[", " ")
	);

	// semantic token provider

	const tokenTypes = ['keyword', 'operator', 'label', 'function', 'variable'];
	const tokenModifiers = ['declaration', 'documentation'];
	const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
	
	const provider: vscode.DocumentSemanticTokensProvider = {
	  provideDocumentSemanticTokens(
		document: vscode.TextDocument
	  ): vscode.ProviderResult<vscode.SemanticTokens> {
		// analyze the document and return semantic tokens
	
		const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
		// on line 1, characters 1-5 are a class declaration

		let parser = lixContext.getParser(document);
		let highlights = parser.highlights;
		for(let hlt of highlights) {
			let type = "";
			switch (hlt.type) {
				case 0:
					type = "variable";
					break;
				case 1:
					type = "keyword";
					break;
				default:
					type = "label";
					break;
			}
			let lp = parser.getLineAndPosition(hlt.begin) ?? {line: -1, position: -1};
			let lpe = parser.getLineAndPosition(hlt.end) ?? {line: -1, position: -1};

			tokensBuilder.push(
				new vscode.Range(new vscode.Position(lp.line, lp.position), new vscode.Position(lpe.line, lpe.position)),
				type,
				[]
			  );
		}
	
		return tokensBuilder.build();
	  }
	};
	
	const selector = { language: 'lix', scheme: 'file' }; // register for all Java documents from the local file system
	
	vscode.languages.registerDocumentSemanticTokensProvider(selector, provider, legend);
	

	// tree data provider

	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("lix-label-list", new LabelProvider(lixContext))
	);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("lix-math-list", new MathLabelProvider(lixContext))
	);

	// events

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(onOpen)
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(onChange)
	);

	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument(onClose)
	);

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(onWinChange)
	)

	// Successfully init
	console.log('Congratulations, your extension "lix" is now active!');
}

async function onOpen(document: vscode.TextDocument) {
	return;
	console.log(`Document '${document.fileName}' opened.`);
	lixContext.parser(document);
}

async function onWinChange(editor: vscode.TextEditor | undefined) {
	/*
	let document = editor?.document;
	if(!document) {
		return;
	}
	console.log(`Document editor '${document.fileName}' changed.`);
	*/
}

async function onChange(document: vscode.TextDocumentChangeEvent) {
	//console.log(`Document '${document.document.fileName}' changed.`);
	//return;
	if(document.document.languageId !== "lix") {
		return;
	}
	parseFile();
}

async function onClose(document: vscode.TextDocument) {
	//console.log(`Document '${document.fileName}' closed.`);
}

async function compile() {
	let document = vscode.window.activeTextEditor?.document!;

	let parser = lixContext.getParser(document);
	parser.parse(document.getText());

	let generator = new LatexGenerator(parser.syntaxTree, parser.typeTable, config);
	let latex = generator.generate();

	let encoder = new TextEncoder();
	let uri = vscode.window.activeTextEditor?.document.uri!;


	let pat = uri.path;
	let tem = pat.split("/").at(-1);
	console.log(tem);
	uri = vscode.Uri.joinPath(uri, "../lix_temp");

	await vscode.workspace.fs.createDirectory(uri);
	let turi = uri;
	uri = vscode.Uri.joinPath(uri, tem + ".tex");
	await vscode.workspace.fs.writeFile(uri, encoder.encode(latex));
	//vscode.workspace.fs.writeFile(vscode.Uri.file('./temp.tex'), encoder.encode(latex));

	let terminal = vscode.window.createTerminal("Latex Compiler");
	terminal.sendText("cd " + vscode.Uri.joinPath(uri, "../").fsPath);
	terminal.sendText("xelatex -synctex=1 -interaction=nonstopmode \"" + uri.fsPath + "\"");
	turi = vscode.Uri.joinPath(turi, tem + ".pdf");
	//terminal.sendText("start msedge \"" + turi.fsPath + "\"");
	terminal.sendText(`open -a safari ${turi.fsPath}`);
	//showPDF(turi.fsPath);
}

async function generate() {
	let document = vscode.window.activeTextEditor?.document!;

	let parser = lixContext.getParser(document);
	parser.parse(document.getText());

	let generator = new LatexGenerator(parser.syntaxTree, parser.typeTable, config);
	var latex = generator.generate();

	showFile(latex);
}

async function parse() {
	parseFile();
	let document = vscode.window.activeTextEditor?.document!;
	let syntaxTree = lixContext.syntaxTrees.get(document)!;

	showFile(syntaxTree.toString() + `\n[[[success: ${lixContext.success.get(document)!}]]]`);
}

function parseFile() {
	let document = vscode.window.activeTextEditor?.document!;

	lixContext.parser(document);
	let messageList = lixContext.messageLists.get(document)!;
	let state = lixContext.state.get(document)!;;

	let diags: vscode.Diagnostic[] = [];
	for(let msg of messageList) {
		let diag = new vscode.Diagnostic(new vscode.Range(msg.line,msg.position,msg.line,msg.position+1), msg.toString());
		if(msg.type == MessageType.warning) {
			diag.severity = vscode.DiagnosticSeverity.Warning;
		}
		diags.push(diag);
	}
	let st = "";
	switch(state) {
		case ResultState.successful:
			st = "successful";
			break;
		case ResultState.skippable:
			st = "skippable";
			break;
		case ResultState.matched:
			st = "matched";
			break;
		case ResultState.failing:
			st = "failing";
			break;
	}

	let diag = new vscode.Diagnostic(new vscode.Range(0,0,0,1),"State: " + st, vscode.DiagnosticSeverity.Information);
	diags.push(diag);

	diagnosticCollection.set(document.uri, diags);
}

function showFile(file: string) {
	let uri = documentProvider.addContent(file);
	vscode.window.showTextDocument(uri);
}

function showPDF(file: string) {
	let html = `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
	</head>
	<body>
		<iframe src="/web/viewer.html?file=${file}" width="100%" height="100%"/>
	</body>
	</html>`;
	let panel = vscode.window.createWebviewPanel("lix-pdf-preview", "Lix PDF", vscode.ViewColumn.Two, {});
	
	panel.webview.html = html;
}

function helloWorld() {
	test1();
	console.log("first follow");
}

function test1(): Thenable<number> {

	return new Promise((resolve) => {
		sleep(1000).then(() => {
			console.log("1");
		console.log("2");
		console.log("3");
		console.log("4");
		console.log("5");
		console.log("6");
		resolve(7);
		})
	})
	
}

function sleep(time: number) {
	return new Promise((resolve, reject) => {
		setTimeout(resolve, time);
	})	
}

// This method is called when your extension is deactivated
export async function deactivate(): Promise<void> {
	
	// if (!client) {
	// 	return;
	// }
	// await client.stop();
}