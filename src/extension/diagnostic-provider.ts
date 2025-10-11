import * as vscode from 'vscode';
import { LixContext } from './lix-context';
import { MessageType } from '../foundation/message';
import { ResultState } from '../parser/result';
import { diagnosticCollection } from '../extension';


export function updateDiagnostic(document: vscode.TextDocument, context: LixContext) {

    let parser = context.getCompiler(document.uri).parser;
    let messageList = parser.messages;
	let state = parser.state;

    let diags: vscode.Diagnostic[] = [];
	for(let msg of messageList) {
		let begin = parser.getLineAndCharacter(msg.begin) ?? { line: 0, character: 0 };
		let end = parser.getLineAndCharacter(msg.end) ?? { line: 0, character: 1 };

		let diag = new vscode.Diagnostic(new vscode.Range(begin.line, begin.character, end.line, end.character), msg.toString());
		switch(msg.type) {
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

	let st = "";
	switch(state) {
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

	let diag = new vscode.Diagnostic(new vscode.Range(0,0,0,1),"State: " + st, vscode.DiagnosticSeverity.Information);
	diags.push(diag);

	diagnosticCollection.set(document.uri, diags);
}