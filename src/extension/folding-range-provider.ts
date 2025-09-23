import * as vscode from 'vscode';
import { LixContext } from './lix-context';

export class LixFoldingRangeProvider implements vscode.FoldingRangeProvider {
    context: LixContext;

    constructor(context: LixContext) {
        this.context = context;
    }

    provideFoldingRanges(document: vscode.TextDocument, context: vscode.FoldingContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FoldingRange[]> {
        let res: vscode.FoldingRange[] = [];
        let parser = this.context.getCompiler(document.uri).parser;

        for(let block of parser.syntaxTree.children) {
            if(block.type === parser.blockType) {
                let start = parser.getLineAndCharacter(block.begin)!;
                let end = parser.getLineAndCharacter(block.end)!;
                if(start.line >= end.line) {
                    continue;
                }
                res.push(new vscode.FoldingRange(start.line, end.line));
            }
        }

        const sectionType = parser.typeTable.get("section")!;
        const subsectionType = parser.typeTable.get("subsection")!;
        const subsubsectionType = parser.typeTable.get("subsubsection")!;

        let secStartLine: number | undefined = undefined;
        let subsecStartLine: number | undefined = undefined;
        let subsubsecStartLine: number | undefined = undefined;


        for(let block of parser.analysedTree.children) {
            if(block.type === sectionType) {
                let endLine = parser.getLineAndCharacter(block.begin -1)!.line;
                if(secStartLine !== undefined) {
                    res.push(new vscode.FoldingRange(secStartLine, endLine));
                }
                secStartLine = parser.getLineAndCharacter(block.begin)!.line;
                if(subsecStartLine !== undefined) {
                    res.push(new vscode.FoldingRange(subsecStartLine, endLine));
                }
                subsecStartLine = undefined;
                if(subsubsecStartLine !== undefined) {
                    res.push(new vscode.FoldingRange(subsubsecStartLine, endLine));
                }
                subsubsecStartLine = undefined;
            }
            if(block.type === subsectionType) {
                let endLine = parser.getLineAndCharacter(block.begin -1)!.line;
                if(subsecStartLine !== undefined) {
                    res.push(new vscode.FoldingRange(subsecStartLine, endLine));
                }
                subsecStartLine = parser.getLineAndCharacter(block.begin)!.line;
                if(subsubsecStartLine !== undefined) {
                    res.push(new vscode.FoldingRange(subsubsecStartLine, endLine));
                }
                subsubsecStartLine = undefined;
            }
            if(block.type === subsubsectionType) {
                let endLine = parser.getLineAndCharacter(block.begin -1)!.line;
                if(subsubsecStartLine !== undefined) {
                    res.push(new vscode.FoldingRange(subsubsecStartLine, endLine));
                }
                subsubsecStartLine = parser.getLineAndCharacter(block.begin)!.line;
            }

        }

        let endLine = parser.getLineAndCharacter(parser.syntaxTree.end - 1)!.line;
        if(secStartLine !== undefined) {
            res.push(new vscode.FoldingRange(secStartLine, endLine));
        }
        if(subsecStartLine !== undefined) {
            res.push(new vscode.FoldingRange(subsecStartLine, endLine));
        }
        if(subsubsecStartLine !== undefined) {
            res.push(new vscode.FoldingRange(subsubsecStartLine, endLine));
        }
        return res;
    }
}