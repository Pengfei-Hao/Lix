import { error } from "../../foundation/error";
import { commonExceptionTexts } from "../texts";

export class Type {

    constructor(
        public readonly name: string,
        private readonly index: number,
        private readonly table: TypeTable
    ) {
    }

    static equals(type1: Type, type2: Type): boolean {
        return type1.index === type2.index;
    }

    equals(type: Type): boolean {
        return Type.equals(this, type);
    }
}

export interface ReadonlyTypeTable {
    has(name: string): boolean;
    get(name: string): Type;
}

export class TypeTable implements ReadonlyTypeTable {

    private names: Map<string, Type> = new Map();
    private count: number = 0;

    public readonly emptyType: Type;

    constructor() {
        this.emptyType = this.add("empty");
    }

    has(name: string): boolean {
        return this.names.get(name) != undefined;
    }

    get(name: string): Type {
        let type = this.names.get(name);
        if (type === undefined) {
            error(commonExceptionTexts.TypeNotExist.format(name));
        }
        return type;
    }

    add(name: string): Type {
        if (this.has(name)) {
            error(commonExceptionTexts.TypeAlreadyExists.format(name));
        }

        let newType = new Type(name, this.count, this);
        this.names.set(name, newType);
        this.count++;
        return newType;
    }
}