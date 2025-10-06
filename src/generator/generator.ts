import { Compiler } from "../compiler/compiler";
import { Reference } from "../parser/result";
import { Node } from "../sytnax-tree/node";
import { TypeTable } from "../sytnax-tree/type-table";

export abstract class Generator {
    syntaxTree: Node;
    typeTable: TypeTable;
    references: Reference[];
    compiler: Compiler;

    constructor(typeTable: TypeTable, compiler: Compiler) {
        this.compiler = compiler;
        this.typeTable = typeTable;
        this.references = [];
        this.output = "";

        let doc = typeTable.get("document");
        this.syntaxTree = new Node(doc);
    }

    output: string;

    abstract generate(syntaxTree: Node, references: Reference[]): Promise<void>;
}

