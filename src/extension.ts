/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Pengfei Hao. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { workspace } from 'vscode';

import { Parser } from './parser/parser';
import { Generator } from './generator/generator';
import { VSCodeConfig } from './extension/vscode-config';
import { LixCompletionProvider } from './extension/completion-provider';
import { LixContext } from './extension/lix-context';
import { blockProvider, formulaProvider } from './extension/tree-data-provider';
import { LatexProvider } from './extension/document-provider';
import { LixSemanticProvider } from './extension/semantic-provider';
import { updateDiagnostic } from './extension/diagnostic-provider';
import { ResultState } from './foundation/result';
import { DocumentSelector } from 'vscode-languageclient';
import { Node } from './sytnax-tree/node';


let config: VSCodeConfig;
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
		vscode.commands.registerCommand('lix.debug', debug)
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

	config = new VSCodeConfig(context.extensionUri);
	let success = await config.readAll();
	//console.log(`Configs loading success: ${success}`);

	// lix contexts

	lixContext = new LixContext(config);

	// diagnostic

	diagnosticCollection = vscode.languages.createDiagnosticCollection("lix");
	context.subscriptions.push(diagnosticCollection);

	// completion provider

	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(docSel, new LixCompletionProvider(lixContext), "[", "`", "(", "@", ",")
	);

	// semantic token provider

	let tokenTypes = ['keyword', 'operator', 'string', 'function', 'variable', 'comment', 'class', 'type'];
	let tokenModifiers = ['declaration', 'documentation'];
	let legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

	vscode.languages.registerDocumentSemanticTokensProvider(docSel, new LixSemanticProvider(lixContext, legend), legend);
	

	// tree data provider

	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("lix-label-list", new blockProvider(lixContext))
	);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("lix-math-list", new formulaProvider(lixContext))
	);

	// events

	context.subscriptions.push(
		vscode.window.onDidCloseTerminal(onTerminalClosed)
	);

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

	console.log('Lix started successfully!');
	//vscode.window.showInformationMessage("Lix started successfully!");
}

// This method is called when your extension is deactivated
export async function deactivate(): Promise<void> {
	
	// if (!client) {
	// 	return;
	// }
	// await client.stop();
}

// **************** events ****************

let isDebugging = false;

