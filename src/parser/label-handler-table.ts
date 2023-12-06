
import { Node } from "../sytnax-tree/node";
import { MatchResult, Parser } from "./parser";
import { Result } from "../foundation/result";

export type HandlerFunction = () => Result<Node>;

/*
export function init() {
    
    add("title", matchParagraphInside);
    add("author", matchParagraphInside);
    add("section", matchParagraphInside);
    add("subsection", matchParagraphInside);
    add("_1", matchParagraphInside);
    add("equation", matchEquation);
    add("$", matchEquation);
}
*/


export class LabelHandlerTable {

parser: Parser;
labelHandlers: Map<string, HandlerFunction>;

constructor(parser: Parser) {
    this.labelHandlers = new Map();
    this.parser = parser;
}

has(name: string): boolean {
    return this.labelHandlers.get(name) != undefined;
}

add(name: string, handler: HandlerFunction, obj: unknown): boolean {
    if(this.has(name)) {
        return false;
    }
    this.labelHandlers.set(name, handler.bind(obj));
    return true;
}

getHandler(name: string): HandlerFunction | undefined {
    return this.labelHandlers.get(name);
}

/*
private getAndHandle(name: string): MatchResult {
    let handle = this.labelHandlers.get(name);
    if(handle != undefined) {
        return handle();
    }
    else {
        return new Result(false, new Node(this.parser.labelType, "[[[Label name cannot be found.]]]"));
    }
}
*/

}