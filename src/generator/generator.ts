import { Node } from "../sytnax-tree/node";

export abstract class Generator {
    protected syntaxTree: Node;

    constructor(syntaxTree: Node) {
        this.syntaxTree = syntaxTree;
    }

    abstract generate(): string;
}