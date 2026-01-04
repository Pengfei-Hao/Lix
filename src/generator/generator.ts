import { Config } from "../compiler/config";
import { FileSystem } from "../compiler/file-system";
import { Reference } from "../parser/result";
import { Node } from "../syntax-tree/node";
import { Type } from "../syntax-tree/type";
import { TypeTable } from "../syntax-tree/type-table";
import "../foundation/format";
import { GeneratorTexts } from "./texts";
import { Compiler } from "../compiler/compiler";

export abstract class Generator {

    // Compiler
    compiler: Compiler;
    protected typeTable: TypeTable;
    protected config: Config;
    protected fileSystem: FileSystem;
    protected texts: GeneratorTexts;

    // **************** Types ****************

    documentType: Type;
    settingType: Type;
    settingParameterType: Type;
    paragraphType: Type;
    textType: Type;
    wordsType: Type;
    argumentsType: Type;
    argumentType: Type;
    nameType: Type;
    stringType: Type;
    numberType: Type;
    referenceType: Type;

    constructor(compiler: Compiler) {

        this.compiler = compiler;
        this.typeTable = compiler.typeTable;
        this.config = compiler.config;
        this.fileSystem = compiler.fileSystem;
        this.texts = compiler.texts.Generator;

        this.output = "";

        // parser

        this.documentType = this.typeTable.get("document");
        this.settingType = this.typeTable.get("setting");
        this.settingParameterType = this.typeTable.get("setting-parameter");
        this.paragraphType = this.typeTable.get("paragraph");
        this.textType = this.typeTable.get("text");
        this.wordsType = this.typeTable.get("words");
        this.argumentsType = this.typeTable.get("arguments");
        this.argumentType = this.typeTable.get("argument");
        this.nameType = this.typeTable.get("name");
        this.stringType = this.typeTable.get("string");
        this.numberType = this.typeTable.get("number");
        this.referenceType = this.typeTable.get("reference");
    }

    output: string;

    abstract init(): void;

    abstract generate(syntaxTree: Node, references: Reference[]): void;

    // **************** Assistant Function ****************

    getArgument(node: Node, name: string): string | undefined {
        if (node.children.length === 0) {
            return undefined;
        }
        let args = node.children[0];
        if (args.type !== this.argumentsType) {
            return undefined;
        }

        let found: string | undefined;
        args.children.forEach(argNode => {
            if (argNode.type === this.argumentType && argNode.content === name) {
                found = argNode.children[0].content;
            }
        });
        return found;
    }

    removeArguments(node: Node): Node[] {
        if (node.children.length === 0 || node.children[0].type !== this.argumentsType) {
            return node.children;
        }
        return node.children.slice(1);
    }

    getReferences(node: Node): string[] {
        if (node.children.length === 0) {
            return [];
        }
        let args = node.children[0];

        let refs: string[] = [];
        args.children.forEach(argNode => {
            if (argNode.type === this.referenceType) {
                refs.push(argNode.content);
            }
        });
        return refs;
    }

}