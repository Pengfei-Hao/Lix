import { Type } from "./type";

export class Node {

    constructor(
        public type: Type,

        public content: string = "",

        public children: Node[] = [],

        public begin: number = -1,
        public end: number = -1
    ) {
    }

    private static clone(node: Node): Node {
        let newNode = new Node(node.type, node.content, [], node.begin, node.end);
        for (let subNode of node.children) {
            newNode.children.push(Node.clone(subNode));
        }
        return newNode;
    }

    clone(): Node {
        return Node.clone(this);
    }

    // This will overwrite type, content, begin, end, and add subnodes.
    private static moveTo(from: Node, to: Node) {
        to.type = from.type;
        to.content = from.content;
        to.begin = from.begin;
        to.end = from.end;
        from.children.forEach(subNode => to.children.push(subNode));
        from.content = "";
        from.begin = -1;
        from.end = -1;
        from.children = [];
    }

    moveTo(to: Node) {
        Node.moveTo(this, to);
    }

    // This will overwrite type, content, begin, end, and add subnodes.
    private static copyTo(from: Node, to: Node) {
        to.type = from.type;
        to.content = from.content;
        to.begin = from.begin;
        to.end = from.end;
        from.children.forEach(subNode => to.children.push(subNode.clone()));
    }

    copyTo(to: Node) {
        Node.copyTo(this, to);
    }

    private myToString(level: string): string {
        let res = `${level}${this.type.name}: "${this.content.replace(/[\n\r]/g, "\\n")}", range: [${this.begin}, ${this.end})`
        if (this.children.length === 0) {
            return res;
        }
        else {
            for (let n of this.children) {
                res += "\n";
                res += n.myToString(level + "\t");
            }
            return res;
        }
    }

    toString(): string {
        return this.myToString("");
    }
}