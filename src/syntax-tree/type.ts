import { TypeTable } from "./type-table";

export class Type {

    private rawName: string;

    constructor(
        name: string,
        private index: number,
        private table: TypeTable
    ) {
        this.rawName = name;
    }

    get name(): string {
        return this.rawName;
    }

    static equals(type1: Type, type2: Type): boolean {
        return type1.index === type2.index;
    }

    equals(type: Type): boolean {
        return Type.equals(this, type);
    }
}