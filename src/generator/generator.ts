import { Config } from "../common/config";
import { Path } from "../common/file-system/path";
import { ReadonlyFileRecordList } from "../common/result/file-record";
import { Message } from "../common/result/message";
import { Reference } from "../common/result/reference";
import { SourceText } from "../common/source-text";
import { Node, ReadonlyNode } from "../common/syntax-tree/node";
import { Type, TypeTable } from "../common/syntax-tree/type-table";
import "../foundation/format";
import { GeneratorTexts } from "./texts";

export abstract class Generator {

    // **************** Types ****************

    protected documentType: Type;

    protected commandType: Type;
    protected insertionType: Type;
    protected embedmentType: Type;

    protected paragraphType: Type;
    protected textType: Type;
    protected wordsType: Type;
    protected escapeCharType: Type;

    protected blockType: Type;
    protected argumentsType: Type;
    protected argumentType: Type;
    protected nameType: Type;
    protected stringType: Type;
    protected numberType: Type;

    protected settingType: Type;
    protected settingParameterType: Type;
    protected referenceType: Type;

    // **************** Output ****************

    protected rawOutput: string;

    constructor(
        protected config: Config,
        protected path: Path,
        protected texts: GeneratorTexts,

        protected typeTable: TypeTable,
        protected sourceText: SourceText
    ) {

        this.rawOutput = "";

        // parser

        this.documentType = this.typeTable.get("document");

        this.commandType = this.typeTable.get("command");
        this.insertionType = this.typeTable.get("insertion");
        this.embedmentType = this.typeTable.get("embedment");

        this.paragraphType = this.typeTable.get("paragraph");
        this.textType = this.typeTable.get("text");
        this.wordsType = this.typeTable.get("words");
        this.escapeCharType = this.typeTable.get("escape-char");

        this.blockType = this.typeTable.get("block");
        this.argumentsType = this.typeTable.get("arguments");
        this.argumentType = this.typeTable.get("argument");
        this.nameType = this.typeTable.get("name");
        this.stringType = this.typeTable.get("string");
        this.numberType = this.typeTable.get("number");

        this.settingType = this.typeTable.get("setting");
        this.settingParameterType = this.typeTable.get("setting-parameter");
        this.referenceType = this.typeTable.get("reference");
    }

    public abstract get output(): string;

    public abstract get messages(): readonly Message[];


    protected abstract init(): void;

    abstract generate(syntaxTree: ReadonlyNode, references: readonly Reference[], fileRecordList: ReadonlyFileRecordList): void;

    // **************** Assistant Function ****************

    protected getArgument(node: Node, name: string): string | undefined {
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

    protected removeArguments(node: Node): Node[] {
        if (node.children.length === 0 || node.children[0].type !== this.argumentsType) {
            return node.children;
        }
        return node.children.slice(1);
    }

    protected getReferences(node: Node): string[] {
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