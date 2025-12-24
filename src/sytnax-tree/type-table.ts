import { Type } from "./type";
import { LixError } from "../foundation/error";
import { exceptionText } from "../foundation/i18n";

export class TypeTable {

    private names: Map<string, Type> = new Map();
    private count: number = 0;
    
    constructor() {
    }

    has(name: string): boolean {
        return this.names.get(name) != undefined;
    }

    get(name: string): Type {
        let type = this.names.get(name);
        if (type === undefined) {
            throw new LixError(exceptionText.TypeNotExist.format(name));
        }
        return type;
    }

    add(name: string): Type {
        if (this.has(name)) {
            throw new LixError(exceptionText.TypeAlreadyExists.format(name));
        }

        let newType = new Type(name, this);
        this.names.set(name, newType);
        this.count++;
        return newType;
    }
}