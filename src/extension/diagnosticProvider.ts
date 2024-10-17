import * as vscode from 'vscode';
import { LixContext } from './lixContext';
import { MessageType } from '../foundation/message';
import { ResultState } from '../foundation/result';
import { diagnosticCollection } from '../extension';


export function updateDiagnostic(document: vscode.TextDocument, context: LixContext) {

    let parser = context.getParser(document)!;
    let messageList = parser.messageList;
	let state = parser.state;

    let diags: vscode.Diagnostic[] = [];
	for(let msg of messageList) {
		let diag = new vscode.Diagnostic(new vscode.Range(msg.line,msg.character,msg.line,msg.character+1), msg.toString());
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