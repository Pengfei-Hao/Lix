import { TypeTable } from "./type-table";

export class Type {
    name: string;
    table: TypeTable;

    constructor(name: string, table: TypeTable) {
        this.name = name;
        this.table = table;
    }
}