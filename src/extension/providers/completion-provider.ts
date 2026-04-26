import * as vscode from 'vscode';
import { Parser } from '../../parser/parser';
import { DocumentManager } from '../document-manager';
import { Node, ReadonlyNode } from '../../common/syntax-tree/node';
import { Type } from "../../common/syntax-tree/type-table";
import { ArgumentType } from '../../parser/table/block-table';
import { ParserResult } from '../../compiler/compiler';
import { Position } from '../../common/source-text';

export class CompletionProvider implements vscode.CompletionItemProvider {

    constructor(
        private documentManager: DocumentManager
    ) {
    }

    public provideCompletionItems(allDocument: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {
        //console.log(`${context.triggerCharacter},${context.triggerKind}`);
        //console.log(`${context.triggerCharacter},${position.line},${position.character}`);
        let document = this.documentManager.validate(allDocument);
        if (!document) {
            return;
        }

        let res: vscode.CompletionItem[] = [];
        let compiler = this.documentManager.getCompiler(document);
        let parser = compiler.parserResult;

        if (compiler.typeTable.has("formula") && context.triggerKind === vscode.CompletionTriggerKind.Invoke) {
            //if (this.inMath(parser, compiler.sourceText.lineAndCharacterToIndex(position.line, position.character-1)!)) {
            const formulaType = compiler.typeTable.get("formula");
            let range = document.getWordRangeAtPosition(position);
            if (!range) {
                console.log("err");
                return [];
            }

            if (this.inMath(formulaType, parser.syntaxTree, compiler.sourceText.positionToIndex(new Position(range.start.line, range.start.character))!.value)) {
                while (range.start.character > 0) {
                    range = new vscode.Range(range.start.translate(0, -1), range.end);
                    if (document.getText(range).substring(0, 1) != " ") {
                        break;
                    }
                }
                range = new vscode.Range(range.start.translate(0, 1), position)


                parser.mathTable.notations.forEach((nota) => {
                    let name = parser.mathTable.notationToSymbols.get(nota);
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
            if (!compiler.typeTable.has("formula") || !this.inMath(compiler.typeTable.get("formula"), parser.syntaxTree, compiler.sourceText.positionToIndex(new Position(position.line, position.character))!.value)) {
                for (let item of parser.blockTable.items) {
                    let comp = new vscode.CompletionItem(item, vscode.CompletionItemKind.Function);
                    comp.insertText = item + " ";
                    comp.kind = vscode.CompletionItemKind.Keyword;
                    comp.detail = "Blocks from lix.";
                    res.push(comp);
                }
            }
        }
        else if (compiler.typeTable.has("figure") && context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter && context.triggerCharacter == "`") {
            const figureType = compiler.typeTable.get("figure");

            if (this.where(figureType, parser.analysedTree, compiler.sourceText.positionToIndex(new Position(position.line, position.character))!.value)) {
                // let list = this.documentManager.getFileList(document.uri);
                // for (let item of list) {
                //     let comp = new vscode.CompletionItem(item, vscode.CompletionItemKind.File);
                //     res.push(comp);
                // }
            }
        }
        else if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter && context.triggerCharacter == "@") {
            for (let item of parser.references) {
                let comp = new vscode.CompletionItem(item.name, vscode.CompletionItemKind.Reference);
                res.push(comp);
            }
        }
        else if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter && (context.triggerCharacter == "(" || context.triggerCharacter == ",")) {
            const blockType = compiler.typeTable.get("block");
            const argumentsType = compiler.typeTable.get("arguments");
            let node = this.where(blockType, parser.syntaxTree, compiler.sourceText.positionToIndex(new Position(position.line, position.character))!.value);
            if (node) {
                if (context.triggerCharacter == "," && !this.where(argumentsType, parser.syntaxTree, compiler.sourceText.positionToIndex(new Position(position.line, position.character))!.value)) {
                    return res;
                }
                let argNode = node.children.at(0);
                if (context.triggerCharacter == "(" && argNode && argNode.type === argumentsType && argNode.range.begin.value != argNode.range.end.value) {
                    return res;
                }
                let spec = parser.blockTable.getOption(node.content);
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

    inMath(formulaType: Type, syntaxTree: ReadonlyNode, pos: number): boolean {
        let node = syntaxTree;
        outer: while (true) {
            if (node.type === formulaType) {
                return true;
            }
            for (let sub of node.children) {
                if (sub.range.begin.value <= pos && pos < sub.range.end.value) {
                    node = sub;
                    continue outer;
                }
            }
            break;
        }
        // 这两种情况是不同的, 上边是指针位于formula内部,下边是formula位于foumula结尾位置.
        node = syntaxTree;
        outer: while (true) {
            if (node.type === formulaType) {
                return true;
            }
            for (let sub of node.children) {
                if (sub.range.begin.value <= pos && pos <= sub.range.end.value) {
                    node = sub;
                    continue outer;
                }
            }
            return false;
        }
    }

    where(type: Type, oriNode: ReadonlyNode, pos: number): ReadonlyNode | undefined {
        let node = oriNode;
        outer: while (true) {
            if (node.type === type) {
                return node;
            }
            for (let sub of node.children) {
                if (sub.range.begin.value <= pos && pos < sub.range.end.value) {
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
                if (sub.range.begin.value <= pos && pos <= sub.range.end.value) {
                    node = sub;
                    continue outer;
                }
            }
            return undefined;
        }
    }
}

