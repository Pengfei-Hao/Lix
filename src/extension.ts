/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Pengfei Hao. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { VSCodeConfig } from './extension/vscode-config';
import { CompletionProvider } from './extension/providers/completion-provider';
import { DocumentManager } from './extension/document-manager';
import { StatusProvider, InformationProvider, StructureProvider } from './extension/providers/tree-data-provider';
import { SymbolProvider } from './extension/providers/symbol-provider';
import { DocumentProvider } from './extension/providers/document-provider';
import { SemanticProvider } from './extension/providers/semantic-provider';
import { updateDiagnostic } from './extension/providers/diagnostic-provider';
import { ResultState, stateToString } from './parser/result';
import { Node } from './syntax-tree/node';
import { FoldingRangeProvider } from './extension/providers/folding-range-provider';
import './foundation/format';
import { loadTexts } from './extension/locale';
import { Texts } from './extension/locale';
import { Uri } from './compiler/uri';
import { PdfViewerProvider } from './extension/providers/pdf-viewer-provider';
import { on } from 'events';
import { LatexOutputTool, MarkdownOutputTool, OutputUriTool, ParseMessagesTool, SyntaxTreeTool, VersionTool } from './extension/language-model/tool';
import { assistantHandler } from './extension/language-model/assistant';


let config: VSCodeConfig;
let documentManager: DocumentManager;
let texts: Texts;

let isDebugging = false;

let assistant: vscode.ChatParticipant;

let documentProvider: DocumentProvider;
let diagnosticCollection: vscode.DiagnosticCollection;
let pdfViewer: PdfViewerProvider;
let commandProvider: StatusProvider;
// let structureProvider: StructureProvider;
let informationProvider: InformationProvider;
let structureSymbolProvider: SymbolProvider;
let statusBarItem: vscode.StatusBarItem;

// **************** Extension ****************

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// vscode.window.showInformationMessage("Lix loading!");

	// Load configs & language files
	if (!await loadConfiguration(context)) {
		console.error("Failed to load Lix configuration files.");
		vscode.window.showErrorMessage("Failed to load Lix configuration files.");
		return;
	}

	// Texts
	texts = loadTexts(config.get("locale"), config.settings.locale);

	// Compiler manager
	documentManager = new DocumentManager(config, texts);

	// Register commands
	registerCommands(context);

	// Register providers
	registerProviders(context);

	// Register language model
	registerLanguageModel(context);

	// Status bar
	registerStatusBar(context);

	// Register PDF viewer
	await registerPdfViewer(context);

	// Listen events
	listenEvents(context);
	// Some documents are already opened
	for (let document of vscode.workspace.textDocuments) {
		onDidOpenTextDocument(document);
	}

	// Success
	console.log('Lix started successfully!');
	// vscode.window.showInformationMessage("Lix started successfully!");
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
		vscode.commands.registerCommand('lix.pickMarkdown', pick.bind(undefined, "markdown"))
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.pickLatex', pick.bind(undefined, "latex"))
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.previewPdf', previewPdf)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.convertFile', convertFile)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.showInformationMenu', showInformationMenu)
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
	documentProvider = new DocumentProvider();
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider("lix", documentProvider)
	);

	// Diagnostic collection
	diagnosticCollection = vscode.languages.createDiagnosticCollection("lix");
	context.subscriptions.push(diagnosticCollection);

	// Completion provider
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(DocumentManager.docSel, new CompletionProvider(documentManager), "[", "`", "(", "@", ",")
	);

	// Folding range provider
	context.subscriptions.push(
		vscode.languages.registerFoldingRangeProvider(DocumentManager.docSel, new FoldingRangeProvider(documentManager))
	);

	// Semantic token provider
	let tokenTypes = ['keyword', 'operator', 'string', 'function', 'variable', 'comment', 'class', 'type'];
	let tokenModifiers = ['declaration', 'documentation'];
	let legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
	vscode.languages.registerDocumentSemanticTokensProvider(DocumentManager.docSel, new SemanticProvider(documentManager, legend), legend);

	// Tree data provider
	commandProvider = new StatusProvider(documentManager);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("lix-status", commandProvider)
	);
	// structureProvider = new StructureProvider(documentManager);
	// context.subscriptions.push(
	// 	vscode.window.registerTreeDataProvider("lix-structure", structureProvider)
	// );
	informationProvider = new InformationProvider(documentManager);
	context.subscriptions.push(
		vscode.window.registerTreeDataProvider("lix-information", informationProvider)
	);

	// Document symbol provider
	structureSymbolProvider = new SymbolProvider(documentManager);
	context.subscriptions.push(
		vscode.languages.registerDocumentSymbolProvider(DocumentManager.docSel, structureSymbolProvider)
	);
}

