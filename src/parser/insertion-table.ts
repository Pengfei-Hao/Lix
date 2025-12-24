
import { Node } from "../sytnax-tree/node";
import { NodeResult } from "./result";
import { LixError } from "../foundation/error";
import { exceptionText } from "../foundation/i18n";

export type InsertionHandler = () => NodeResult;

export class InsertionTable {

    public insertionHandlers: Map<string, InsertionHandler> = new Map();

    constructor() {
    }

    has(name: string): boolean {
        return this.insertionHandlers.get(name) != undefined;
    }

    add(name: string, handler: InsertionHandler, thisArg?: unknown) {
        if (this.has(name)) {
            throw new LixError(exceptionText.InsertionHandlerAlreadyExists.format(name));;
        }
        this.insertionHandlers.set(name, handler.bind(thisArg));
    }

    getHandler(name: string): InsertionHandler | undefined {
        return this.insertionHandlers.get(name);
    }

}