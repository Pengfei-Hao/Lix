import { Parser } from "./parser";

export abstract class Module {

    constructor(
        public parser: Parser
    ) {
    }

    abstract init(): void;

}