function registerLanguageModel(context: vscode.ExtensionContext) {

	// context.subscriptions.push(
	// 	vscode.lm.registerTool("lix-get_version", new VersionTool())
	// );

	context.subscriptions.push(
		vscode.lm.registerTool("lix-get_syntax_tree", new SyntaxTreeTool(documentManager))
	);

	context.subscriptions.push(
		vscode.lm.registerTool("lix-get_parse_messages", new ParseMessagesTool(documentManager))
	);

	context.subscriptions.push(
		vscode.lm.registerTool("lix-get_markdown_output", new MarkdownOutputTool(documentManager))
	);

	context.subscriptions.push(
		vscode.lm.registerTool("lix-get_latex_output", new LatexOutputTool(documentManager))
	);

	context.subscriptions.push(
		vscode.lm.registerTool("lix-get_output_uri", new OutputUriTool(documentManager))
	);

	// assistant = vscode.chat.createChatParticipant("lix", assistantHandler);
	// assistant.iconPath = new vscode.ThemeIcon("preview");
	// context.subscriptions.push(assistant);
}

function registerStatusBar(context: vscode.ExtensionContext) {
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
	statusBarItem.command = "workbench.view.extension.lix-bar";
	updateStatusBar();
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);
}

async function registerPdfViewer(context: vscode.ExtensionContext) {
	// Custom PDF viewer
	pdfViewer = new PdfViewerProvider(context.extensionUri);
	await pdfViewer.init();
	context.subscriptions.push(vscode.window.registerCustomEditorProvider(PdfViewerProvider.viewType, pdfViewer, {
		webviewOptions: { retainContextWhenHidden: true }
	}));
}

function listenEvents(context: vscode.ExtensionContext) {

	context.subscriptions.push(
		vscode.window.onDidCloseTerminal(onTerminalClosed)
	);

	// Document events

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(onDidOpenTextDocument)
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(onDidChangeTextDocument)
	);

	// context.subscriptions.push(
	// 	vscode.workspace.onWillSaveTextDocument(onWillSaveTextDocument)
	// );

	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(onDidSaveTextDocument)
	);

	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument(onDidCloseTextDocument)
	);

	// Editor events

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor)
	)

	context.subscriptions.push(
		vscode.window.onDidChangeTextEditorSelection(onDidChangeTextEditorSelection)
	);
}

// This method is called when your extension is deactivated
export async function deactivate(): Promise<void> {
}

// **************** events ****************

// Editor events

async function onDidChangeTextEditorSelection(change: vscode.TextEditorSelectionChangeEvent) {
	if (!isDebugging) {
		return;
	}
	let document = documentManager.validateDocument(change.textEditor.document);
	if (!document) {
		return;
	}
	if (document.uri.fragment !== "") {
		return;
	}

	let parser = documentManager.getParseResult(document);
	let pos = change.selections[0].start;

	let index = parser.getIndex(pos.line, pos.character)!;
	let line = locate(index, parser.syntaxTree) - 1 + 1;
	//console.log(`index:${index};line:${pos.line},char:${pos.character}`);
	vscode.window.showInformationMessage(`index: ${index}; line: ${pos.line}, character: ${pos.character}`);

	previewDocument(getPreviewUri(document.uri, "parse"), new vscode.Range(line, 0, line, 0));

	let lineA = locate(index, parser.analysedTree) - 1 + 1;

	previewDocument(getPreviewUri(document.uri, "analyse"), new vscode.Range(lineA, 0, lineA, 0));

}

