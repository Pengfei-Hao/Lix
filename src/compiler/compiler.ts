import { Config, ReadonlyConfig } from "../common/config";
import { FileSystem } from "../common/file-system/file-system";
import { Path } from "../common/file-system/path";
import { Uri } from "../common/file-system/uri";
import { FileRecord } from "../common/result/file-record";
import { Highlight } from "../common/result/highlight";
import { Message } from "../common/result/message";
import { Reference } from "../common/result/reference";
import { ResultState } from "../common/result/result";
import { ReadonlySourceText, SourceText } from "../common/source-text";
import { ReadonlyNode } from "../common/syntax-tree/node";
import { ReadonlyTypeTable, TypeTable } from "../common/syntax-tree/type-table";
import { Texts } from "../extension/locale";
import { Generator } from "../generator/generator";
import { LatexGenerator } from "../generator/latex-generator";
import { MarkdownGenerator } from "../generator/markdown-generator";
import { MathLatexGenerator } from "../generator/math-latex-generator";
import { ReadonlyMathTable } from "../parser/module/math/math-table";
import { Parser } from "../parser/parser";
import { ReadonlyBlockTable } from "../parser/table/block-table";
import { CommandHandler } from "../parser/table/command-table";
import { EmbedmentHandler } from "../parser/table/embedment-table";
import { ReadonlyHandlerTable } from "../parser/table/handler-table";
import { InsertionHandler, InsertionOption } from "../parser/table/insertion-table";
import { compilerExceptionTexts } from "./texts";

type GeneratorConfig = { outputExtension: string };

export interface ParserResult {
    readonly blockTable: ReadonlyBlockTable;
    readonly insertionTable: ReadonlyHandlerTable<InsertionHandler, InsertionOption>;
    readonly embedmentTable: ReadonlyHandlerTable<EmbedmentHandler, null>;
    readonly commandTable: ReadonlyHandlerTable<CommandHandler, null>;
    readonly mathTable: ReadonlyMathTable;
    readonly syntaxTree: ReadonlyNode;
    readonly analysedTree: ReadonlyNode;
    readonly state: ResultState;
    readonly messages: readonly Message[];
    readonly highlights: readonly Highlight[];
    readonly references: readonly Reference[];
    readonly fileRecords: readonly FileRecord[];
}

export interface GeneratorResult {
    readonly output: string;
    readonly messages: readonly Message[];
}

export interface ReadonlyCompiler {

    readonly config: ReadonlyConfig;
    readonly typeTable: ReadonlyTypeTable;
    readonly sourceText: ReadonlySourceText;
    readonly parserResult: ParserResult;
    readonly generateResult: GeneratorResult;

    getGenerators(): readonly string[];
    getCurrentGenerator(): string;
    setCurrentGenerator(name: string): void;
}

interface InputConfig {

    settings: {
        cacheDirectory: string;
    };

    get(name: string): string;

    set(name: string, content: string): void;
}

export class Compiler implements ReadonlyCompiler {

    private rawConfig: Config;
    private fileSystem: FileSystem;

    private rawTypeTable: TypeTable;
    private rawSourceText: SourceText;

    private parser: Parser;

    private generators: Map<string, Generator>;
    private currentGeneratorName: string;
    private generatorNames: Set<string>;
    private generatorConfigs: Map<string, GeneratorConfig>;


    constructor(fileUri: Uri, config: InputConfig, fileSystem: FileSystem, path: Path, texts: Texts) {

        const workingDirUri = fileUri.joinPath("..");
        const cacheDirUri = workingDirUri.joinPath(config.settings.cacheDirectory);
        this.rawConfig = {
            fileUri: fileUri,
            cacheDirectoryUri: cacheDirUri,
            workingDirectoryUri: workingDirUri,
            outputUri: cacheDirUri,

            settings: config.settings,

            get: config.get.bind(config),
            set: config.set.bind(config)
        }
        this.fileSystem = fileSystem;

        this.rawTypeTable = new TypeTable();
        this.rawSourceText = new SourceText();

        this.parser = new Parser(this.rawConfig, path, texts.Parser, this.rawTypeTable, this.rawSourceText);

        this.generators = new Map();
        this.currentGeneratorName = "latex";
        this.generatorNames = new Set();
        this.generatorConfigs = new Map();

        // let mathLatexGenerator = new MathLatexGenerator(config, path, texts.Generator, this.rawTypeTable, this.rawSourceText);
        // // this.addGenerator("math-latex", mathLatexGenerator, { outputExtension: ".txt" });
        // this.addGenerator(this.currentGeneratorName, new LatexGenerator(config, path, texts.Generator, this.rawTypeTable, this.rawSourceText, mathLatexGenerator), { outputExtension: ".tex" });
        // this.addGenerator("markdown", new MarkdownGenerator(config, path, texts.Generator, this.rawTypeTable, this.rawSourceText, mathLatexGenerator), { outputExtension: ".md" });
        // this.addGenerator("blog", new MarkdownGenerator(config, path, texts.Generator, this.rawTypeTable, this.rawSourceText, mathLatexGenerator), { outputExtension: ".md" });

        // const name = fileUri.stem + this.generatorConfigs.get(this.currentGeneratorName)!.outputExtension;
        // this.rawConfig.outputUri = cacheDirUri.joinPath(name);
    }

    public get config(): ReadonlyConfig {
        return this.rawConfig;
    }

    public get typeTable(): ReadonlyTypeTable {
        return this.rawTypeTable;
    }

    public get sourceText(): ReadonlySourceText {
        return this.rawSourceText;
    }

    // **************** Generators ****************

    private addGenerator(name: string, generator: Generator, config: GeneratorConfig) {
        if (this.generators.has(name)) {
            throw new Error(compilerExceptionTexts.GeneratorAlreadyExists.format(name));
        }
        this.generators.set(name, generator);
        this.generatorNames.add(name);
        this.generatorConfigs.set(name, config);
    }

    getGenerators(): readonly string[] {
        return Array.from(this.generatorNames);
    }

    setCurrentGenerator(name: string) {
        if (!this.generators.has(name)) {
            throw new Error(compilerExceptionTexts.GeneratorNotExist.format(name));
        }
        this.currentGeneratorName = name;
        const filename = this.rawConfig.fileUri.stem + this.generatorConfigs.get(this.currentGeneratorName)!.outputExtension;
        this.rawConfig.outputUri = this.rawConfig.cacheDirectoryUri.joinPath(filename);
    }

    getCurrentGenerator(): string {
        return this.currentGeneratorName;
    }

    // **************** Load ****************

    async loadFile() {
        let text = await this.fileSystem.readTextFile(this.config.fileUri);
        if (text === undefined) {
            return;
        }
        this.rawSourceText.load(text);
    }

    loadText(text: string) {
        this.rawSourceText.load(text);
    }

    // **************** Parse ****************

    parse() {
        this.parser.parse();
    }

    public get parserResult(): ParserResult {
        return this.parser;
    }

    // **************** Operate Files ****************

    async executeFileRecords() {
        await this.fileSystem.createDirectory(this.config.cacheDirectoryUri);
        await this.parser.fileRecordList.execute(this.fileSystem);
    }

    // **************** Generate ****************

    generate() {
        let generator = this.generators.get(this.currentGeneratorName)!;
        generator.generate(this.parser.analysedTree, this.parser.references, this.parser.fileRecordList);
    }

    public get generateResult(): GeneratorResult {
        return this.generators.get(this.currentGeneratorName)!;
    }

    // **************** Write File ****************

    async writeOutput() {
        await this.fileSystem.writeTextFile(this.config.outputUri, this.generateResult.output);
    }
}