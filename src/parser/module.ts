import { Parser } from "./parser";
import { Config } from "../compiler/config";
import { FileSystem } from "../compiler/file-system";
import { ParserTexts } from "./texts";
import { TypeTable } from "../syntax-tree/type-table";

export abstract class Module {

    // Compiler
    protected typeTable: TypeTable;
    protected config: Config;
    protected fileSystem: FileSystem;
    protected texts: ParserTexts;

    constructor(
        public parser: Parser
    ) {
        this.typeTable = parser.compiler.typeTable;
        this.config = parser.compiler.config;
        this.fileSystem = parser.compiler.fileSystem;
        this.texts = parser.compiler.texts.Parser;
    }

    abstract init(): void;

}