import { Parser } from "./parser";
import { Config } from "../compiler/config";
import { FileSystem } from "../compiler/file-system";
import { ParserTexts } from "./texts";
import { TypeTable } from "../syntax-tree/type-table";
import { SourceText } from "./source-text";

export abstract class Module {

    // Compiler
    protected sourceText: SourceText;
    protected typeTable: TypeTable;
    protected config: Config;
    protected fileSystem: FileSystem;
    protected texts: ParserTexts;

    constructor(
        public parser: Parser
    ) {
        this.sourceText = parser.sourceText;
        this.typeTable = parser.compiler.typeTable;
        this.config = parser.compiler.config;
        this.fileSystem = parser.compiler.fileSystem;
        this.texts = parser.compiler.texts.Parser;
    }

    abstract init(): void;

}