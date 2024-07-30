
import { Node } from "../sytnax-tree/node";
import { MatchResult, Parser } from "./parser";
import { Result } from "../foundation/result";

export type HandlerFunction = (args: Node) => Result<Node>;

export class BlockHandlerTable {

parser: Parser;
blockHandlers: Map<string, HandlerFunction>;

constructor(parser: Parser) {
    this.blockHandlers = new Map();
    this.parser = parser;
}

has(name: string): boolean {
    return this.blockHandlers.get(name) != undefined;
}

add(name: string, handler: HandlerFunction, obj: unknown): boolean {
    if(this.has(name)) {
        return false;
    }
    this.blockHandlers.set(name, handler.bind(obj));
    return true;
}

getHandler(name: string): HandlerFunction | undefined {
    return this.blockHandlers.get(name);
}

}