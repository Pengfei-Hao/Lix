import * as vscode from 'vscode';
import { Parser } from '../parser/parser';
import { Context } from './context';
import { CompletionTriggerKind } from 'vscode-languageclient';
import { Node } from '../sytnax-tree/node';

export class LixCompletionProvider implements vscode.CompletionItemProvider {
    context: Context;

    constructor(context: Context) {
        this.context = context;
    }

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        //console.log(`${context.triggerCharacter},${context.triggerKind}`);
        
        if(document.languageId !== 'lix') {
            return [];
        }

        let res: vscode.CompletionItem[] = [];
        let parser = this.context.getParser(document)!;
        if (this.inMath(parser, parser.getIndex(position.line - 1, position.character - 1)!)) {
            if (context.triggerCharacter == " " || context.triggerKind === vscode.CompletionTriggerKind.Invoke) {
                for (let item of parser.mathModule.blockHandlerTable.symbols.keys()) {
                    let comp = new vscode.CompletionItem(item, vscode.CompletionItemKind.Keyword);
                    comp.insertText = item + " ";
                    comp.detail = "math symbol from lix.";
                    res.push(comp);
                }
                for (let item of parser.mathModule.blockHandlerTable.definations.keys()) {
                    let comp = new vscode.CompletionItem(item, vscode.CompletionItemKind.Keyword);
                    comp.insertText = item + " ";
                    comp.detail = "user-defined math symbol from lix.";
                    res.push(comp);
                }
            }
            if (context.triggerCharacter == "[") {
                for (let [item,val] of [["fraction","/"],["matrix",""],["script","^_"],["int","int to :"],["sum to :","sum"],["lim","lim :"]]) {
                    let comp = new vscode.CompletionItem(item, vscode.CompletionItemKind.Function);
                    comp.insertText = val;
                    comp.detail = "math block from lix.";
                    res.push(comp);
                }
            }
        }


        else if (context.triggerCharacter == "[") {
            for (let item of parser.labelHandlerTable.labelHandlers.keys()) {
                let comp = new vscode.CompletionItem(item, vscode.CompletionItemKind.Function);
                comp.insertText = item + " ";
                comp.detail = "labels from lix.";
                res.push(comp);
            }
        }
        return res;
    }

    inMath(parser: Parser, pos: number): boolean {
        let node: Node | undefined = undefined;
        let syntax: Node = parser.syntaxTree;
        for(let i = 0; i < syntax.children.length; i++) {
            if(syntax.children[i].begin <= pos && pos < syntax.children[i].end) {
                node = syntax.children[i];
                break;
            }
        }
        if(!node) {
            return false;
        }

        for(let i = 0; i < node.children.length; i++) {
            if(node.children[i].begin <= pos && pos < node.children[i].end) {
                node = node.children[i];
                break;
            }
        }
        if(node && node.type === parser.mathModule.formulaType) {
            return true;
        }
        return false;
    }
}

