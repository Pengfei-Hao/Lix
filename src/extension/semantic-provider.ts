import * as vscode from 'vscode';
import { LixContext } from './lix-context';
import { HighlightType } from '../foundation/result';
import { parseFromDocument } from '../extension';

export class LixSemanticProvider implements vscode.DocumentSemanticTokensProvider {

  context: LixContext;
  legend: vscode.SemanticTokensLegend;

  constructor(context: LixContext, legend: vscode.SemanticTokensLegend) {
    this.context = context;
    this.legend = legend;
  }

  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens> {
    
    // analyze the document and return semantic tokens
    parseFromDocument(document);

    const tokensBuilder = new vscode.SemanticTokensBuilder(this.legend);
    // on line 1, characters 1-5 are a class declaration
    
    let parser = this.context.getCompiler(document.uri).parser;
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
      let lp = parser.getLineAndCharacter(hlt.begin) ?? { line: -1, character: -1 };
      let lpe = parser.getLineAndCharacter(hlt.end) ?? { line: -1, character: -1 };

      if(lp.line != lpe.line) {
        console.log(`${lp.line},${lp.character}:${lpe.line},${lpe.character}`);
      }
      if(lp.line == -1 || lpe.line == -1) {
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