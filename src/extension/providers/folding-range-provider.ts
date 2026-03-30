import * as vscode from 'vscode';
import { DocumentManager } from '../document-manager';

export class FoldingRangeProvider implements vscode.FoldingRangeProvider {

    constructor(
        private documentManager: DocumentManager

    ) {
    }

    provideFoldingRanges(allDocument: vscode.TextDocument, context: vscode.FoldingContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FoldingRange[]> {
        let document = this.documentManager.validateDocument(allDocument);
        if (!document) {
            return [];
        }

        let res: vscode.FoldingRange[] = [];
        let parser = this.documentManager.getParseResult(document);
        let typeTable = this.documentManager.getTypeTable(document);

        for (let block of parser.syntaxTree.children) {
            if (block.type === parser.inlineModule.blockType) {
                let start = parser.sourceText.indexToLineAndCharacter(block.begin)!;
                let end = parser.sourceText.indexToLineAndCharacter(block.end)!;
                if (start.line >= end.line) {
                    continue;
                }
                res.push(new vscode.FoldingRange(start.line, end.line));
            }
        }

        const sectionType = typeTable.get("section");
        const subsectionType = typeTable.get("subsection");
        const subsubsectionType = typeTable.get("subsubsection");

        let secStartLine: number | undefined = undefined;
        let subsecStartLine: number | undefined = undefined;
        let subsubsecStartLine: number | undefined = undefined;


        for (let block of parser.analysedTree.children) {
            if (block.type === sectionType) {
                let endLine = parser.sourceText.indexToLineAndCharacter(block.begin - 1)!.line;
                if (secStartLine !== undefined) {
                    res.push(new vscode.FoldingRange(secStartLine, endLine));
                }
                secStartLine = parser.sourceText.indexToLineAndCharacter(block.begin)!.line;
                if (subsecStartLine !== undefined) {
                    res.push(new vscode.FoldingRange(subsecStartLine, endLine));
                }
                subsecStartLine = undefined;
                if (subsubsecStartLine !== undefined) {
                    res.push(new vscode.FoldingRange(subsubsecStartLine, endLine));
                }
                subsubsecStartLine = undefined;
            }
            if (block.type === subsectionType) {
                let endLine = parser.sourceText.indexToLineAndCharacter(block.begin - 1)!.line;
                if (subsecStartLine !== undefined) {
                    res.push(new vscode.FoldingRange(subsecStartLine, endLine));
                }
                subsecStartLine = parser.sourceText.indexToLineAndCharacter(block.begin)!.line;
                if (subsubsecStartLine !== undefined) {
                    res.push(new vscode.FoldingRange(subsubsecStartLine, endLine));
                }
                subsubsecStartLine = undefined;
            }
            if (block.type === subsubsectionType) {
                let endLine = parser.sourceText.indexToLineAndCharacter(block.begin - 1)!.line;
                if (subsubsecStartLine !== undefined) {
                    res.push(new vscode.FoldingRange(subsubsecStartLine, endLine));
                }
                subsubsecStartLine = parser.sourceText.indexToLineAndCharacter(block.begin)!.line;
            }

        }

        let endLine = parser.sourceText.indexToLineAndCharacter(parser.syntaxTree.end - 1)!.line;
        if (secStartLine !== undefined) {
            res.push(new vscode.FoldingRange(secStartLine, endLine));
        }
        if (subsecStartLine !== undefined) {
            res.push(new vscode.FoldingRange(subsecStartLine, endLine));
        }
        if (subsubsecStartLine !== undefined) {
            res.push(new vscode.FoldingRange(subsubsecStartLine, endLine));
        }
        return res;
    }
}