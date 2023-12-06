import * as vscode from "vscode";


export class LatexProvider implements vscode.TextDocumentContentProvider {

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
