import * as vscode from 'vscode';
import { Parser } from '../parser/parser';
import { LixContext } from './lixContext';
import { CompletionTriggerKind } from 'vscode-languageclient';
import { Node } from '../sytnax-tree/node';
import { start } from 'repl';

export class LixCompletionProvider implements vscode.CompletionItemProvider {
    context: LixContext;

    constructor(context: LixContext) {
        this.context = context;
    }

    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        //console.log(`${context.triggerCharacter},${context.triggerKind}`);
        
        if(document.languageId !== 'lix') {
            return [];
        }

        let res: vscode.CompletionItem[] = [];
        let parser = this.context.getParser(document)!;
        if (this.inMath(parser, parser.getIndex(position.line, position.character-1)!)) {
            if (context.triggerKind === vscode.CompletionTriggerKind.Invoke) {
                let range = document.getWordRangeAtPosition(position);
                if (range) {
                    while (range.start.character > 0) {
                        range = new vscode.Range(range.start.translate(0, -1), range.end);
                        if (document.getText(range).substring(0, 1) != " ") {
                            break;
                        }
                    }
                    range = new vscode.Range(range.start.translate(0, 1), range.end)
                }
                else {
                    console.log("err");
                }
                

                // for (let item of parser.mathModule.symbols) {
                //     let comp = new vscode.CompletionItem(item, vscode.CompletionItemKind.Keyword);
                //     comp.insertText = item + " ";
                //     comp.detail = "math symbol from lix.";
                //     comp.range = range;
                //     res.push(comp);
                // }
                parser.mathModule.notationsToUnicodeSymbols.forEach((nota, name) => {
                    let comp = new vscode.CompletionItem(name, vscode.CompletionItemKind.Keyword);
                    comp.insertText = nota;
                    comp.detail = `Symbol char '${nota}'.`;
                    comp.range = range;
                    res.push(comp);
                })

                for (let item of parser.mathModule.blockHandlerTable.definations.keys()) {
                    let comp = new vscode.CompletionItem(item, vscode.CompletionItemKind.Keyword);
                    comp.insertText = item + " ";
                    comp.detail = "user-defined math symbol from lix.";
                    comp.range = range;
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
            for (let item of parser.blockHandlerTable.blockHandlers.keys()) {
                let comp = new vscode.CompletionItem(item, vscode.CompletionItemKind.Function);
                comp.insertText = item + " ";
                comp.detail = "labels from lix.";
                res.push(comp);
            }
        }
        return res;
    }

    inMath(parser: Parser, pos: number): boolean {
        let node: Node | undefined = parser.syntaxTree;

        outer: while(true) {
            if(node === undefined) {
                return false;
            }
            else if(node.type === parser.mathModule.formulaType) {
                return true;
            }
            for(let i = 0; i < node!.children.length; i++) {
                if(node!.children[i].begin <= pos && pos < node!.children[i].end) {
                    node = node!.children[i];
                    continue outer;
                }
            }
            node = undefined;
        }
        
        /*
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
        */
    }

}