async function onDidChangeActiveTextEditor(editor: vscode.TextEditor | undefined) {
	updateUI(false);
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

// Terminal events

function onTerminalClosed(terminal: vscode.Terminal) {
	if (terminal === compileTerminal) {
		compileTerminal = undefined;
	}
}

// Document events

async function onDidOpenTextDocument(allDocument: vscode.TextDocument) {
	let document = documentManager.validateDocument(allDocument, false);
	if (!document) {
		return;
	}
	documentManager.add(document);
	documentManager.parseDocument(document);
	updateData(document, false);
	updateUI(false);
}

// async function onWillSaveTextDocument(event: vscode.TextDocumentWillSaveEvent) {
// }

async function onDidSaveTextDocument(document: vscode.TextDocument) {
}

async function onDidChangeTextDocument(event: vscode.TextDocumentChangeEvent) {
	let document = documentManager.validateDocument(event.document);
	if (!document) {
		return;
	}
	documentManager.parseDocument(document);
	updateData(document, true);
	updateUI(true);
}

async function onDidCloseTextDocument(allDocument: vscode.TextDocument) {
	let document = documentManager.validateDocument(allDocument);
	if (!document) {
		return;
	}
	documentManager.remove(document);
}

// **************** Commands ****************

let compileTerminal: vscode.Terminal | undefined;

async function pick(generator?: unknown) {
	let document = documentManager.validateDocument();
	if (!document) {
		return;
	}

	let generatorNames = documentManager.getGenerators(document);
	if (generator === undefined || !(typeof generator === "string")) {
		generator = await vscode.window.showQuickPick(generatorNames, { placeHolder: "Select generator" });
	}
	if (generator === undefined || (typeof generator !== "string") || !documentManager.getGenerators(document).includes(generator)) {
		return;
	}

	documentManager.setGenerator(document, generator);
	updateUI(true);
}

type InformationMenuItem = vscode.QuickPickItem & {
	type: "command" | "generatorRoot";
	commandId?: string;
};

type GeneratorMenuItem = vscode.QuickPickItem & {
	generator: string;
};

async function showInformationMenu() {
	const document = documentManager.validateDocument();

	const buildActionItem = (label: string, commandId: string, icon?: string): InformationMenuItem => ({
		label: icon ? `${icon} ${label}` : label,
		type: "command",
		commandId
	});

	const items: InformationMenuItem[] = [];

	if (!document) {
		items.push(
			buildActionItem("Convert to Lix (AI)", "lix.convertFile", "$(file-pdf)"),
			buildActionItem("Debug", "lix.debug", "$(bug)")
		);
	} else {
		const currentGenerator = documentManager.getGenerator(document);
		items.push(
			buildActionItem("Compile", "lix.compile", "$(run)"),
			buildActionItem("Convert to Lix (AI)", "lix.convertFile", "$(file-pdf)"),
			buildActionItem("Generate", "lix.generate", "$(file-code)"),
			buildActionItem("Analyse", "lix.analyse", "$(list-tree)"),
			buildActionItem("Parse", "lix.parse", "$(list-tree)"),
			buildActionItem("Debug", "lix.debug", "$(bug)"),
			{
				label: "$(settings-gear) Available Generators",
				description: `Current: ${currentGenerator}`,
				type: "generatorRoot"
			}
		);
	}

	if (items.length === 0) {
		return;
	}

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: "Lix actions",
		ignoreFocusOut: true
	});

	if (!picked) {
		return;
	}

	if (picked.type === "generatorRoot" && document) {
		await showGeneratorMenu(document);
		return;
	}

	if (picked.commandId) {
		await vscode.commands.executeCommand(picked.commandId);
	}
}

