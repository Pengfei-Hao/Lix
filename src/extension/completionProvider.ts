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
        //console.log(`${context.triggerCharacter},${position.line},${position.character}`);
        if (document.languageId !== 'lix') {
            return [];
        }

        let res: vscode.CompletionItem[] = [];
        let parser = this.context.getParser(document)!;

        if (context.triggerKind === vscode.CompletionTriggerKind.Invoke) {
            //if (this.inMath(parser, parser.getIndex(position.line, position.character-1)!)) {

            let range = document.getWordRangeAtPosition(position);
            if (!range) {
                console.log("err");
                return [];
            }

            if (this.inMath(parser, parser.getIndex(range.start.line, range.start.character)!)) {
                while (range.start.character > 0) {
                    range = new vscode.Range(range.start.translate(0, -1), range.end);
                    if (document.getText(range).substring(0, 1) != " ") {
                        break;
                    }
                }
                range = new vscode.Range(range.start.translate(0, 1), position)


                parser.mathModule.notations.forEach((nota) => {
                    let name = parser.mathModule.notationsToUnicodeSymbols.get(nota);
                    if(name) {
                        let comp = new vscode.CompletionItem(nota, vscode.CompletionItemKind.Keyword);
                        comp.insertText = name;
                        comp.detail = `Symbol char '${name}'.`;
                        comp.kind = vscode.CompletionItemKind.Operator;
                        comp.range = range;
                        res.push(comp);
                    }
                    else {
                        let comp = new vscode.CompletionItem(nota, vscode.CompletionItemKind.Keyword);
                        comp.insertText = nota + " ";
                        comp.detail = `Notation '${nota}'.`;
                        comp.kind = vscode.CompletionItemKind.Field;
                        //comp.range = range;
                        res.push(comp);
                    }
                })

                // for (let item of parser.mathModule.blockHandlerTable.definations.keys()) {
                //     let comp = new vscode.CompletionItem(item, vscode.CompletionItemKind.Keyword);
                //     comp.insertText = item + " ";
                //     comp.detail = "user-defined math symbol from lix.";
                //     comp.range = range;
                //     res.push(comp);
                // }
            }
        }

        else if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter && context.triggerCharacter == "[") {
            if (this.inMath(parser, parser.getIndex(position.line, position.character)!)) {
                for (let item of parser.blockHandlerTable.blockHandlers.keys()) {
                    let comp = new vscode.CompletionItem(item, vscode.CompletionItemKind.Function);
                    comp.insertText = item + " ";
                    comp.kind = vscode.CompletionItemKind.Keyword;
                    comp.detail = "Blocks from lix.";
                    res.push(comp);
                }
            }
        }
        return res;
    }

    inMath(parser: Parser, pos: number): boolean {
        let node: Node | undefined = parser.syntaxTree;

        outer: while (true) {
            if (node === undefined) {
                return false;
            }
            else if (node.type === parser.mathModule.formulaType) {
                return true;
            }
            for (let i = 0; i < node!.children.length; i++) {
                if (node!.children[i].begin <= pos && pos < node!.children[i].end) {
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

