import * as vscode from 'vscode';
import { DocumentManager } from '../document-manager';

export interface VersionToolParameters {
    format?: string;
}

export class VersionTool implements vscode.LanguageModelTool<VersionToolParameters> {

    prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<VersionToolParameters>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: "获取 Lix 版本信息",
            confirmationMessages: {
                title: "确认获取 Lix 版本信息吗？",
                message: "该操作将调用 Lix 命令行工具以获取版本信息。"
            }
        }
    }

    invoke(options: vscode.LanguageModelToolInvocationOptions<VersionToolParameters>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.LanguageModelToolResult> {
        const params = options.input;
        console.log(`VersionTool: ${params.format}`);
        let long = (params.format === "long") ? true : false;
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(long ? "Lix version 1.2.3 (long format)" : "Lix 1.2.3")]);
    }
}

export interface TextParameters {
    text?: string;
}

export class SyntaxTreeTool implements vscode.LanguageModelTool<TextParameters> {

    constructor(
        private documentManager: DocumentManager
    ) {
    }

    prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<TextParameters>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: "获取 Lix 语法树信息"
        }
    }

    invoke(options: vscode.LanguageModelToolInvocationOptions<TextParameters>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.LanguageModelToolResult> {
        const params = options.input;
        let result = "";
        console.log(`SyntaxTreeTool: ${params.text}`);
        if (params.text) {
            result = this.documentManager.parseWithoutDocument(params.text).analysedTree.toString();
        }
        else {
            let document = this.documentManager.validateDocument();
            if (document) {
                this.documentManager.parseDocument(document);
                result = this.documentManager.getParseResult(document).analysedTree.toString();
            }
        }
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result)]);
    }
}

export class ParseMessagesTool implements vscode.LanguageModelTool<TextParameters> {

    constructor(
        private documentManager: DocumentManager
    ) {
    }

    prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<TextParameters>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: "获取 Lix 报错信息"
        }
    }

    invoke(options: vscode.LanguageModelToolInvocationOptions<TextParameters>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.LanguageModelToolResult> {
        const params = options.input;
        console.log(`ParseMessagesTool: ${params.text}`);
        let result = "";
        if (params.text) {
            result = this.documentManager.parseWithoutDocument(params.text).messages.map(msg => msg.toString()).join("\n");
        }
        else {
            let document = this.documentManager.validateDocument();
            if (document) {
                this.documentManager.parseDocument(document);
                result = this.documentManager.getParseResult(document).messages.map(msg => msg.toString()).join("\n");
            }
        }
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result)]);
    }
}

export class MarkdownOutputTool implements vscode.LanguageModelTool<TextParameters> {

    constructor(
        private documentManager: DocumentManager
    ) {
    }

    prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<TextParameters>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: "获取 Lix 输出 Markdown 格式内容"
        }
    }

    invoke(options: vscode.LanguageModelToolInvocationOptions<TextParameters>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.LanguageModelToolResult> {
        const params = options.input;
        console.log(`MarkdownOutputTool: ${params.text}`);
        let result = "";
        if (params.text) {
            result = this.documentManager.generateWithoutDocument(params.text, 'markdown').output;
        }
        else {
            let document = this.documentManager.validateDocument();
            if (document) {
                let lastGenerator = this.documentManager.getGenerator(document);
                this.documentManager.setGenerator(document, 'markdown');
                this.documentManager.generateDocument(document);
                result = this.documentManager.getGenerateResult(document).output;
                this.documentManager.setGenerator(document, lastGenerator);
            }
        }
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result)]);
    }
}

export class LatexOutputTool implements vscode.LanguageModelTool<TextParameters> {

    constructor(
        private documentManager: DocumentManager
    ) {
    }

    prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<TextParameters>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: "获取 Lix 输出 LaTeX 格式内容"
        }
    }

    invoke(options: vscode.LanguageModelToolInvocationOptions<TextParameters>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.LanguageModelToolResult> {
        const params = options.input;
        console.log(`LatexOutputTool: ${params.text}`);
        let result = "";
        if (params.text) {
            result = this.documentManager.generateWithoutDocument(params.text, 'latex').output;
        }
        else {
            let document = this.documentManager.validateDocument();
            if (document) {
                let lastGenerator = this.documentManager.getGenerator(document);
                this.documentManager.setGenerator(document, 'latex');
                this.documentManager.generateDocument(document);
                result = this.documentManager.getGenerateResult(document).output;
                this.documentManager.setGenerator(document, lastGenerator);
            }
        }
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result)]);
    }
}

export class OutputUriTool implements vscode.LanguageModelTool<null> {

    constructor(
        private documentManager: DocumentManager
    ) {
    }

    prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<null>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: "获取 Lix 输出 Uri"
        }
    }

    invoke(options: vscode.LanguageModelToolInvocationOptions<null>, token: vscode.CancellationToken): vscode.ProviderResult<vscode.LanguageModelToolResult> {
        let document = this.documentManager.validateDocument();
        console.log(`OutputUriTool`);
        let result = "";
        if (document) {
            result = this.documentManager.getCompileResult(document).outputUri.toString();
        }
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(result)]);
    }
}