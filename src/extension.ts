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
import { LixCommandProvider, blockProvider, formulaProvider } from './extension/tree-data-provider';
import { LatexProvider } from './extension/document-provider';
import { LixSemanticProvider } from './extension/semantic-provider';
import { updateDiagnostic } from './extension/diagnostic-provider';
import { ResultState } from './parser/result';
import { DocumentSelector } from 'vscode-languageclient';
import { Node } from './sytnax-tree/node';
import { LixFoldingRangeProvider } from './extension/folding-range-provider';
import './foundation/format';
import { getVscodeText, VscodeText } from './foundation/i18n';


let config: VSCodeConfig;
let lixContext: LixContext;
let lang: VscodeText;
let lixCommandProvider: LixCommandProvider;

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
		vscode.commands.registerCommand('lix.selectCompileTarget', selectCompileTarget)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.debug', debug)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.test', async () => {
			let msg = "";
			if (workspace.name) {
				msg = msg.concat(workspace.name, ":");
			}
			else {
				msg = msg.concat("None:");
			}
			for (let doc of workspace.textDocuments) {
				msg = msg.concat(doc.fileName, ";");
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
	lang = getVscodeText(config.get("i18n"), config.settings.language);
	//console.log(`Configs loading success: ${success}`);

	// lix contexts

	lixContext = new LixContext(config, lang);

	// diagnostic

	diagnosticCollection = vscode.languages.createDiagnosticCollection("lix");
	context.subscriptions.push(diagnosticCollection);

	// completion provider

	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(docSel, new LixCompletionProvider(lixContext), "[", "`", "(", "@", ",")
	);

	// folding range provider

	context.subscriptions.push(
		vscode.languages.registerFoldingRangeProvider(docSel, new LixFoldingRangeProvider(lixContext))
	);

	// semantic token provider

	let tokenTypes = ['keyword', 'operator', 'string', 'function', 'variable', 'comment', 'class', 'type'];
	let tokenModifiers = ['declaration', 'documentation'];
	let legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

	// vscode.languages.registerDocumentSemanticTokensProvider(docSel, new LixSemanticProvider(lixContext, legend), legend);


	// tree data provider

	lixCommandProvider = new LixCommandProvider(() => generatorName);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("lix-command-list", lixCommandProvider)
	);
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

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(onChange)
	);

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
	if (!isDebugging) {
		return;
	}

	let doc = change.textEditor.document;
	if (vscode.languages.match(docSel, doc) !== 10) {
		return;
	}

	let parser = lixContext.getCompiler(doc.uri).parser;
	let pos = change.selections[0].start;

	let index = parser.getIndex(pos.line, pos.character)!;
	let line = locate(index, parser.syntaxTree) - 1 + 1;
	//console.log(`index:${index};line:${pos.line},char:${pos.character}`);
	vscode.window.showInformationMessage(`index: ${index}; line: ${pos.line}, character: ${pos.character}`);

	vscode.workspace.openTextDocument(getUri(doc.uri, "parse")).then(doc => {
		let opt: vscode.TextDocumentShowOptions = { viewColumn: vscode.ViewColumn.Beside, preview: false, preserveFocus: true, selection: new vscode.Range(line, 0, line, 0) };
		vscode.window.showTextDocument(doc, opt);

	});

	let lineA = locate(index, parser.analysedTree) - 1 + 1;
	vscode.workspace.openTextDocument(getUri(doc.uri, "analyse")).then(doc => {
		let opt: vscode.TextDocumentShowOptions = { viewColumn: vscode.ViewColumn.Beside, preview: false, preserveFocus: true, selection: new vscode.Range(lineA, 0, lineA, 0) };
		vscode.window.showTextDocument(doc, opt);

	});

}

