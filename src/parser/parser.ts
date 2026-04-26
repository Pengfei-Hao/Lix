import { Config } from "../common/config";
import { Path } from "../common/file-system/path";
import { FileRecord, ReadonlyFileRecordList } from "../common/result/file-record";
import { Highlight } from "../common/result/highlight";
import { Message } from "../common/result/message";
import { NodeResult } from "../common/result/parsing-result";
import { Reference } from "../common/result/reference";
import { ResultState } from "../common/result/result";
import { SourceText } from "../common/source-text";
import { Node, ReadonlyNode } from "../common/syntax-tree/node";
import { Type, TypeTable } from "../common/syntax-tree/type-table";
import { ArticleModule } from "./module/article-module";
import { BasicModule } from "./module/basic-module";
import { CoreModule } from "./module/core-module";
import { MathModule } from "./module/math/math-module";
import { ReadonlyMathTable } from "./module/math/math-table";
import { Module } from "./module/module";
import { ParserModule } from "./module/parser-module";
import { ReadonlyBlockTable } from "./table/block-table";
import { CommandHandler } from "./table/command-table";
import { EmbedmentHandler } from "./table/embedment-table";
import { ReadonlyHandlerTable } from "./table/handler-table";
import { InsertionHandler, InsertionOption } from "./table/insertion-table";
import { ParserTexts } from "./texts";

export class Parser {

    // Environment
    private emptyType: Type;
    private sourceText: SourceText;

    // Modules
    private modules: Module[];
    private parserModule: ParserModule;
    private coreModule: CoreModule;
    private mathModule: MathModule;
    private basicModule: BasicModule;
    private articleModule: ArticleModule;

    // Result
    private result: NodeResult;

    constructor(config: Config, path: Path, texts: ParserTexts, typeTable: TypeTable, sourceText: SourceText) {

        this.emptyType = typeTable.emptyType;
        this.sourceText = sourceText;

        this.parserModule = new ParserModule(config, path, texts, typeTable, sourceText);
        this.coreModule = new CoreModule(config, path, texts, typeTable, sourceText, this.parserModule);
        this.mathModule = new MathModule(config, path, texts, typeTable, sourceText, this.parserModule, this.coreModule);
        this.basicModule = new BasicModule(config, path, texts, typeTable, sourceText, this.parserModule, this.coreModule);
        this.articleModule = new ArticleModule(config, path, texts, typeTable, sourceText, this.parserModule, this.coreModule);
        this.modules = [this.parserModule, this.coreModule, this.mathModule, this.basicModule, this.articleModule];

        this.result = new NodeResult(new Node(this.emptyType, this.sourceText.fullRange), new Node(this.emptyType, this.sourceText.fullRange));
    }

    get blockTable(): ReadonlyBlockTable {
        return this.parserModule.blockTable;
    }

    get insertionTable(): ReadonlyHandlerTable<InsertionHandler, InsertionOption> {
        return this.parserModule.insertionTable;
    }

    get embedmentTable(): ReadonlyHandlerTable<EmbedmentHandler, null> {
        return this.parserModule.embedmentTable;
    }

    get commandTable(): ReadonlyHandlerTable<CommandHandler, null> {
        return this.parserModule.commandTable;
    }

    get mathTable(): ReadonlyMathTable {
        return this.mathModule.mathTable;
    }

    get syntaxTree(): ReadonlyNode {
        return this.result.node;
    }

    get analysedTree(): ReadonlyNode {
        return this.result.analysedNode;
    }

    get state(): ResultState {
        return this.result.state;
    }

    get messages(): readonly Message[] {
        return this.result.messageList.items;
    }

    get highlights(): readonly Highlight[] {
        return this.result.highlightList.items;
    }

    get references(): readonly Reference[] {
        return this.result.referenceList.items;
    }

    get fileRecords(): readonly FileRecord[] {
        return this.result.fileRecordList.items;
    }

    get fileRecordList(): ReadonlyFileRecordList {
        return this.result.fileRecordList;
    }

    // *********** Init and Parse ***************

    private init() {
        this.result = new NodeResult(new Node(this.emptyType, this.sourceText.fullRange), new Node(this.emptyType, this.sourceText.fullRange));
    }

    parse() {
        this.init();
        for (let module of this.modules) {
            module.init();
        }
        this.result = this.coreModule.matchDocument();
    }
}