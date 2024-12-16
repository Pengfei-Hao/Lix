
import { Node } from "../sytnax-tree/node";
import { Parser } from "./parser";
import { Result } from "../foundation/result";

export type BlockHandler = (args: Node) => Result<Node>;

export class BlockHandlerTable {

blockHandlers: Map<string, BlockHandler>;

constructor() {
    this.blockHandlers = new Map();
}

has(name: string): boolean {
    return this.blockHandlers.get(name) != undefined;
}

add(name: string, handler: BlockHandler, thisArg?: unknown): boolean {
    if(this.has(name)) {
        return false;
    }
    this.blockHandlers.set(name, handler.bind(thisArg));
    return true;
}

getHandler(name: string): BlockHandler | undefined {
    return this.blockHandlers.get(name);
}

}