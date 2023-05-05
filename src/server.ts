import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

let connection = createConnection(ProposedFeatures.all);

let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
    let capabilities = params.capabilities;
    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,

            completionProvider: {
                resolveProvider: true
            }
        }
    };

    return result;
});

documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    let diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: {
            start: textDocument.positionAt(0),
            end: textDocument.positionAt(1)
        },
        message: 'Test',
    };
    let diagnostics: Diagnostic[] = [diagnostic];
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });

}

connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
      // The pass parameter contains the position of the text document in
      // which code complete got requested. For the example we ignore this
      // info and always provide the same completion items.
      return [
        {
          label: 'TypeScript',
          kind: CompletionItemKind.Text,
          data: 1
        },
        {
          label: 'JavaScript',
          kind: CompletionItemKind.Text,
          data: 2
        }
      ];
    }
  );

connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
            item.detail = 'LiX details';
            item.documentation = 'LiX documentation';
        return item;
    }
);


documents.listen(connection);

connection.listen();