async function showGeneratorMenu(document: vscode.TextDocument) {
	const generatorNames = documentManager.getGenerators(document);
	if (generatorNames.length === 0) {
		return;
	}

	const currentGenerator = documentManager.getGenerator(document);

	const quickPick = vscode.window.createQuickPick<GeneratorMenuItem>();
	quickPick.title = "Select generator";
	quickPick.canSelectMany = true;
	quickPick.items = generatorNames.map<GeneratorMenuItem>(name => ({
		label: name,
		generator: name,
		picked: name === currentGenerator
	}));
	quickPick.selectedItems = quickPick.items.filter(item => item.picked);

	const selection = await new Promise<GeneratorMenuItem | undefined>(resolve => {
		const disposables: vscode.Disposable[] = [];
		disposables.push(quickPick.onDidChangeSelection(sel => {
			if (sel.length === 0) {
				quickPick.selectedItems = [];
				return;
			}
			const last = sel[sel.length - 1];
			quickPick.selectedItems = [last];
		}));
		disposables.push(quickPick.onDidAccept(() => {
			resolve(quickPick.selectedItems[0]);
			quickPick.hide();
		}));
		disposables.push(quickPick.onDidHide(() => {
			resolve(undefined);
			disposables.forEach(d => d.dispose());
			quickPick.dispose();
		}));

		quickPick.show();
	});

	if (!selection) {
		return;
	}

	documentManager.setGenerator(document, selection.generator);
	updateUI(true);
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
	let document = documentManager.validateDocument();
	if (!document) {
		return;
	}
	await vscode.workspace.saveAll();

	await documentManager.compile(document);
	updateData(document, true);
	updateUI(true);

	let { outputUri } = documentManager.getCompileResult(document);
	let outputName = outputUri.basename;
	let fileSystem = documentManager.getFileSystem(document);
	let workingDirUri = fileSystem.workingDirectoryUri;

	if (compileTerminal === undefined) {
		compileTerminal = vscode.window.createTerminal({ name: "Lix Compiler", hideFromUser: true });
		//compileTerminal.hide();
	}

	let generatorName = documentManager.getGenerator(document);
	if (generatorName === "latex") {
		let cacheDirUri = fileSystem.cacheDirectoryUri;
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
		await fileSystem.copy(outputUri, targetUri);

		previewMarkdownDocument(convertUri(targetUri));
	}
	else {
		let targetUri = workingDirUri.joinPath(outputName);
		await fileSystem.copy(outputUri, targetUri);

		previewTextDocument(convertUri(targetUri));
	}
}

async function generate() {
	let document = documentManager.validateDocument();
	if (!document) {
		return;
	}
	documentManager.generateDocument(document);
	updateData(document, false);
	updateUI(true);
	previewDocument(getPreviewUri(document.uri, "generate"));
}

async function analyse() {
	let document = documentManager.validateDocument();
	if (!document) {
		return;
	}
	documentManager.parseDocument(document);
	updateData(document, false);
	updateUI(true);
	previewDocument(getPreviewUri(document.uri, "analyse"));
}

async function parse() {
	let document = documentManager.validateDocument();
	if (!document) {
		return;
	}
	documentManager.parseDocument(document);
	updateData(document, false);
	updateUI(true);
	previewDocument(getPreviewUri(document.uri, "parse"));
}

async function previewPdf(uri?: vscode.Uri) {
	if (!uri) {
		const picked = await vscode.window.showOpenDialog({
			filters: { PDF: ['pdf'] },
			canSelectMany: false,
			canSelectFolders: false
		});
		uri = picked?.at(0);
	}
	if (!uri) {
		return;
	}
	await previewPDFDocument(uri)
}

async function convertFile(uri?: vscode.Uri) {
	if (!uri) {
		const picked = await vscode.window.showOpenDialog({
			canSelectMany: false,
			canSelectFolders: false
		});
		uri = picked?.at(0);
	}
	if (!uri) {
		return;
	}
	const prompt = `Read the file "${uri.fsPath}" and convert it to a Lix document in a new editor. Make sure that there are no errors in the Lix document. Use #lixLatexOutput #lixMarkdownOutput to preview the generated output. Make sure the output coincides with the original file as much as possible. Use  #lixParseMessages to get error messages.`;
	await await vscode.commands.executeCommand('workbench.action.chat.openagent', prompt);
}

async function debug() {
	isDebugging = !isDebugging;
	if (isDebugging) {
		compileTerminal?.show();
	}
	else {
		compileTerminal?.hide();
	}
	vscode.commands.executeCommand('setContext', 'lix.debug', isDebugging);
}

