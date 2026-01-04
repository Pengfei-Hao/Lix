import * as vscode from "vscode";

export class DocumentProvider implements vscode.TextDocumentContentProvider {

	content: Map<string, string>;

	constructor() {
		this.content = new Map();
	}

	provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
		return this.content.get(uri.toString()) ?? "[[empty]]";
	}

	updateContent(uri: vscode.Uri, content: string) {
		this.content.set(uri.toString(), content);
		this.onDidChangeEmitter.fire(uri);
	}

	onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
	onDidChange = this.onDidChangeEmitter.event;
}