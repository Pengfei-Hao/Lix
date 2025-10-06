import * as vscode from 'vscode';
import { Parser } from '../parser/parser';
import { LixContext } from './lix-context';
import { Node } from '../sytnax-tree/node';
import * as file from 'fs';
import { Type } from '../sytnax-tree/type';
import { ArgumentType } from '../parser/block-table';

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
        let parser = this.context.getCompiler(document.uri).parser;

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
                    if (name) {
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
            }
        }

        else if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter && context.triggerCharacter == "[") {
            if (!this.inMath(parser, parser.getIndex(position.line, position.character)!)) {
                for (let item of parser.blockTable.handlers.keys()) {
                    let comp = new vscode.CompletionItem(item, vscode.CompletionItemKind.Function);
                    comp.insertText = item + " ";
                    comp.kind = vscode.CompletionItemKind.Keyword;
                    comp.detail = "Blocks from lix.";
                    res.push(comp);
                }
            }
        }
        else if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter && context.triggerCharacter == "`") {
            if (this.where(parser.coreModule.figureType, parser.analysedTree, parser.getIndex(position.line, position.character)!)) {
                let list = this.context.getFileList(document.uri);
                for (let item of list) {
                    let comp = new vscode.CompletionItem(item, vscode.CompletionItemKind.File);
                    res.push(comp);
                }
            }
        }
        else if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter && context.triggerCharacter == "@") {
            let compiler = this.context.getCompiler(document.uri);
            for (let item of compiler.parser.references) {
                let comp = new vscode.CompletionItem(item.name, vscode.CompletionItemKind.Reference);
                res.push(comp);
            }
        }
        else if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter && (context.triggerCharacter == "(" || context.triggerCharacter == ",")) {
            let node = this.where(parser.blockType, parser.syntaxTree, parser.getIndex(position.line, position.character)!);
            if (node) {
                if(context.triggerCharacter == "," && !this.where(parser.argumentsType, parser.syntaxTree, parser.getIndex(position.line, position.character)!)) {
                    return res;
                }
                let argNode = node.children.at(0);
                if(context.triggerCharacter == "(" && argNode && argNode.type === parser.argumentsType && argNode.begin != argNode.end) {
                    return res;
                }
                let compiler = this.context.getCompiler(document.uri);
                let spec = compiler.parser.blockTable.getOption(node.content);
                if (spec) {
                    for (let [name, arg] of spec.argumentOptions) {
                        let comp = new vscode.CompletionItem(name, vscode.CompletionItemKind.Field);
                        res.push(comp);

                        if (arg.type === ArgumentType.enumeration) {
                            for (let opt of arg.options) {
                                let comp = new vscode.CompletionItem(name + ': ' + opt, vscode.CompletionItemKind.Field);
                                res.push(comp);
                            }
                        }
                    }
                    if (spec.allowReference) {
                        let comp = new vscode.CompletionItem('@', vscode.CompletionItemKind.Field);
                        res.push(comp);
                    }
                }
            }

        }
        return res;
    }

    inMath(parser: Parser, pos: number): boolean {
        let node = parser.syntaxTree;
        outer: while (true) {
            if (node.type === parser.mathModule.formulaType) {
                return true;
            }
            for (let sub of node.children) {
                if (sub.begin <= pos && pos < sub.end) {
                    node = sub;
                    continue outer;
                }
            }
            break;
        }
        // 这两种情况是不同的, 上边是指针位于formula内部,下边是formula位于foumula结尾位置.
        node = parser.syntaxTree;
        outer: while (true) {
            if (node.type === parser.mathModule.formulaType) {
                return true;
            }
            for (let sub of node.children) {
                if (sub.begin <= pos && pos <= sub.end) {
                    node = sub;
                    continue outer;
                }
            }
            return false;
        }
    }

    where(type: Type, oriNode: Node, pos: number): Node | undefined {
        let node = oriNode;
        outer: while (true) {
            if (node.type === type) {
                return node;
            }
            for (let sub of node.children) {
                if (sub.begin <= pos && pos < sub.end) {
                    node = sub;
                    continue outer;
                }
            }
            break;
        }
        // 这两种情况是不同的, 上边是指针位于formula内部,下边是formula位于foumula结尾位置.
        node = oriNode;
        outer: while (true) {
            if (node.type === type) {
                return node;
            }
            for (let sub of node.children) {
                if (sub.begin <= pos && pos <= sub.end) {
                    node = sub;
                    continue outer;
                }
            }
            return undefined;
        }
    }
}

