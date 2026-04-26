import { NodeResult } from "../../common/result/parsing-result";
import { error } from "../../foundation/error";
import { parserExceptionTexts } from "../texts";
import { HandlerTable } from "./handler-table";

export type InsertionHandler = () => NodeResult;

export class InsertionOption {
    constructor(
        public readonly onlyInText: boolean = false
    ) {
    }
}

export class InsertionTable extends HandlerTable<InsertionHandler, InsertionOption> {

    constructor() {
        super();
    }

    override add(name: string, handler: InsertionHandler, thisArg?: unknown, option?: InsertionOption) {
        if (this.has(name)) {
            error(parserExceptionTexts.InsertionHandlerAlreadyExists.format(name));
        }
        this.handlers.set(name, handler.bind(thisArg));
        this.options.set(name, option ?? new InsertionOption());
        this.names.add(name);
        this.longestNameLength = Math.max(this.longestNameLength, name.length);
    }
}