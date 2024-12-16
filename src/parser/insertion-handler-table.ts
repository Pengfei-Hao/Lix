
import { Node } from "../sytnax-tree/node";
import { Result } from "../foundation/result";

export type InsertionHandler = () => Result<Node>;

export class InsertionHandlerTable {

insertionHandlers: Map<string, InsertionHandler>;

constructor() {
    this.insertionHandlers = new Map();
}

has(name: string): boolean {
    return this.insertionHandlers.get(name) != undefined;
}

add(name: string, handler: InsertionHandler, thisArg?: unknown): boolean {
    if(this.has(name)) {
        return false;
    }
    this.insertionHandlers.set(name, handler.bind(thisArg));
    return true;
}

getHandler(name: string): InsertionHandler | undefined {
    return this.insertionHandlers.get(name);
}

}