async function onSelectionChange(change: vscode.TextEditorSelectionChangeEvent) {
	if(!isDebugging) {
		return;
	}

	let doc = change.textEditor.document;
	if(vscode.languages.match(docSel, doc) !== 10) {
		return;
	}
	
	let parser = lixContext.getCompiler(doc.uri).parser;
	let pos = change.selections[0].start;

	let index = parser.getIndex(pos.line, pos.character)!;
	let line = locate(index, parser.syntaxTree)-1+1;
	//console.log(`index:${index};line:${pos.line},char:${pos.character}`);
	vscode.window.showInformationMessage(`index: ${index}; line: ${pos.line}, character: ${pos.character}`);

	vscode.workspace.openTextDocument(getUri(doc.uri, "parse")).then(doc => {
		let opt: vscode.TextDocumentShowOptions = {viewColumn : vscode.ViewColumn.Beside, preview : false, preserveFocus : true, selection : new vscode.Range(line,0,line,0)};
		vscode.window.showTextDocument(doc, opt);
		
	});

	let lineA = locate(index, parser.analysedTree)-1+1;
	vscode.workspace.openTextDocument(getUri(doc.uri, "analyse")).then(doc => {
		let opt: vscode.TextDocumentShowOptions = {viewColumn : vscode.ViewColumn.Beside, preview : false, preserveFocus : true, selection : new vscode.Range(lineA,0,lineA,0)};
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

function onTerminalClosed(terminal: vscode.Terminal) {
	if(terminal === compileTerminal) {
		compileTerminal = undefined;
	}
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

let compileTerminal: vscode.Terminal | undefined;

async function compile() {
	let document = getDocument();
	if(!document) {
		return;
	}
	await vscode.workspace.saveAll();

	let compiler = lixContext.getCompiler(document.uri);
	await compiler.compile("latex");

	updateDiagnostic(document, lixContext);
	let st = "";
	switch(compiler.parser.state) {
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
	documentProvider.updateContent(getUri(document.uri, "parse"), compiler.parser.syntaxTree.toString() + `\n[[State: ${st}]]`);
	documentProvider.updateContent(getUri(document.uri, "generate"), compiler.curGenerator.output);


	let generator = await generateLatexFromDocument(document);
	let latex = generator.output;

	//let uri = vscode.window.activeTextEditor?.document.uri!;
	let uri = document.uri;
	let fileName = compiler.fileOperation.fileName;

	let dirUri = vscode.Uri.joinPath(uri, "../.lix/");
	let latexUri = vscode.Uri.joinPath(dirUri, fileName + ".tex");
	let pdfUri = vscode.Uri.joinPath(dirUri, fileName + ".pdf");
	let newPdfUri = vscode.Uri.joinPath(dirUri, "..", fileName + ".pdf");

	if(compileTerminal === undefined) {
		compileTerminal = vscode.window.createTerminal({name: "Lix Compiler", hideFromUser : true});
		//compileTerminal.hide();
	}


	compileTerminal.sendText(`cd "${dirUri.fsPath}"`);
	compileTerminal.sendText(`xelatex -synctex=1 -interaction=nonstopmode "${latexUri.fsPath}"`);
	compileTerminal.sendText(`xelatex -synctex=1 -interaction=nonstopmode "${latexUri.fsPath}"`);
	compileTerminal.sendText(`cp "${pdfUri.fsPath}" "${newPdfUri.fsPath}"`);
	//compileTerminal.sendText(`open "${newPdfUri.fsPath}"`);
	//workspace.openTextDocument(newPdfUri).then(doc => vscode.window.showTextDocument(doc));
	vscode.commands.executeCommand(
		'vscode.openWith',
		newPdfUri,
		'latex-workshop-pdf-hook', // use Latex Workshop
		vscode.ViewColumn.Beside
	)
}

async function generate() {
	let document = getDocument();
	if(!document) {
		return;
	}
	await generateLatexFromDocument(document);
	showFile(getUri(document.uri, "generate"));
}

async function parse() {
	let document = getDocument();
	if(!document) {
		return;
	}
	parseFromDocument(document);
	showFile(getUri(document.uri, "parse"));
	showFile(getUri(document.uri, "analyse"));
}

function test() {
	vscode.window.showInformationMessage("abcd");
}

function bu(f : ()=>void, thisArg?: unknown) {
	return f.bind(thisArg)
}
function helloWorld() {
	bu(test)();
}

async function debug() {
	isDebugging = !isDebugging;
	if(isDebugging) {
		compileTerminal?.show();
	}
	else {
		compileTerminal?.hide();
	}
}

// **************** assistance ****************

export async function generateLatexFromDocument(document: vscode.TextDocument): Promise<Generator> {
	let compiler = lixContext.getCompiler(document.uri);
	let generator = compiler.curGenerator; // latex
	await compiler.generateFromText(document.getText(), generator);

	documentProvider.updateContent(getUri(document.uri, "generate"), `[[Generating Result]]\n` + generator.output);
	return generator;
}

export function parseFromDocument(document: vscode.TextDocument): Parser {

	updateFileList(document);

	let compiler = lixContext.getCompiler(document.uri);
	compiler.parseFromText(document.getText());
	//console.log(`Document '${document.fileName}' parsered.`);
	let parser = compiler.parser;

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
	documentProvider.updateContent(getUri(document.uri, "parse"), `[[Parsing Result]]\n` + parser.syntaxTree.toString() + `\n[[State: ${st}]]`);
	documentProvider.updateContent(getUri(document.uri, "analyse"), `[[Analysing Result]]\n` + parser.analysedTree.toString());

	return parser;
}

async function updateFileList(document: vscode.TextDocument) {
	return;
	let compiler = lixContext.getCompiler(document.uri);
	let list = await compiler.fileOperation.getFilesInDirectory(".");
	let figlist: string[] = [];
	for (let item of list) {
		if(item.includes(".lix")) {
			continue;
		}
		let ext = compiler.fileOperation.getFileExtension(item);
		if (ext === "jpg" || ext === "png" || ext === "eps" || ext === "tikz") {
			figlist.push(item);
		}

	}
	lixContext.setFileList(document.uri, figlist);
}

function showFile(uri: vscode.Uri) {
	vscode.workspace.openTextDocument(uri).then(doc => {
		let opt: vscode.TextDocumentShowOptions = {viewColumn : vscode.ViewColumn.Beside, preview : true, preserveFocus : true, selection : undefined};
		vscode.window.showTextDocument(doc,opt);
		
	});
}

// function showPDF(file: string) {
// 	let html = `<!DOCTYPE html>
// 	<html lang="en">
// 	<head>
// 		<meta charset="UTF-8">
// 	</head>
// 	<body>
// 		<iframe src="/web/viewer.html?file=${file}" width="100%" height="100%"/>
// 	</body>
// 	</html>`;
// 	let panel = vscode.window.createWebviewPanel("lix-pdf-preview", "Lix PDF", vscode.ViewColumn.Two, {});
	
// 	panel.webview.html = html;
// }

function getUri(uri: vscode.Uri, flag: string): vscode.Uri {
	return vscode.Uri.from({ scheme: "lix", path: uri.path, fragment: flag });
}

function getDocument(document: vscode.TextDocument | undefined = vscode.window.activeTextEditor?.document): vscode.TextDocument | undefined {
	if(!document) {
		return;
	}
	if(vscode.languages.match(docSel, document) == 10) {
		return document;
	}
}