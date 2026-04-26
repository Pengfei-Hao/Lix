import { AddOnlyList } from "../../foundation/add-only-list";
import { Node } from "../syntax-tree/node";

export class Reference {

    constructor(
        public readonly name: string,
        public readonly node: Node
    ) {
    }
}

export class ReferenceList implements AddOnlyList<Reference> {

    private rawReferences: Reference[];

    constructor() {
        this.rawReferences = [];
    }

    public get items(): readonly Reference[] {
        return this.rawReferences;
    }

    push(...references: Reference[]) {
        this.rawReferences.push(...references);
    }

    add(name: string, node: Node) {
        this.rawReferences.push(new Reference(name, node));
    }
}