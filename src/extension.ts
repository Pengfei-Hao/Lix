
import * as vscode from 'vscode';

import * as path from 'path';
import { workspace } from 'vscode';

import { TextEncoder } from 'util';
import { Parser } from './parser/parser';
import { Generator } from './generator/generator';
import { LatexGenerator } from './generator/latex-generator';
import { Config } from './foundation/config';
import { LixCompletionProvider } from './extension/completionProvider';
import { LixContext } from './extension/lixContext';
import { LabelProvider, MathLabelProvider } from './extension/treeDataProvider';
import { LatexProvider } from './extension/documentProvider';
import { LixSemanticProvider } from './extension/semanticProvider';
import { updateDiagnostic } from './extension/diagnosticProvider';
import { ResultState } from './foundation/result';
import { Heap } from './foundation/heap';
import { Ref } from './foundation/ref';
import { DocumentFilter, DocumentSelector } from 'vscode-languageclient';
import { Node } from './sytnax-tree/node';


let config: Config;
let lixContext: LixContext;

let documentProvider = new LatexProvider();
export let diagnosticCollection: vscode.DiagnosticCollection;

let docSel: DocumentSelector = [{ scheme: "file", language: "lix" }];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Register the Commands

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.generate', generate)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.helloWorld', helloWorld)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.parse', parse)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.compile', compile)
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

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider("lix", documentProvider)
	);

	// load configs

	config = new Config(context.extensionUri);
	let success = await config.readAll();
	console.log(`Configs loading success: ${success}`);

	// lix contexts

	lixContext = new LixContext(config);

	// diagnostic

	diagnosticCollection = vscode.languages.createDiagnosticCollection("lix");
	context.subscriptions.push(diagnosticCollection);

	// completion provider

	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(docSel, new LixCompletionProvider(lixContext), "[", " ")
	);

	// semantic token provider

	let tokenTypes = ['keyword', 'operator', 'string', 'function', 'variable', 'comment', 'class', 'type'];
	let tokenModifiers = ['declaration', 'documentation'];
	let legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

	vscode.languages.registerDocumentSemanticTokensProvider(docSel, new LixSemanticProvider(lixContext, legend), legend);
	

	// tree data provider

	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("lix-label-list", new LabelProvider(lixContext))
	);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("lix-math-list", new MathLabelProvider(lixContext))
	);

	// events

	// context.subscriptions.push(
	// 	vscode.workspace.onDidOpenTextDocument(onOpen)
	// );

	// context.subscriptions.push(
	// 	vscode.workspace.onDidChangeTextDocument(onChange)
	// );

	// context.subscriptions.push(
	// 	vscode.workspace.onDidCloseTextDocument(onClose)
	// );

	// context.subscriptions.push(
	// 	vscode.window.onDidChangeActiveTextEditor(onWinChange)
	// )

	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorSelection(onSelectionChange)
	);

	// Successfully init

	console.log('Congratulations, your extension "lix" is now active!');
}

// This method is called when your extension is deactivated
export async function deactivate(): Promise<void> {
	
	// if (!client) {
	// 	return;
	// }
	// await client.stop();
}

// **************** events ****************

async function onSelectionChange(change: vscode.TextEditorSelectionChangeEvent) {
	let doc = getDocument(change.textEditor.document);
	if(!doc) {
		return;
	}
	
	let parser = lixContext.getParser(doc);
	let pos = change.selections[0].start;
	let index = parser.getIndex(pos.line, pos.character)!;
	let line = locate(index, parser.syntaxTree)-1;
	console.log(`index:${index};line:${pos.line},char:${pos.character}`);

	let uri = getUri(doc, "parse");
	vscode.workspace.openTextDocument(uri).then(doc => {
		let opt: vscode.TextDocumentShowOptions = {viewColumn : vscode.ViewColumn.Beside, preview : true, preserveFocus : true, selection : new vscode.Range(line,0,line,0)};
		vscode.window.showTextDocument(doc, opt);
		
	});

}

function locate(pos: number, node: Node, skip = false): number {
	let line = 1;

	for (let i = 0; i < node.children.length; i++) {
		if (!skip) {
			if(node.children[i].begin <= pos && pos < node.children[i].end) {
				line += locate(pos, node.children[i], false);
				return line;
			}
			else if(node.children[i].end <= pos) {
				line += locate(pos, node.children[i], true);
			}
			else {
				return line;
			}
		}
		else {
			line += locate(pos, node.children[i], true);
		}
	}
	return line;

}

// async function onOpen(document: vscode.TextDocument) {
// 	return;
// 	console.log(`Document '${document.fileName}' opened.`);
// 	//lixContext.parse(document);
// }

// async function onWinChange(editor: vscode.TextEditor | undefined) {
// 	/*
// 	let document = editor?.document;
// 	if(!document) {
// 		return;
// 	}
// 	console.log(`Document editor '${document.fileName}' changed.`);
// 	*/
// }

// async function onChange(document: vscode.TextDocumentChangeEvent) {
// 	//console.log(`Document '${document.document.fileName}' changed.`);
// 	//return;
// 	// if(document.document.languageId !== "lix") {
// 	// 	return;
// 	// }
// 	// parseFile();
// }

// async function onClose(document: vscode.TextDocument) {
// 	//console.log(`Document '${document.fileName}' closed.`);
// }

// **************** commands ****************

async function compile() {
	let document = getDocument();
	if(!document) {
		return;
	}

	let parser = parseDocument(document);
	let generator = new LatexGenerator(parser.typeTable, config);
	let latex = generator.generate(parser.syntaxTree);

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
	let document = getDocument();
	if(!document) {
		return;
	}

	let parser = parseDocument(document);
	let generator = new LatexGenerator(parser.typeTable, config);
	let latex = generator.generate(parser.syntaxTree);

	documentProvider.updateContent(getUri(document, "generate"), latex);

	showFile(getUri(document, "generate"));
}

async function parse() {
	let document = getDocument();
	if(!document) {
		return;
	}
	parseDocument(document);
	showFile(getUri(document, "parse"));
}

function helloWorld() {
	//test1();
	console.log("hello world!");
	let h = new Heap<number>();
	h.push(1);
	h.push(2);
	h.push(3);
	h.pop();
	h.pop();
	let y = h.top();

	let i = new Ref<number>(0);
	i.value = 10086;
	let j = i;
	j.value =123;
	console.log(i.value);
}

// **************** assistance ****************


export function parseDocument(document: vscode.TextDocument): Parser {

	let parser = lixContext.getParser(document);
	parser.parse(document.getText());
	console.log(`Document '${document.fileName}' parsered.`);

	updateDiagnostic(document, lixContext);

	let st = "";
	switch(parser.state) {
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
	documentProvider.updateContent(getUri(document, "parse"), parser.syntaxTree.toString() + `\n[[State: ${st}]]`);

	return parser;
}

function showFile(uri: vscode.Uri) {
	vscode.workspace.openTextDocument(uri).then(doc => {
		let opt: vscode.TextDocumentShowOptions = {viewColumn : vscode.ViewColumn.Beside, preview : true, preserveFocus : true, selection : undefined};
		vscode.window.showTextDocument(doc,opt);
		
	});

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

function getUri(document: vscode.TextDocument, flag: string): vscode.Uri {
	let duri = document.uri;
	return vscode.Uri.from({ scheme: "lix", path: duri.path, fragment: flag });
}

function getDocument(document: vscode.TextDocument | undefined = vscode.window.activeTextEditor?.document): vscode.TextDocument | undefined {
	if(!document) {
		return;
	}
	if(vscode.languages.match(docSel, document) == 10) {
		return document;
	}
}