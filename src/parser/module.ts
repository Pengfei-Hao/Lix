import { Parser } from "./parser";

export abstract class Module {
    parser: Parser;

    constructor(parser: Parser) {
        this.parser = parser;
    }

    abstract init(): void;

}