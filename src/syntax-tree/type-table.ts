import { Type } from "./type";
import { error } from "../foundation/error";
import { syntaxTreeExceptionTexts } from "./texts";

export class TypeTable {

    private names: Map<string, Type> = new Map();
    private count: number = 0;

    private rawEmptyType: Type;

    constructor() {
        this.rawEmptyType = this.add("empty");
    }

    get emptyType(): Type {
        return this.rawEmptyType;
    }

    has(name: string): boolean {
        return this.names.get(name) != undefined;
    }

    get(name: string): Type {
        let type = this.names.get(name);
        if (type === undefined) {
            error(syntaxTreeExceptionTexts.TypeNotExist.format(name));
        }
        return type;
    }

    add(name: string): Type {
        if (this.has(name)) {
            error(syntaxTreeExceptionTexts.TypeAlreadyExists.format(name));
        }

        let newType = new Type(name, this.count, this);
        this.names.set(name, newType);
        this.count++;
        return newType;
    }
}