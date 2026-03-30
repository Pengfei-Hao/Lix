import { NodeResult } from "./result";
import { error } from "../foundation/error";
import { parserExceptionTexts } from "./texts";

export type CommandHandler = () => NodeResult;

export class CommandTable {

    private handlers: Map<string, CommandHandler>;

    constructor() {
        this.handlers = new Map();
    }

    has(name: string): boolean {
        return this.handlers.get(name) != undefined;
    }

    add(name: string, handler: CommandHandler, thisArg?: unknown) {
        if (this.has(name)) {
            error(parserExceptionTexts.CommandHandlerAlreadyExists.format(name));
        }
        this.handlers.set(name, handler.bind(thisArg));
    }

    getHandler(name: string): CommandHandler | undefined {
        return this.handlers.get(name);
    }

    find(predicate: (name: string) => boolean): string | undefined {
        let candidate: string | undefined;
        let length = 0;
        for (const [name, handler] of this.handlers) {
            if (predicate(name) && name.length > length) {
                candidate = name;
                length = name.length;
            }
        }
        return candidate;
    }

    findHandler(predicate: (name: string) => boolean): CommandHandler | undefined {
        let name = this.find(predicate);
        return name !== undefined ? this.getHandler(name) : undefined;
    }
}