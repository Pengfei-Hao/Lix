import { Generator } from "../generator/generator";
import { LatexGenerator } from "../generator/latex-generator";
import { Parser } from "../parser/parser";
import { Config } from "./config";
import { FileOperation } from "./file-operation";

export class Compiler {

    parser: Parser;
    generator: Map<string, Generator>;
    curGenerator: Generator;

    config: Config;
    fileOperation: FileOperation;

    constructor(config: Config, fileOperation: FileOperation) {
        this.fileOperation = fileOperation;
        this.config = config;

        this.parser = new Parser(config);
        this.curGenerator = new LatexGenerator(this.parser.typeTable, this);
        this.generator = new Map();
        this.generator.set("latex", this.curGenerator);
    }

    async parse() {
        let text = await this.fileOperation.readFile(this.fileOperation.relativePath);
        if (text === undefined) {
            return;
        }

        this.parser.parse(text);
    }

    parseFromText(text: string) {
        this.parser.parse(text);
    }

    getGenerator(name: string = "latex"): Generator | undefined {
        return this.generator.get(name)
    }

    async generate(generator = this.curGenerator) {
        await this.parse();
        await generator.generate(this.parser.analysedTree, this.parser.references);
    }

    async generateFromText(text: string, generator = this.curGenerator) {
        this.parseFromText(text);
        await generator.generate(this.parser.analysedTree, this.parser.references);
    }

    async compile(name: string = "latex") {
        let generator = this.getGenerator(name);
        if (generator === undefined) {
            return;
        }
        await this.generate(generator);
        let output = generator.output;

        let fileName = this.fileOperation.fileName;
        await this.fileOperation.createDirectory("./.lix");
        await this.fileOperation.writeFile(`./.lix/${fileName}.tex`, output);
    }
}