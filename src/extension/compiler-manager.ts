import * as vscode from "vscode";
import { Parser } from "../parser/parser";
import { VSCodeConfig } from "./vscode-config";
import { Generator } from "../generator/generator";
import { Compiler } from "../compiler/compiler";
import { VSCodeFileSystem } from "./vscode-file-system";
import { NodePath } from "./node-path";
import { Texts } from "./locale";
import { LixError } from "../foundation/error";
import { FileSystem } from "../compiler/file-system";
import { Uri } from "../compiler/uri";

export class CompilerManager {

    private compilers: Map<string, Compiler>;

    private nodePath: NodePath;

    static docSel: vscode.DocumentSelector = [{ scheme: "file", language: "lix" }];


    constructor(
        public config: VSCodeConfig,
        public texts: Texts
    ) {
        this.compilers = new Map();
        this.nodePath = new NodePath(this.texts.NodePath);
    }

    // Management

    add(document: vscode.TextDocument) {
        let name = this.getName(document);
        if (this.compilers.has(name)) {
            throw new LixError(`Compiler for document '${name}' already exists.`);
        }
        this.compilers.set(name, new Compiler(this.config, new VSCodeFileSystem(document.uri, this.nodePath, this.texts.VSCodeFileSystem), this.texts));
    }

    has(document: vscode.TextDocument): boolean {
        let name = this.getName(document);
        return this.compilers.has(name);
    }

    remove(document: vscode.TextDocument) {
        let name = this.getName(document);
        if (!this.compilers.has(name)) {
            throw new LixError(`Compiler for document '${name}' does not exist.`);
        }
        this.compilers.delete(name);
    }

    private getName(document: vscode.TextDocument): string {
        return document.uri.toString();
    }

    private get(document: vscode.TextDocument): Compiler {
        let name = this.getName(document);
        let res = this.compilers.get(name);
        if (!res) {
            throw new LixError(`Compiler for document '${name}' does not exist.`);
        }
        return res;
    }

    // Actions

    parseDocument(document: vscode.TextDocument) {
        let compiler = this.get(document);
        compiler.parseText(document.getText());
    }

    parse(document: vscode.TextDocument) {
        let compiler = this.get(document);
        compiler.parse();
    }

    generateDocument(document: vscode.TextDocument) {
        let compiler = this.get(document);
        compiler.generateText(document.getText());
    }

    async generate(document: vscode.TextDocument) {
        let compiler = this.get(document);
        await compiler.generate();
    }

    async compile(document: vscode.TextDocument) {
        let compiler = this.get(document);
        await compiler.compile();
    }

    // Environment

    getFileSystem(document: vscode.TextDocument): FileSystem {
        let compiler = this.get(document);
        return compiler.fileSystem;
    }

    getTypeTable(document: vscode.TextDocument) {
        let compiler = this.get(document);
        return compiler.typeTable;
    }

    getGenerator(document: vscode.TextDocument): string {
        let compiler = this.get(document);
        return compiler.getCurrentGeneratorName();
    }

    setGenerator(document: vscode.TextDocument, name: string) {
        let compiler = this.get(document);
        compiler.setCurrentGenerator(name);
    }

    getGenerators(document: vscode.TextDocument): string[] {
        let compiler = this.get(document);
        return compiler.getGeneratorNames();
    }

    // Results

    getParseResult(document: vscode.TextDocument) {
        let compiler = this.get(document);
        return compiler.parser;
        // {
        //     syntaxTree: compiler.parser.syntaxTree,
        //     analysedTree: compiler.parser.analysedTree,
        //     state: compiler.parser.state,
        //     messages: compiler.parser.messages,
        //     highlights: compiler.parser.highlights,
        //     references: compiler.parser.references,
        //     fileRecords: compiler.parser.fileRecords,
        //     getLineAndCharacter: compiler.parser.getLineAndCharacter.bind(compiler.parser),
        //     getIndex: compiler.parser.getIndex.bind(compiler.parser)
        // };
        // return compiler.parser;
        // // Ranges of every line
        // lineRanges: number[];

        // // Stack of 'match' function
        // process: string[];
    }

    getGenerateResult(document: vscode.TextDocument): { output: string } {
        let compiler = this.get(document);
        return { output: compiler.getCurrentGenerator().output };
    }

    getCompileResult(document: vscode.TextDocument): { outputUri: Uri } {
        let compiler = this.get(document);
        return { outputUri: compiler.getOutputUri() };
    }

    // Validation

    validateDocument(document: vscode.TextDocument | undefined = vscode.window.activeTextEditor?.document, strict = true): vscode.TextDocument | undefined {
        if (!document) {
            return;
        }
        if (vscode.languages.match(CompilerManager.docSel, document) == 10 && (!strict || this.has(document))) {
            return document;
        }
    }
}