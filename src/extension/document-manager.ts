import * as vscode from "vscode";
import { Compiler, ReadonlyCompiler } from "../compiler/compiler";
import { error } from "../foundation/error";
import { Texts } from "./locale";
import { NodePath } from "./file-system/node-path";
import { StructureItem } from "./providers/tree-data-provider";
import { VSCodeConfig } from "./vscode-config";
import { VSCodeFileSystem } from "./file-system/vscode-file-system";
import { VSCodeUri } from "./file-system/vscode-uri";

export class DocumentManager {

    public nodePath: NodePath;
    public vscodeFileSystem: VSCodeFileSystem;

    private compilers: Map<string, Compiler>;
    private nonFileCompiler: Compiler;

    private structureData: Map<string, StructureItem>;

    static readonly selector: vscode.DocumentSelector = [{ language: "lix" }];

    constructor(
        private config: VSCodeConfig,
        private texts: Texts
    ) {
        this.nodePath = new NodePath(this.texts.NodePath);
        this.vscodeFileSystem = new VSCodeFileSystem(this.texts.VSCodeFileSystem);

        this.compilers = new Map();
        this.nonFileCompiler = new Compiler(this.nodePath.uri({ scheme: "file" }), this.config, this.vscodeFileSystem, this.nodePath, this.texts);

        this.structureData = new Map<string, StructureItem>();
    }

    // **************** Management ****************

    add(document: vscode.TextDocument) {
        let name = this.getName(document);
        if (this.compilers.has(name)) {
            error(`Compiler for document '${name}' already exists.`);
        }
        this.compilers.set(name, new Compiler(new VSCodeUri(document.uri), this.config, this.vscodeFileSystem, this.nodePath, this.texts));
    }

    has(document: vscode.TextDocument): boolean {
        let name = this.getName(document);
        return this.compilers.has(name);
    }

    remove(document: vscode.TextDocument) {
        let name = this.getName(document);
        if (!this.compilers.has(name)) {
            error(`Compiler for document '${name}' does not exist.`);
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
            error(`Compiler for document '${name}' does not exist.`);
        }
        return res;
    }

    // Validation

    validate(document: vscode.TextDocument | undefined = vscode.window.activeTextEditor?.document, strict = true): vscode.TextDocument | undefined {
        if (!document) {
            return;
        }
        if (vscode.languages.match(DocumentManager.selector, document) == 10 && (!strict || this.has(document))) {
            return document;
        }
    }

    // **************** Actions ****************

    // Compilers

    parseDocument(document: vscode.TextDocument) {
        let compiler = this.get(document);
        compiler.loadText(document.getText());
        compiler.parse();
    }

    async parse(document: vscode.TextDocument) {
        let compiler = this.get(document);
        await compiler.loadFile();
        compiler.parse();
    }

    generateDocument(document: vscode.TextDocument) {
        let compiler = this.get(document);
        compiler.loadText(document.getText());
        compiler.parse();
        compiler.generate();
    }

    async generate(document: vscode.TextDocument) {
        let compiler = this.get(document);
        await compiler.loadFile();
        compiler.parse();
        await compiler.executeFileRecords();
        compiler.generate();
    }

    async compile(document: vscode.TextDocument) {
        let compiler = this.get(document);
        await compiler.loadFile();
        compiler.parse();
        await compiler.executeFileRecords();
        compiler.generate();
        await compiler.writeOutput();
    }

    getCompiler(document: vscode.TextDocument): ReadonlyCompiler {
        return this.get(document);
    }

    // Non-file Compilers

    parseText(text: string) {
        this.nonFileCompiler.loadText(text);
        this.nonFileCompiler.parse();
    }

    generateText(text: string, generator: string) {
        this.nonFileCompiler.setCurrentGenerator(generator);
        this.nonFileCompiler.loadText(text);
        this.nonFileCompiler.parse();
        this.nonFileCompiler.generate();
    }

    getTextCompiler(): ReadonlyCompiler {
        return this.nonFileCompiler;
    }

    // **************** Structure Data ****************

    setStructureData(document: vscode.TextDocument, data: StructureItem) {
        let name = this.getName(document);
        this.structureData.set(name, data);
    }

    getStructureData(document: vscode.TextDocument): StructureItem | undefined {
        let name = this.getName(document);
        return this.structureData.get(name);
    }
}