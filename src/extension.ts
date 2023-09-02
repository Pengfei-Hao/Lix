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
import { Config } from './config';


let client: LanguageClient;

let config: Config;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Start the language cilent

	let serverModule = context.asAbsolutePath(path.join('out', 'server.js'));

	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'lix' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();

	vscode.workspace.registerTextDocumentContentProvider("lix", myLatexProvider);


	// Register the Commands

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.showLatex', async () => {
			showLatex();
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
		vscode.commands.registerCommand('lix.showPdf', async () => {
			showPdf();
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
	// Successfully init

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "lix" is now active!');
	//vscode.window.showInformationMessage(`extensionPath:${context.extensionPath};globalStorage:${context.globalStorageUri.fsPath};Storage:${context.storageUri?.path};logPath:${context.logUri.fsPath}`);

	config = new Config(context.extensionUri);
	let success = await config.readAll();
	console.log(`Configs loading success: ${success}`);
	//console.log(`math.json: ${config.get("math")}`);

	//config.set("label", '{"labels": ["paragraph", "title"]}');

	//await config.saveAll();
}

async function showPdf() {
	var document = vscode.window.activeTextEditor?.document;
	if(typeof document !== "undefined") {
		let parser = new Parser(document.getText(), config);
		parser.parse();

		let generator = new LatexGenerator(parser);
		var latex = generator.generate();

		var encoder = new TextEncoder();
		
		var uri = vscode.window.activeTextEditor?.document.uri;
		if(typeof uri !== "undefined") {
			
			var pat = uri.path;
			var tem = pat.split("/").at(-1);
			console.log(tem);
			uri = vscode.Uri.joinPath(uri, "../lix_temp");
	
			await vscode.workspace.fs.createDirectory(uri);
			var turi = uri;
			uri = vscode.Uri.joinPath(uri, tem + ".tex");
			await vscode.workspace.fs.writeFile(uri, encoder.encode(latex));
			//vscode.workspace.fs.writeFile(vscode.Uri.file('./temp.tex'), encoder.encode(latex));

			var terminal = vscode.window.createTerminal("Latex Compiler");
			terminal.sendText("cd " + vscode.Uri.joinPath(uri, "../").fsPath);
			terminal.sendText("xelatex -synctex=1 -interaction=nonstopmode \"" + uri.fsPath + "\"");
			turi = vscode.Uri.joinPath(turi, tem + ".pdf");
			terminal.sendText("start msedge \"" + turi.fsPath + "\"");
		}
		
	}
}

async function showLatex() {
	var document = vscode.window.activeTextEditor?.document;
	if(typeof document !== "undefined") {
		let parser = new Parser(document.getText(), config);
		parser.parse();

		let generator = new LatexGenerator(parser);
		var latex = generator.generate();

		var uri = myLatexProvider.addContent(latex);
		vscode.window.showTextDocument(uri);
	}
	
	
}

async function parse() {
	var document = vscode.window.activeTextEditor?.document;
	if(typeof document !== "undefined") {
		let parser = new Parser(document.getText(), config);
		parser.parse();

		let nodeTree = parser.syntaxTree;
		let uri = myLatexProvider.addContent(nodeTree.toString());
		vscode.window.showTextDocument(uri);
	}
	
	
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
	
	if (!client) {
		return;
	}
	await client.stop();
}


class LatexProvider implements vscode.TextDocumentContentProvider {

	content: string[] = [];
	count: number;
	constructor() {
		this.content = [];
		this.count = 0;
	}

	provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
		var index = Number(uri.path);
		return this.content[index];
	}

	addContent(content: string): vscode.Uri {
		this.content.push(content);
		this.count++;
		return vscode.Uri.parse("lix:" + String(this.count - 1));
	}

	onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  	onDidChange = this.onDidChangeEmitter.event;

}

var myLatexProvider = new LatexProvider();