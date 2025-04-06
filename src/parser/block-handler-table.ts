
import { Node } from "../sytnax-tree/node";
import { Parser } from "./parser";
import { Result } from "../foundation/result";

export type BlockHandler = (args: Node) => Result<Node>;

export enum ArgumentType {
    string,
    number,
    enumeration
}

export type ArgumentsSpecification = { arguments: Map<string, { type: ArgumentType, options: string[], default: string }>, allowReference: boolean };

export class BlockHandlerTable {

blockHandlers: Map<string, BlockHandler>;
argumentsSpecification: Map<string, ArgumentsSpecification>;

constructor() {
    this.blockHandlers = new Map();
    this.argumentsSpecification = new Map();
}

has(name: string): boolean {
    return this.blockHandlers.get(name) != undefined;
}

add(name: string, handler: BlockHandler, thisArg?: unknown, argumentsSpec?: ArgumentsSpecification): boolean {
    if(this.has(name)) {
        return false;
    }
    this.blockHandlers.set(name, handler.bind(thisArg));
    this.argumentsSpecification.set(name, argumentsSpec ?? { arguments: new Map(), allowReference: false});
    return true;
}

getHandler(name: string): BlockHandler | undefined {
    return this.blockHandlers.get(name);
}

getSpecification(name: string): ArgumentsSpecification | undefined {
    return this.argumentsSpecification.get(name);
}

}