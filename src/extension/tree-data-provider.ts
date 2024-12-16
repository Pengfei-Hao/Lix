import { LixContext } from "./lix-context";
import * as vscode from 'vscode';

export class blockProvider implements vscode.TreeDataProvider<string> {
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
            for(let label of this.context.getCompiler(document.uri).parser.blockHandlerTable.blockHandlers.keys()) {
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


export class formulaProvider implements vscode.TreeDataProvider<string> {
    context: LixContext;

    constructor(context: LixContext) {
        this.context = context;
    }

    getChildren(element?: string | undefined): vscode.ProviderResult<string[]> {
        let document = vscode.window.activeTextEditor?.document;
        if(!document) {
            return [];
        }
        let parser = this.context.getCompiler(document.uri).parser;
        if(!element) {
            let res = [];
            for(let label of parser.mathModule.notations.keys()) {
                res.push(label);
            }
            for(let label of parser.mathModule.symbols.keys()) {
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