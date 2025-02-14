import * as vscode from "vscode";

export class LatexProvider implements vscode.TextDocumentContentProvider {

	content: Map<string, string>;

	constructor() {
		this.content = new Map();
	}

	provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
		return this.content.get(uri.path) ?? "[empty]";
	}

	updateContent(uri: vscode.Uri, content: string) {
		this.content.set(uri.path, content);
		this.onDidChangeEmitter.fire(uri);
	}

	onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
	onDidChange = this.onDidChangeEmitter.event;
}