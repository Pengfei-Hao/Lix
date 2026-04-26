import * as vscode from 'vscode';
import { DocumentManager } from '../document-manager';
import { MessageType } from '../../common/result/message';
import { ResultState } from '../../common/result/result';
import { stateToString } from "../../extension";

export function updateDiagnostic(document: vscode.TextDocument, documentManager: DocumentManager, diagnosticCollection: vscode.DiagnosticCollection) {

	let compiler = documentManager.getCompiler(document);
	let parser = compiler.parserResult;
	let messages = parser.messages;
	let state = parser.state;

	let diags: vscode.Diagnostic[] = [];
	for (let msg of messages) {
		let begin = compiler.sourceText.indexToPosition(msg.range.begin) ?? { line: 0, character: 0 };
		let end = compiler.sourceText.indexToPosition(msg.range.end) ?? { line: 0, character: 1 };

		let diag = new vscode.Diagnostic(new vscode.Range(begin.line, begin.character, end.line, end.character), msg.toString());
		switch (msg.type) {
			case MessageType.message:
				diag.severity = vscode.DiagnosticSeverity.Information;
				break;
			case MessageType.warning:
				diag.severity = vscode.DiagnosticSeverity.Warning;
				break;
			case MessageType.error:
				diag.severity = vscode.DiagnosticSeverity.Error;
				break;
		}
		diags.push(diag);
	}

	let diag = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), "State: " + stateToString(state), vscode.DiagnosticSeverity.Information);
	// diags.push(diag);

	diagnosticCollection.set(document.uri, diags);
}