import { Range } from "../source-text";
import { nodeStringifyTexts } from "../texts";
import { Type } from "./type-table";

export interface ReadonlyNode {
    readonly type: Type;
    readonly range: Range;
    readonly content: string;
    readonly children: ReadonlyNode[];

    toString(): string;
}

export class Node implements ReadonlyNode {

    constructor(
        public type: Type,

        public range: Range,

        public content: string = "",

        public readonly children: Node[] = [],
    ) {
    }

    private static clone(node: Node): Node {
        let newNode = new Node(node.type, node.range, node.content, []);
        for (let subNode of node.children) {
            newNode.children.push(Node.clone(subNode));
        }
        return newNode;
    }

    clone(): Node {
        return Node.clone(this);
    }

    // This will overwrite type, content, begin, end, and merge subnodes.
    private static transfer(from: Node, to: Node) {
        to.type = from.type;
        to.content = from.content;
        to.range = from.range;
        from.children.forEach(subNode => to.children.push(subNode.clone()));
    }

    transferTo(to: Node) {
        Node.transfer(this, to);
    }

    transferFrom(from: Node) {
        Node.transfer(from, this);
    }

    private toStringRaw(level: string): string {
        let res = nodeStringifyTexts.Template.format({
            space: level,
            type: this.type.name,
            content: this.content.replace(/[\n\r]/g, nodeStringifyTexts.ContentNewline),
            begin: this.range.begin.value,
            end: this.range.end.value
        });
        if (this.children.length === 0) {
            return res;
        }
        else {
            for (let n of this.children) {
                res += nodeStringifyTexts.Newline;
                res += n.toStringRaw(level + nodeStringifyTexts.Space);
            }
            return res;
        }
    }

    toString(): string {
        return this.toStringRaw("");
    }
}