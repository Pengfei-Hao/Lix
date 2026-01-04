/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Pengfei Hao. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { workspace } from 'vscode';
import * as path from 'path';

import { Parser } from './parser/parser';
import { Generator } from './generator/generator';
import { VSCodeConfig } from './extension/vscode-config';
import { LixCompletionProvider } from './extension/providers/completion-provider';
import { CompilerManager } from './extension/compiler-manager';
import { LixCommandProvider, blockProvider, formulaProvider } from './extension/providers/tree-data-provider';
import { LatexProvider } from './extension/providers/document-provider';
import { LixSemanticProvider } from './extension/providers/semantic-provider';
import { updateDiagnostic } from './extension/providers/diagnostic-provider';
import { ResultState } from './parser/result';
import { DocumentSelector } from 'vscode-languageclient';
import { Node } from './syntax-tree/node';
import { LixFoldingRangeProvider } from './extension/providers/folding-range-provider';
import './foundation/format';
import { loadTexts } from './extension/locale';
import { Texts } from './extension/locale';
import { Uri } from './compiler/uri';
import { NodePath } from './extension/node-path';
import { PdfViewerProvider } from './extension/providers/pdf-viewer-provider';


let config: VSCodeConfig;
let compilerManager: CompilerManager;
let texts: Texts;
let pdfPreviewer: PdfViewerProvider;

let lixCommandProvider: LixCommandProvider;
let documentProvider: LatexProvider;
export let diagnosticCollection: vscode.DiagnosticCollection;

const docSel: DocumentSelector = [{ scheme: "file", language: "lix" }];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Load configs & language files
	if (!await loadConfiguration(context)) {
		console.error("Failed to load Lix configuration files.");
		vscode.window.showErrorMessage("Failed to load Lix configuration files.");
		return;
	}

	// Texts
	texts = loadTexts(config.get("locale"), config.settings.locale);

	// Compiler manager
	compilerManager = new CompilerManager(config, texts);

	// Register commands
	registerCommands(context);

	// Register providers
	registerProviders(context);

	// Register PDF viewer
	await registerPdfViewer(context);

	// Listen events
	listenEvents(context);

	// Success
	console.log('Lix started successfully!');
	//vscode.window.showInformationMessage("Lix started successfully!");
}

async function loadConfiguration(context: vscode.ExtensionContext): Promise<boolean> {
	let configUri = vscode.Uri.joinPath(context.extensionUri, "config");
	config = new VSCodeConfig(configUri);
	if (!await config.readAll()) {
		return false;
	}

	const vscodeConfig = vscode.workspace.getConfiguration("lix");

	const locale = vscodeConfig.get<string>("locale")!;
	const latexMac = vscodeConfig.get<string>("latexCommand.mac")!;
	const latexLinux = vscodeConfig.get<string>("latexCommand.linux")!;
	const latexWindows = vscodeConfig.get<string>("latexCommand.windows")!;
	const cacheDir = vscodeConfig.get<string>("cacheDirectory")!;

	config.settings.locale = locale;
	config.settings.latexCommand.mac = latexMac;
	config.settings.latexCommand.linux = latexLinux;
	config.settings.latexCommand.windows = latexWindows;
	config.settings.cacheDirectory = cacheDir;

	return true;
}

function registerCommands(context: vscode.ExtensionContext) {

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.parse', parse)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.analyse', analyse)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.generate', generate)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.compile', compile)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.pick', pick)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.previewPdf', previewPdf)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.debug', debug)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.helloWorld', helloWorld)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.test', async () => {
			test();
			// let msg = "";
			// if (workspace.name) {
			// 	msg = msg.concat(workspace.name, ":");
			// }
			// else {
			// 	msg = msg.concat("None:");
			// }
			// for (let doc of workspace.textDocuments) {
			// 	msg = msg.concat(doc.fileName, ";");
			// }
			// vscode.window.showInformationMessage(msg);

		})
	);
}

