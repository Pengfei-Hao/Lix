// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';

import {
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


// let client: LanguageClient;

let config: Config;

let lixContext: Context;

let documentProvider = new LatexProvider();

let diagnosticCollection: vscode.DiagnosticCollection;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Start the language cilent

	
	// let serverModule = context.asAbsolutePath(path.join('out', 'server.js'));

	// let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// let serverOptions: ServerOptions = {
	// 	run: { module: serverModule, transport: TransportKind.ipc },
	// 	debug: {
	// 		module: serverModule,
	// 		transport: TransportKind.ipc,
	// 		options: debugOptions
	// 	}
	// };

	// let clientOptions: LanguageClientOptions = {
	// 	// Register the server for plain text documents
	// 	documentSelector: [{ scheme: 'file', language: 'lix' }],
	// 	synchronize: {
	// 		// Notify the server about file changes to '.clientrc files contained in the workspace
	// 		fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
	// 	}
	// };

	// // Create the language client and start the client.
	// client = new LanguageClient(
	// 	'languageServerExample',
	// 	'Language Server Example',
	// 	serverOptions,
	// 	clientOptions
	// );

	// // Start the client. This will also launch the server
	// client.start();
	

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


	//vscode.window.showInformationMessage(`extensionPath:${context.extensionPath};globalStorage:${context.globalStorageUri.fsPath};Storage:${context.storageUri?.path};logPath:${context.logUri.fsPath}`);

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider("lix", documentProvider)
	);

	config = new Config(context.extensionUri);
	let success = await config.readAll();
	console.log(`Configs loading success: ${success}`);
	//console.log(`math.json: ${config.get("math")}`);
	//config.set("label", '{"labels": ["paragraph", "title"]}');
	//await config.saveAll();

	lixContext = new Context(config);

	// languages

	diagnosticCollection = vscode.languages.createDiagnosticCollection("lix");
	context.subscriptions.push(diagnosticCollection);

	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider({ scheme: "file", language: "lix" }, new LixCompletionProvider(lixContext), "[", " ")
	);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("lix-label-list", new LabelProvider(lixContext))
	);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("lix-math-list", new MathLabelProvider(lixContext))
	);

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
	//console.log(`Document '${document.fileName}' opened.`);
	//lixContext.parser(document);
}

async function onWinChange(editor: vscode.TextEditor | undefined) {
	let document = editor?.document;
	if(!document) {
		return;
	}
	console.log(`Document editor '${document.fileName}' changed.`);
}

async function onChange(document: vscode.TextDocumentChangeEvent) {
	//console.log(`Document '${document.document.fileName}' changed.`);
	if(document.document.languageId !== "lix") {
		return;
	}
	lixContext.parser(document.document);

	let msgs = lixContext.messageLists.get(document.document)!;
	let diags: vscode.Diagnostic[] = [];

	for(let msg of msgs) {
		let diag = new vscode.Diagnostic(new vscode.Range(msg.line-1,msg.position-1,msg.line-1,msg.position), msg.toString());
		if(msg.type == MessageType.warning) {
			diag.severity = vscode.DiagnosticSeverity.Warning;
		}
		diags.push(diag);
	}
	diagnosticCollection.set(document.document.uri, diags);
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
	let document = vscode.window.activeTextEditor?.document!;

	lixContext.parser(document);
	let messageList = lixContext.messageLists.get(document)!;
	let syntaxTree = lixContext.syntaxTrees.get(document)!;

	for(let msg of messageList) {
		console.log(msg.toString());
	}
	showFile(syntaxTree.toString());
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