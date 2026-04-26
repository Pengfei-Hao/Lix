import { NodeResult } from "../../common/result/parsing-result";
import { error } from "../../foundation/error";
import { parserExceptionTexts } from "../texts";
import { HandlerTable } from "./handler-table";

export type EmbedmentHandler = () => NodeResult;

export class EmbedmentTable extends HandlerTable<EmbedmentHandler, null> {

    constructor() {
        super();
    }

    override add(name: string, handler: EmbedmentHandler, thisArg?: unknown) {
        if (this.has(name)) {
            error(parserExceptionTexts.EmbedmentHandlerAlreadyExists.format(name));
        }
        this.handlers.set(name, handler.bind(thisArg));
        this.names.add(name);
        this.longestNameLength = Math.max(this.longestNameLength, name.length);
    }
}