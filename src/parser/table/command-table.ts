import { NodeResult } from "../../common/result/parsing-result";
import { error } from "../../foundation/error";
import { parserExceptionTexts } from "../texts";
import { HandlerTable } from "./handler-table";

export type CommandHandler = () => NodeResult;

export class CommandTable extends HandlerTable<CommandHandler, null> {

    constructor() {
        super();
    }

    override add(name: string, handler: CommandHandler, thisArg?: unknown) {
        if (this.has(name)) {
            error(parserExceptionTexts.CommandHandlerAlreadyExists.format(name));
        }
        this.handlers.set(name, handler.bind(thisArg));
        this.names.add(name);
        this.longestNameLength = Math.max(this.longestNameLength, name.length);
    }
}