import * as vscode from 'vscode';
import { DocumentManager } from '../document-manager';
import { HighlightType } from "../../common/result/highlight";

export class SemanticProvider implements vscode.DocumentSemanticTokensProvider {

    constructor(
        private documentManager: DocumentManager,
        private legend: vscode.SemanticTokensLegend) {
    }

    provideDocumentSemanticTokens(allDocument: vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens> {

        // analyze the document and return semantic tokens

        let document = this.documentManager.validate(allDocument);
        if (!document) {
            return;
        }

        const tokensBuilder = new vscode.SemanticTokensBuilder(this.legend);
        // on line 1, characters 1-5 are a class declaration

        let compiler = this.documentManager.getCompiler(document);
        let parser = compiler.parserResult;
        let highlights = parser.highlights;
        for (let hlt of highlights) {
            let type = "";
            switch (hlt.type) {
                case HighlightType.operator:
                    type = "class";
                    break;
                case HighlightType.keyword:
                    type = "keyword";
                    break;
                case HighlightType.variable:
                    type = "variable";
                    break;
                case HighlightType.string:
                case HighlightType.number:
                    type = "string";
                    break;
                case HighlightType.comment:
                    type = "comment";
                    break;
            }
            let lp = compiler.sourceText.indexToPosition(hlt.range.begin);
            let lpe = compiler.sourceText.indexToPosition(hlt.range.end);

            if (lp.line != lpe.line) {
                console.log(`${lp.line},${lp.character}:${lpe.line},${lpe.character}`);
            }
            if (lp.line == lpe.line && lp.character == lpe.character) {
                console.log(`${lp.line},${lpe.line}`);
            }

            tokensBuilder.push(
                new vscode.Range(new vscode.Position(lp.line, lp.character), new vscode.Position(lpe.line, lpe.character)),
                type,
                []
            );
        }

        return tokensBuilder.build();
    }
};