function registerProviders(context: vscode.ExtensionContext) {

	// Document provider
	documentProvider = new LatexProvider();
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider("lix", documentProvider)
	);

	// Diagnostic collection
	diagnosticCollection = vscode.languages.createDiagnosticCollection("lix");
	context.subscriptions.push(diagnosticCollection);

	// Completion provider
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(docSel, new LixCompletionProvider(compilerManager), "[", "`", "(", "@", ",")
	);

	// Folding range provider
	context.subscriptions.push(
		vscode.languages.registerFoldingRangeProvider(docSel, new LixFoldingRangeProvider(compilerManager))
	);

	// Semantic token provider
	let tokenTypes = ['keyword', 'operator', 'string', 'function', 'variable', 'comment', 'class', 'type'];
	let tokenModifiers = ['declaration', 'documentation'];
	let legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
	vscode.languages.registerDocumentSemanticTokensProvider(docSel, new LixSemanticProvider(compilerManager, legend), legend);

	// Tree data provider
	lixCommandProvider = new LixCommandProvider(generatorNames[0]);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("lix-command-list", lixCommandProvider)
	);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("lix-label-list", new blockProvider(compilerManager))
	);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("lix-math-list", new formulaProvider(compilerManager))
	);
}

async function registerPdfViewer(context: vscode.ExtensionContext) {
	// Custom PDF viewer
	pdfPreviewer = new PdfViewerProvider(context.extensionUri);
	await pdfPreviewer.init();
	context.subscriptions.push(vscode.window.registerCustomEditorProvider(PdfViewerProvider.viewType, pdfPreviewer, {
		webviewOptions: { retainContextWhenHidden: true }
	}));
}

function listenEvents(context: vscode.ExtensionContext) {
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
}

// This method is called when your extension is deactivated
export async function deactivate(): Promise<void> {
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

	let parser = compilerManager.getCompiler(doc.uri).parser;
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

	parseDocument(event.document, false);

}

// async function onClose(document: vscode.TextDocument) {
// 	//console.log(`Document '${document.fileName}' closed.`);
// }

// **************** commands ****************

let compileTerminal: vscode.Terminal | undefined;

const generatorNames = ["markdown", "latex", "blog"];

async function pick(target?: string) {
	let document = getDocument();
	if (!document) {
		return;
	}

	let compiler = compilerManager.getCompiler(document.uri);
	let generatorNames = compiler.getGeneratorNames();

	if (target === undefined || !generatorNames.includes(target)) {
		target = await vscode.window.showQuickPick(generatorNames, { placeHolder: "Select compile target" });
	}
	if (target === undefined) {
		return;
	}

	compiler.setCurrentGenerator(target);
	lixCommandProvider.refresh(target);
	// const info = texts?.CompileTargetUpdated ? texts.CompileTargetUpdated.formatWithAutoBlank(target) : `Compile target set to ${target}`;
	// vscode.window.showInformationMessage(info);
}

function getLatexCommand(): string {
	switch (process.platform) {
		case "darwin":
			return config.settings.latexCommand.mac;
		case "win32":
			return config.settings.latexCommand.windows;
		default:
			return config.settings.latexCommand.linux;
	}
}

async function compile() {
	let document = getDocument();
	if (!document) {
		return;
	}
	await vscode.workspace.saveAll();

	let compiler = compilerManager.getCompiler(document.uri);
	await compiler.compile();
	updateStates(document);

	let outputUri = compiler.getOutputUri();
	let outputName = outputUri.basename;
	let workingDirUri = compiler.fileSystem.workingDirectoryUri;

	if (compileTerminal === undefined) {
		compileTerminal = vscode.window.createTerminal({ name: "Lix Compiler", hideFromUser: true });
		//compileTerminal.hide();
	}

	let generatorName = compiler.getCurrentGeneratorName();
	if (generatorName === "latex") {
		let cacheDirUri = compiler.fileSystem.cacheDirectoryUri;
		let pdfName = outputUri.stem + ".pdf";
		let pdfUri = cacheDirUri.joinPath(pdfName);
		let newPdfUri = workingDirUri.joinPath(pdfName);

		compileTerminal.sendText(`cd "${cacheDirUri.fsPath}"`);
		compileTerminal.sendText(`${getLatexCommand()} "${outputUri.fsPath}"`);
		compileTerminal.sendText(`cp "${pdfUri.fsPath}" "${newPdfUri.fsPath}"`);

		previewPDFDocument(convertUri(newPdfUri));
	}
	else if (generatorName === "markdown" || generatorName === "blog") {
		let targetUri = workingDirUri.joinPath(outputName);
		await compiler.fileSystem.copy(outputUri, targetUri);

		previewMarkdownDocument(convertUri(targetUri));
	}
	else {
		let targetUri = workingDirUri.joinPath(outputName);
		await compiler.fileSystem.copy(outputUri, targetUri);

		previewTextDocument(convertUri(targetUri));
	}
}

