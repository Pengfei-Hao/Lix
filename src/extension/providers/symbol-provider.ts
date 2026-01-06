import * as vscode from 'vscode';
import { DocumentManager } from '../document-manager';
import { Node } from '../../syntax-tree/node'

export class SymbolProvider implements vscode.DocumentSymbolProvider {

    constructor(
        private documentManager: DocumentManager
    ) {
    }

    provideDocumentSymbols(allDocument: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        const document = this.documentManager.validateDocument(allDocument);
        if (!document) {
            return [];
        }

        const parser = this.documentManager.getParseResult(document);
        const typeTable = this.documentManager.getTypeTable(document);

        const sectionType = typeTable.get("section");
        const subsectionType = typeTable.get("subsection");
        const subsubsectionType = typeTable.get("subsubsection");
        const bibliographyType = typeTable.get("bibliography");

        const titleType = typeTable.get("title");
        const authorType = typeTable.get("author");
        const dateType = typeTable.get("date");
        const tableofcontentsType = typeTable.get("tableofcontents");
        const definitionType = typeTable.get("definition");
        const lemmaType = typeTable.get("lemma");
        const propositionType = typeTable.get("proposition");
        const theoremType = typeTable.get("theorem");
        const proofType = typeTable.get("proof");
        const corollaryType = typeTable.get("corollary");

        const figureType = typeTable.get("figure");
        const codeType = typeTable.get("code");
        const listType = typeTable.get("list");
        const tableType = typeTable.get("table");
        const captionType = typeTable.get("caption");

        const paragraphType = typeTable.get("paragraph");
        const wordsType = typeTable.get("words");

        let secIdx = 0;
        let subIdx = 0;
        let subsubIdx = 0;

        let mathIdx = 0;

        let figIdx = 0;
        let codeIdx = 0;
        let listIdx = 0;
        let tableIdx = 0;

        let symbols: vscode.DocumentSymbol = new vscode.DocumentSymbol("Document", "", vscode.SymbolKind.Namespace, new vscode.Range(0, 0, 0, 0), new vscode.Range(0, 0, 0, 0));

        let secParent = symbols;
        let subParent = symbols;
        let subsubParent = symbols;
        let parent = symbols;

        const getWords = (node: Node) => node.children.filter(child => child.type === wordsType).map(child => child.content).join(" ");

        const getCaption = (node: Node) => {
            let captionNode = node.children.find(child => child.type === captionType);
            return captionNode ? getWords(captionNode) : "";
        };
        for (let node of parser.analysedTree.children) {
            const start = parser.getLineAndCharacter(node.begin);
            const end = parser.getLineAndCharacter(node.end);
            const range = new vscode.Range(start.line, start.character, end.line, end.character);
            if (node.type === sectionType) {
                secIdx++;
                subIdx = 0;
                subsubIdx = 0;
                let symbol = new vscode.DocumentSymbol(`${secIdx} ${getWords(node)}`, "", vscode.SymbolKind.Class, range, range);
                subParent = symbol;
                subsubParent = symbol;
                parent = symbol;
                secParent.children.push(symbol);
            }
            if (node.type === subsectionType) {
                subIdx++;
                subsubIdx = 0;
                let symbol = new vscode.DocumentSymbol(`${secIdx}.${subIdx} ${getWords(node)}`, "", vscode.SymbolKind.Class, range, range);
                subsubParent = symbol;
                parent = symbol;
                subParent.children.push(symbol);
            }
            if (node.type === subsubsectionType) {
                subsubIdx++;
                let symbol = new vscode.DocumentSymbol(`${secIdx}.${subIdx}.${subsubIdx} ${getWords(node)}`, "", vscode.SymbolKind.Class, range, range)
                parent = symbol;
                symbols.children.push(symbol);
            }
            if (node.type === bibliographyType) {
                secIdx++;
                subIdx = 0;
                subsubIdx = 0;
                let symbol = new vscode.DocumentSymbol(`Bibliography`, "", vscode.SymbolKind.Class, range, range)
                subParent = symbol;
                subsubParent = symbol;
                parent = symbol;
                symbols.children.push(symbol);
            }

            if (node.type === titleType) {
                parent.children.push(new vscode.DocumentSymbol(`${getWords(node)}`, "", vscode.SymbolKind.TypeParameter, range, range));
            }
            if (node.type === authorType) {
                parent.children.push(new vscode.DocumentSymbol(`Author: ${getWords(node)}`, "", vscode.SymbolKind.String, range, range));
            }
            if (node.type === dateType) {
                parent.children.push(new vscode.DocumentSymbol(`Date: ${getWords(node)}`, "", vscode.SymbolKind.TypeParameter, range, range));
            }
            if (node.type === tableofcontentsType) {
                parent.children.push(new vscode.DocumentSymbol(`Table of Contents`, "", vscode.SymbolKind.Constant, range, range));
            }

            if ([definitionType, lemmaType, propositionType, theoremType, proofType, corollaryType].includes(node.type)) {
                mathIdx++;
                let label = "";
                if (node.type === definitionType) label = "Def";
                if (node.type === lemmaType) label = "Lemma";
                if (node.type === propositionType) label = "Prop";
                if (node.type === theoremType) label = "Thm";
                if (node.type === proofType) label = "Proof";
                if (node.type === corollaryType) label = "Coro";
                parent.children.push(new vscode.DocumentSymbol(`${label} ${mathIdx} ${getWords(node)}`, "", vscode.SymbolKind.Number, range, range));
            }

            if (node.type === paragraphType) {
                for (let parNode of node.children) {
                    const start = parser.getLineAndCharacter(parNode.begin);
                    const end = parser.getLineAndCharacter(parNode.end);
                    const range = new vscode.Range(start.line, start.character, end.line, end.character);

                    if (parNode.type === figureType) {
                        figIdx++;
                        parent.children.push(new vscode.DocumentSymbol(`Figure ${figIdx} ${getCaption(parNode)}`, "", vscode.SymbolKind.Array, range, range));
                    }
                    if (parNode.type === codeType) {
                        codeIdx++;
                        parent.children.push(new vscode.DocumentSymbol(`Code ${codeIdx} ${getCaption(parNode)}`, "", vscode.SymbolKind.Array, range, range));
                    }
                    if (parNode.type === listType) {
                        listIdx++;
                        parent.children.push(new vscode.DocumentSymbol(`List ${listIdx} ${getCaption(parNode)}`, "", vscode.SymbolKind.Array, range, range));
                    }
                    if (parNode.type === tableType) {
                        tableIdx++;
                        parent.children.push(new vscode.DocumentSymbol(`Table ${tableIdx} ${getCaption(parNode)}`, "", vscode.SymbolKind.Array, range, range));
                    }
                }
            }
        }
        return symbols.children;
    }
}