import { LixContext } from "./lixContext";
import * as vscode from 'vscode';

export class LabelProvider implements vscode.TreeDataProvider<string> {
    context: LixContext;

    constructor(context: LixContext) {
        this.context = context;
    }

    getChildren(element?: string | undefined): vscode.ProviderResult<string[]> {
        let document = vscode.window.activeTextEditor?.document;
        if(!document) {
            return [];
        }
        if(!element) {
            let res = [];
            for(let label of this.context.getParser(document).blockHandlerTable.blockHandlers.keys()) {
                res.push(label);
            }
            return res;
        }
        else {
            return [];
        }
    }

    getTreeItem(element: string): vscode.TreeItem | Thenable<vscode.TreeItem> {
        let item = new vscode.TreeItem(element);
        return item;
    }
}


export class MathLabelProvider implements vscode.TreeDataProvider<string> {
    context: LixContext;

    constructor(context: LixContext) {
        this.context = context;
    }

    getChildren(element?: string | undefined): vscode.ProviderResult<string[]> {
        let document = vscode.window.activeTextEditor?.document;
        if(!document) {
            return [];
        }
        let parser = this.context.getParser(document);
        if(!element) {
            let res = [];
            for(let label of parser.mathModule.blockHandlerTable.definations.keys()) {
                res.push(label);
            }
            for(let label of parser.mathModule.blockHandlerTable.symbols.keys()) {
                res.push(label);
            }
            return res;
        }
        else {
            return [];
        }
    }

    getTreeItem(element: string): vscode.TreeItem | Thenable<vscode.TreeItem> {
        let item = new vscode.TreeItem(element);
        return item;
    }
}