async function test() {
	vscode.window.showInformationMessage("abcd");
	console.log((await vscode.commands.getCommands(true)).filter(c => c.includes("chat")));
	console.log(vscode.lm.tools.map(t => t.name));
	await vscode.commands.executeCommand('workbench.action.chat.openagent', "hello",
		vscode.Uri.file("/a/b/c"),
		vscode.Uri.file("/a/b/c"));
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

// **************** Update ****************

// Update data
// Automatic: completion, folding range, semantic, structure symbols

// Suppose document is already validated
function updateData(document: vscode.TextDocument, fast: boolean) {
	updateDiagnostic(document, documentManager, diagnosticCollection);
	updateStructure(document);
	if (!fast) {
		updateDocument(document);
	}
}

function updateDocument(document: vscode.TextDocument) {
	let parser = documentManager.getParseResult(document);
	let state = "";
	switch (parser.state) {
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
	documentProvider.updateContent(getPreviewUri(document.uri, "parse"), `[[Parsing Result]]\n` + parser.syntaxTree.toString() + `\n[[State: ${state}]]`);
	documentProvider.updateContent(getPreviewUri(document.uri, "analyse"), `[[Analysing Result]]\n` + parser.analysedTree.toString() + `\n[[State: ${state}]]`);
	documentProvider.updateContent(getPreviewUri(document.uri, "generate"), `[[Generating Result]]\n` + documentManager.getGenerateResult(document).output);

}

function updateStructure(document: vscode.TextDocument) {
	let structure = StructureProvider.cacheTreeData(document, documentManager);
	documentManager.setStructureData(document, structure);
}

// Update UI

function updateUI(fast: boolean) {
	updateStatusBar();
	updateTreeData(fast);

	let isLix = documentManager.validateDocument() !== undefined;
	vscode.commands.executeCommand('setContext', 'lix.isLix', isLix);
}

function updateStatusBar() {
	let document = documentManager.validateDocument();
	if (!document) {
		statusBarItem.text = "$(circle-large-outline) Lix";
		statusBarItem.tooltip = "Lix";
		return;
	}
	let state = documentManager.getParseResult(document).state;
	let generator = documentManager.getGenerator(document);
	let info = stateToString(state);
	switch (state) {
		case ResultState.successful:
			statusBarItem.text = `$(pass) Lix (${generator})`;
			statusBarItem.tooltip = `State: ${info}`;
			break;
		case ResultState.skippable:
			statusBarItem.text = `$(error) Lix (${generator})`;
			statusBarItem.tooltip = `State: ${info}`;
			break;
		case ResultState.matched:
			statusBarItem.text = `$(error) Lix (${generator})`;
			statusBarItem.tooltip = `State: ${info}`;
			break;
		case ResultState.failing:
		default:
			statusBarItem.text = `$(error) Lix (${generator})`;
			statusBarItem.tooltip = `State: ${info}`;
			break;
	}
}

function updateTreeData(fast: boolean = false) {
	commandProvider.onDidChangeTreeDataEmitter.fire(undefined);
	// structureProvider.onDidChangeTreeDataEmitter.fire(undefined);
	if (!fast) {
		informationProvider.onDidChangeTreeDataEmitter.fire(undefined);
	}
}

// **************** Preview ****************

function previewDocument(uri: vscode.Uri, selection: vscode.Range | undefined = undefined) {
	vscode.workspace.openTextDocument(uri).then(doc => {
		let opt: vscode.TextDocumentShowOptions = { viewColumn: vscode.ViewColumn.Beside, preview: true, preserveFocus: true, selection: selection };
		vscode.window.showTextDocument(doc, opt);
	});
}

function getPreviewUri(uri: vscode.Uri, flag: string): vscode.Uri {
	let name = uri.path.split("/").at(-1);
	return vscode.Uri.from({ scheme: "lix", path: flag + ': ' + name, fragment: uri.path });
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

// **************** Assistance ****************

function convertUri(uri: Uri): vscode.Uri {
	return vscode.Uri.from({ scheme: uri.scheme, authority: uri.authority, path: uri.path, query: uri.query, fragment: uri.fragment });
}
