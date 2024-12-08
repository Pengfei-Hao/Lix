import { Config } from "../foundation/config";
import { Node } from "../sytnax-tree/node";
import { TypeTable } from "../sytnax-tree/type-table";

export abstract class Generator {
    syntaxTree: Node;
    typeTable: TypeTable;
    config: Config;
    constructor(typeTable: TypeTable, config: Config) {
        this.config = config;
        this.typeTable = typeTable;

        let doc = typeTable.get("document")!;
        this.syntaxTree = new Node(doc);
    }

    abstract generate(syntaxTree: Node): Promise<string>;
}