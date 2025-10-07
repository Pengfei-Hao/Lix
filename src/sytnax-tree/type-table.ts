import { Type } from "./type";
import { LixError } from "../foundation/error";

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
            return this.names.get("name")!;
            throw new LixError(`Type '${name}' do not exist.`);
        }
        return type;
    }

    add(name: string): Type {
        if (this.has(name)) {
            throw new LixError(`Type '${name}' repeated.`);
        }

        let newType = new Type(name, this);
        this.names.set(name, newType);
        this.count++;
        return newType;
    }
}