function locate(pos: number, node: Node, skip = false): number {
	let line = 1;

	for (let i = 0; i < node.children.length; i++) {
		if (!skip) {
			if (node.children[i].begin <= pos && pos < node.children[i].end) {
				line += locate(pos, node.children[i], false);
				return line;
			}
			else if (node.children[i].end <= pos) {
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
	if (terminal === compileTerminal) {
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

async function onChange(event: vscode.TextDocumentChangeEvent) {
	//console.log(`Document '${document.document.fileName}' changed.`);
	//return;
	// if(document.document.languageId !== "lix") {
	// 	return;
	// }
	// parseFile();

	if (getDocument(event.document) === undefined) {
		return;
	}

	parseFromDocument(event.document, false);

}

// async function onClose(document: vscode.TextDocument) {
// 	//console.log(`Document '${document.fileName}' closed.`);
// }

// **************** commands ****************

let compileTerminal: vscode.Terminal | undefined;

let generatorName = "latex"; // "markdown", "latex", "blog"
const availableGeneratorTargets = ["markdown", "latex", "blog"];

async function selectCompileTarget(target?: string) {
	let nextTarget = target;
	if (!nextTarget || !availableGeneratorTargets.includes(nextTarget)) {
		const picked = await vscode.window.showQuickPick(availableGeneratorTargets, { placeHolder: "Select compile target" });
		if (!picked) {
			return;
		}
		nextTarget = picked;
	}

	generatorName = nextTarget;
	lixCommandProvider?.refresh();
	vscode.window.showInformationMessage(`Compile target set to ${nextTarget}`);
}

async function compile() {
	let document = getDocument();
	if (!document) {
		return;
	}
	await vscode.workspace.saveAll();

	let compiler = lixContext.getCompiler(document.uri);
	await compiler.compile(generatorName);

	updateDiagnostic(document, lixContext);
	let st = "";
	switch (compiler.parser.state) {
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

	let uri = document.uri;
	let fileName = compiler.fileOperation.fileName;
	let dirUri = vscode.Uri.joinPath(uri, "../.lix/");

	if (compileTerminal === undefined) {
		compileTerminal = vscode.window.createTerminal({ name: "Lix Compiler", hideFromUser: true });
		//compileTerminal.hide();
	}

	if (generatorName === "markdown" || generatorName === "blog") {
		let mdUri = vscode.Uri.joinPath(dirUri, fileName + ".md");
		let newMdUri = vscode.Uri.joinPath(dirUri, "..", fileName + ".md");

		compileTerminal.sendText(`cp "${mdUri.fsPath}" "${newMdUri.fsPath}"`);

		vscode.commands.executeCommand(
			'vscode.openWith',
			mdUri,
			"vscode.markdown.preview.editor", // use built-in markdown preview
			vscode.ViewColumn.Beside
		);
		return;
	}
	else if (generatorName === "latex") {
		let latexUri = vscode.Uri.joinPath(dirUri, fileName + ".tex");
		let pdfUri = vscode.Uri.joinPath(dirUri, fileName + ".pdf");
		let newPdfUri = vscode.Uri.joinPath(dirUri, "..", fileName + ".pdf");

		compileTerminal.sendText(`cd "${dirUri.fsPath}"`);
		compileTerminal.sendText(`xelatex -synctex=1 -interaction=nonstopmode "${latexUri.fsPath}"`);
		//compileTerminal.sendText(`xelatex -synctex=1 -interaction=nonstopmode "${latexUri.fsPath}"`);
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
}

async function generate() {
	let document = getDocument();
	if (!document) {
		return;
	}
	await generateFromDocument(document);
	showFile(getUri(document.uri, "generate"));
}

async function parse() {
	let document = getDocument();
	if (!document) {
		return;
	}
	parseFromDocument(document);
	// showFile(getUri(document.uri, "parse"));
	showFile(getUri(document.uri, "analyse"));
}

function test() {
	vscode.window.showInformationMessage("abcd");
}

function bu(f: () => void, thisArg?: unknown) {
	return f.bind(thisArg)
}
function helloWorld() {

	console.log("${0}$${0}".formatWithAutoBlank("a${0}").formatWithAutoBlank("b"));
	// => "test abc, 123"

	console.log("a${0}1".formatWithAutoBlank("b"));
	// => "a b1"

	console.log("a${0}c".formatWithAutoBlank("b"));
	// => "a b c"

	console.log("a${0}1".formatWithAutoBlank("1b"));
	// => "a1b1"
	//bu(test)();
	// ✅ 数字占位符
	console.log("${0}+${1}".format("${1} + 1", "2"));
	// => "${0} + 1+2"

	// ✅ 命名占位符
	console.log("Hello ${user}, you have ${count} messages".format({ user: "Alice", count: 5 }));
	// => "Hello Alice, you have 5 messages"

	// ✅ 数字 + 命名混合
	console.log("${0} loves ${food}".format("Bob", { food: "🍣" }));
	// => "Bob loves 🍣"

	// ✅ 缺失占位符 → 保留
	console.log("Missing: ${x}, ${0}".format("A"));
	// => "Missing: ${x}, A"

	// 你的特殊例子（关键：被插入的 "${1} + 1" 不会被再次替换）
	console.log("${0}+${1}".format("${1} + 1", "2"));
	// => "${0} + 1+2"

	// 命名参数
	console.log("${user} has ${count} items".format({ user: "Alice", count: 3 }));
	// => "Alice has 3 items"

	// 嵌套属性
	console.log("Name: ${user.name}, City: ${user.address.city}".format({
		user: { name: "Bob", address: { city: "NYC" } }
	}));
	// => "Name: Bob, City: NYC"

	// 转义：想保留字面 ${0}，写成 $${0}
	console.log("literal: $${0} and ${0}".format("X"));
	// => "literal: ${0} and X"

	// 参数不足（默认非 strict） => 保留原样
	console.log("Missing: ${0}, ${1}".format("A"));
	// => "Missing: A, ${1}"

}

async function debug() {
	isDebugging = !isDebugging;
	if (isDebugging) {
		compileTerminal?.show();
	}
	else {
		compileTerminal?.hide();
	}
}

// **************** assistance ****************

async function generateFromDocument(document: vscode.TextDocument): Promise<Generator> {
	let compiler = lixContext.getCompiler(document.uri);
	let generator = compiler.getGenerator(generatorName)!;
	await compiler.generateFromText(document.getText(), generatorName);

	documentProvider.updateContent(getUri(document.uri, "generate"), `[[Generating Result]]\n` + generator.output);
	return generator;
}

export function parseFromDocument(document: vscode.TextDocument, updateDocument = true): Parser {

	updateFileList(document);

	let compiler = lixContext.getCompiler(document.uri);
	compiler.parseFromText(document.getText());
	let parser = compiler.parser;

	updateDiagnostic(document, lixContext);

	let st = "";
	switch (parser.state) {
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
	if (updateDocument) {
		documentProvider.updateContent(getUri(document.uri, "parse"), `[[Parsing Result]]\n` + parser.syntaxTree.toString() + `\n[[State: ${st}]]`);
		documentProvider.updateContent(getUri(document.uri, "analyse"), `[[Analysing Result]]\n` + parser.analysedTree.toString());
	}

	return parser;
}

async function updateFileList(document: vscode.TextDocument) {
	return;
	let compiler = lixContext.getCompiler(document.uri);
	let list = await compiler.fileOperation.getFilesInDirectory(".");
	let figlist: string[] = [];
	for (let item of list) {
		if (item.includes(".lix")) {
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
		let opt: vscode.TextDocumentShowOptions = { viewColumn: vscode.ViewColumn.Beside, preview: true, preserveFocus: true, selection: undefined };
		vscode.window.showTextDocument(doc, opt);

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
	if (!document) {
		return;
	}
	if (vscode.languages.match(docSel, document) == 10) {
		return document;
	}
}
