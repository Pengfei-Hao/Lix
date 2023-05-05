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

import * as lix from './lix';


let client: LanguageClient;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let serverModule = context.asAbsolutePath(path.join( 'out', 'server.js'));

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

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "lix" is now active!');

	vscode.workspace.registerTextDocumentContentProvider("lix", myLatexProvider);

	context.subscriptions.push(
		vscode.commands.registerCommand('lix.showLatex', async () => {
		  parseLix();
		})
	  );

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	
	  let disposable = vscode.commands.registerCommand('lix.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from LiX!');
	});

	context.subscriptions.push(disposable);
}

function parseLix() {
	var document = vscode.window.activeTextEditor?.document;
	if(typeof document !== "undefined") {
		lix.initParser(document.getText());
		lix.parse();

		var latex = lix.exportLatex();
		var uri = myLatexProvider.addContent(latex);
		vscode.window.showTextDocument(uri);
	}
	
	
}

// This method is called when your extension is deactivated
export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	  }
	  return client.stop();
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