import { Generator } from "../generator/generator";
import { LatexGenerator } from "../generator/latex-generator";
import { MarkdownGenerator } from "../generator/markdown-generator";
import { MathLatexGenerator } from "../generator/math-latex-generator";
import { Parser } from "../parser/parser";
import { TypeTable } from "../sytnax-tree/type-table";
import { Config } from "./config";
import { FileOperation } from "./file-operation";

export class Compiler {

    parser: Parser;
    generator: Map<string, Generator>;
    curGenerator: Generator;

    config: Config;
    fileOperation: FileOperation;

    constructor(config: Config, fileOperation: FileOperation) {
        this.config = config;
        this.fileOperation = fileOperation;

        this.parser = new Parser(config, this.fileOperation);

        let mathLatexGenerator = new MathLatexGenerator(this.parser.typeTable, config, fileOperation);
        this.curGenerator = new LatexGenerator(this.parser.typeTable, config, fileOperation, mathLatexGenerator);
        this.generator = new Map([
            ["math-latex", mathLatexGenerator],
            ["latex", this.curGenerator],
            ["markdown", new MarkdownGenerator(this.parser.typeTable, config, fileOperation, mathLatexGenerator)]
        ]);
    }

    async parse() {
        let text = await this.fileOperation.readFile(this.fileOperation.relativePath);
        if (text === undefined) {
            return;
        }

        this.parseFromText(text);
    }

    parseFromText(text: string) {
        this.parser.parse(text);
    }

    getGenerator(name: string = "latex"): Generator | undefined {
        return this.generator.get(name);
    }

    async generate(generator = "latex") {
        let text = await this.fileOperation.readFile(this.fileOperation.relativePath);
        if (text === undefined) {
            return;
        }
        await this.generateFromText(text, generator);
    }

    async generateFromText(text: string, generator = "latex") {
        this.parseFromText(text);
        let gen = this.getGenerator(generator);
        if (gen === undefined) {
            return;
        }
        await this.fileOperation.createDirectory(this.fileOperation.cacheDirectory);
        await this.fileOperation.operateByRecord(this.parser.fileRecords);
        gen.generate(this.parser.analysedTree, this.parser.references);
    }

    async compile(generator: string = "latex") {
        let gen = this.getGenerator(generator);
        if (gen === undefined) {
            return;
        }
        await this.generate(generator);
        if (generator === "latex") {
            await this.fileOperation.writeFile(this.fileOperation.cacheDirectory + `${this.fileOperation.fileName}.tex`, gen.output);
        }
        else if (generator === "markdown") {
            await this.fileOperation.writeFile(this.fileOperation.cacheDirectory + `${this.fileOperation.fileName}.md`, gen.output);
        }
        else {
            await this.fileOperation.writeFile(this.fileOperation.cacheDirectory + `${this.fileOperation.fileName}.txt`, gen.output);
        }
    }
}