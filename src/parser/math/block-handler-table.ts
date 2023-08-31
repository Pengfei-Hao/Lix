import { Parser } from "../parser";
import { Node } from "../../sytnax-tree/node";
import { Type } from "../../sytnax-tree/type";

type HandleFunction = (node: Node) => boolean;

export class BlockHandlerTable {

    parser: Parser;

    blockHandleFunctions: Map<string, HandleFunction>;
    symbols: Map<string, string> = new Map();
    definations: Map<string, Node> = new Map();

    constructor(parser: Parser) {
        this.parser = parser;
        this.blockHandleFunctions = new Map();
        this.symbols = new Map();
        this.definations = new Map();
    }

    addDefination(name: string, content: Node) {
        this.definations.set(name, content);
    }

    addSymbol(name: string) {
        this.symbols.set(name, "");
    }

    addBlock(name: string, handleFunction: HandleFunction, obj: unknown): Type | undefined {
        this.blockHandleFunctions.set(name, handleFunction.bind(obj));
        return this.parser.typeTable.add(name);
    }

}