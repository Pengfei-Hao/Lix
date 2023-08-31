import { Type } from "./type";
import { Parser } from "../parser/parser";


export class TypeTable {
    parser: Parser;
    private names: Map<string, Type>;
    private count: number;

    /*
    document: Type;

    paragraph: Type;
    text: Type;

    setting: Type;
    settingParameter: Type;

    label: Type;
    */

    /*
    equation: Type;
    symbol: Type;
    defination: Type;
    fraction: Type;
    matrix: Type;
    */

    constructor(parser: Parser) {
        this.parser = parser;

        this.names = new Map();
        this.count = 0;

        /*
        this.document = this.add("document")!;
        this.paragraph = this.add("paragraph")!;
        this.text = this.add("text")!;
        this.setting = this.add("setting")!;
        this.settingParameter = this.add("setting-parameter")!;
        this.label = this.add("label")!;
        */
       /*
        this.equation = this.add("equation")!;
        this.symbol = this.add("symbol")!;
        this.defination = this.add("defination")!;
        this.fraction = this.add("fraction")!;
        this.matrix = this.add("matrix")!;
        */
    }

    /*has(name: string): boolean;
    has(type: Type): boolean;
    has(param: string | Type): boolean {
        if(typeof(param) === "string") {
            return this.names.get(param) != undefined;
        }
        else {
            return param.table === this && this.has(param.name);
        }
    }*/

    has(name: string): boolean {
        return this.names.get(name) != undefined;
    }

    get(name: string): Type | undefined {
        return this.names.get(name);
    }

    add(name: string): Type | undefined {
        if(this.has(name)) {
            return undefined;
        }

        let newType = new Type(name, this);
        this.names.set(name, newType);
        this.count++;
        return newType;
    }
}