async function generate() {
	let document = getDocument();
	if (!document) {
		return;
	}
	generateDocument(document);
	previewDocument(getUri(document.uri, "generate"));
}

async function parse() {
	let document = getDocument();
	if (!document) {
		return;
	}
	parseDocument(document);
	previewDocument(getUri(document.uri, "parse"));
}

async function previewPdf(uri?: vscode.Uri | Uri) {
	let target: vscode.Uri | undefined;
	if (uri instanceof vscode.Uri) {
		target = uri;
	}
	else if (uri) {
		target = convertUri(uri);
	}

	if (!target) {
		const picked = await vscode.window.showOpenDialog({
			filters: { PDF: ['pdf'] },
			canSelectMany: false,
			openLabel: "Open PDF to preview"
		});
		if (!picked || picked.length === 0) {
			return;
		}
		target = picked[0];
	}

	await previewPDFDocument(target)
}

async function analyse() {
	let document = getDocument();
	if (!document) {
		return;
	}
	parseDocument(document);
	previewDocument(getUri(document.uri, "analyse"));
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

function generateDocument(document: vscode.TextDocument): Generator {
	let compiler = compilerManager.getCompiler(document.uri);
	compiler.generateText(document.getText());

	updateStates(document);
	return compiler.getCurrentGenerator();
}

export function parseDocument(document: vscode.TextDocument, updateDocument = true): Parser {

	let compiler = compilerManager.getCompiler(document.uri);
	compiler.parseText(document.getText());

	updateStates(document, updateDocument);

	return compiler.parser;
}

function updateStates(document: vscode.TextDocument, updateDocument: boolean = true) {
	let compiler = compilerManager.getCompiler(document.uri);

	updateDiagnostic(document, compilerManager);

	let state = "";
	switch (compiler.parser.state) {
		case ResultState.successful:
			state = "successful";
			break;
		case ResultState.skippable:
			state = "skippable";
			break;
		case ResultState.matched:
			state = "matched";
			break;
		case ResultState.failing:
			state = "failing";
			break;
	}

	if (updateDocument) {
		documentProvider.updateContent(getUri(document.uri, "parse"), `[[Parsing Result]]\n` + compiler.parser.syntaxTree.toString() + `\n[[State: ${state}]]`);
		documentProvider.updateContent(getUri(document.uri, "analyse"), `[[Analysing Result]]\n` + compiler.parser.analysedTree.toString() + `\n[[State: ${state}]]`);
		documentProvider.updateContent(getUri(document.uri, "generate"), `[[Generating Result]]\n` + compiler.getCurrentGenerator().output);
	}
}

async function updateFileList(document: vscode.TextDocument) {
	return;
	// let compiler = compilerManager.getCompiler(document.uri);
	// let list = await compiler.fileSystem.getFilesInDirectory(".");
	// let figlist: string[] = [];
	// for (let item of list) {
	// 	if (item.includes(".lix")) {
	// 		continue;
	// 	}
	// 	let ext = compiler.fileSystem.getFileExtension(item);
	// 	if (ext === "jpg" || ext === "png" || ext === "eps" || ext === "tikz") {
	// 		figlist.push(item);
	// 	}

	// }
	// compilerManager.setFileList(document.uri, figlist);
}

function previewDocument(uri: vscode.Uri) {
	vscode.workspace.openTextDocument(uri).then(doc => {
		let opt: vscode.TextDocumentShowOptions = { viewColumn: vscode.ViewColumn.Beside, preview: true, preserveFocus: true, selection: undefined };
		vscode.window.showTextDocument(doc, opt);
	});
}

async function previewMarkdownDocument(uri: vscode.Uri) {
	await vscode.commands.executeCommand(
		'vscode.openWith',
		uri,
		"vscode.markdown.preview.editor", // use built-in markdown preview
		vscode.ViewColumn.Beside
	);
}

async function previewTextDocument(uri: vscode.Uri) {
	await vscode.commands.executeCommand(
		'vscode.open',
		uri,
		vscode.ViewColumn.Beside
	);
}

async function previewPDFDocument(uri: vscode.Uri) {
	await vscode.commands.executeCommand(
		'vscode.openWith',
		uri,
		PdfViewerProvider.viewType, // Lix PDF viewer
		vscode.ViewColumn.Beside);
}

function convertUri(uri: Uri): vscode.Uri {
	return vscode.Uri.from({ scheme: uri.scheme, authority: uri.authority, path: uri.path, query: uri.query, fragment: uri.fragment });
}

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
