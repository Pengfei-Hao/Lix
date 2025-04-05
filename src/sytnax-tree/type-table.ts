import { Type } from "./type";
import { Parser } from "../parser/parser";


export class TypeTable {
    parser: Parser;
    private names: Map<string, Type>;
    private count: number;

    constructor(parser: Parser) {
        this.parser = parser;

        this.names = new Map();
        this.count = 0;
    }

    has(name: string): boolean {
        return this.names.get(name) != undefined;
    }

    get(name: string): Type | undefined {
        return this.names.get(name);
    }

    add(name: string): Type | undefined {
        if(this.has(name)) {
            console.log(`Type '${name}' is defined.`);
            return undefined;
        }

        let newType = new Type(name, this);
        this.names.set(name, newType);
        this.count++;
        return newType;
    }
}