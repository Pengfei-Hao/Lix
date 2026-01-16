import { Texts } from "../extension/locale";
import { Generator } from "../generator/generator";
import { LatexGenerator } from "../generator/latex-generator";
import { MarkdownGenerator } from "../generator/markdown-generator";
import { MathLatexGenerator } from "../generator/math-latex-generator";
import { Parser } from "../parser/parser";
import { TypeTable } from "../syntax-tree/type-table";
import { Config } from "./config";
import { FileSystem } from "./file-system";
import { compilerExceptionTexts } from "./texts";

type GeneratorConfig = { outputExtension: string };

export class Compiler {

    typeTable: TypeTable;
    parser: Parser;

    generators: Map<string, Generator>;
    private currentGeneratorName: string;
    private generatorNames: Set<string>;
    private generatorConfigs: Map<string, GeneratorConfig>;


    constructor(
        public config: Config,
        public fileSystem: FileSystem,
        public texts: Texts
    ) {
        this.typeTable = new TypeTable();
        this.parser = new Parser(this);
        this.generators = new Map();
        this.generatorNames = new Set();
        this.generatorConfigs = new Map();

        this.currentGeneratorName = "latex";

        let mathLatexGenerator = new MathLatexGenerator(this);
        this.addGenerator("math-latex", mathLatexGenerator, { outputExtension: ".txt" });
        this.addGenerator(this.currentGeneratorName, new LatexGenerator(this, mathLatexGenerator), { outputExtension: ".tex" });
        this.addGenerator("markdown", new MarkdownGenerator(this, mathLatexGenerator, "markdown"), { outputExtension: ".md" });
        this.addGenerator("blog", new MarkdownGenerator(this, mathLatexGenerator, "blog"), { outputExtension: ".md" });
    }

    private addGenerator(name: string, generator: Generator, config: GeneratorConfig) {
        if (this.generators.has(name)) {
            throw new Error(compilerExceptionTexts.GeneratorAlreadyExists.format(name));
        }
        this.generators.set(name, generator);
        this.generatorNames.add(name);
        this.generatorConfigs.set(name, config);
    }

    getGeneratorNames(): string[] {
        return Array.from(this.generatorNames);
    }

    setCurrentGenerator(name: string) {
        if (!this.generators.has(name)) {
            throw new Error(compilerExceptionTexts.GeneratorNotExist.format(name));
        }
        this.currentGeneratorName = name;
    }

    getCurrentGenerator(): Generator {
        return this.generators.get(this.currentGeneratorName)!;
    }

    getCurrentGeneratorName(): string {
        return this.currentGeneratorName;
    }

    private readFile(): Promise<string | undefined> {
        return this.fileSystem.readTextFile(this.fileSystem.fileUri);
    }

    async parse() {
        let text = await this.readFile();
        if (text === undefined) {
            return;
        }
        this.parseText(text);
    }

    parseText(text: string) {
        this.parser.parse(text);
    }

    async generate() {
        let text = await this.readFile();
        if (text === undefined) {
            return;
        }
        this.parseText(text);
        let generator = this.getCurrentGenerator();
        await this.fileSystem.createDirectory(this.fileSystem.cacheDirectoryUri);
        await this.fileSystem.executeRecords(this.parser.fileRecords);
        generator.generate(this.parser.analysedTree, this.parser.references);
    }

    generateText(text: string) {
        this.parseText(text);
        let generator = this.getCurrentGenerator();
        generator.generate(this.parser.analysedTree, this.parser.references);
    }

    getOutputUri() {
        let name = this.fileSystem.fileUri.stem + this.generatorConfigs.get(this.currentGeneratorName)!.outputExtension;
        return this.fileSystem.cacheDirectoryUri.joinPath(name);
    }

    async compile() {
        await this.generate();
        let outputUri = this.getOutputUri();
        await this.fileSystem.writeTextFile(outputUri, this.getCurrentGenerator().output);
    }
}