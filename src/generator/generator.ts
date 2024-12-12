import { Compiler } from "../compiler/compiler";
import { Node } from "../sytnax-tree/node";
import { TypeTable } from "../sytnax-tree/type-table";

export abstract class Generator {
    syntaxTree: Node;
    typeTable: TypeTable;
    compiler: Compiler;

    constructor(typeTable: TypeTable, compiler: Compiler) {
        this.compiler = compiler;
        this.typeTable = typeTable;
        this.output = "";

        let doc = typeTable.get("document")!;
        this.syntaxTree = new Node(doc);
    }

    output: string;

    abstract generate(syntaxTree: Node): Promise<void>;
}

