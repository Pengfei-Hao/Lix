import { Type } from "./type";

export class Node {
    public type: Type;

    public content: string;

    public children: Node[];

    public begin: number;
    public end: number;

    
    constructor(type: Type, content: string = "", children: Node[] = [], begin: number = -1, end: number = -1) {
            this.type = type;
            this.content = content;
            this.children = children;
            this.begin = begin;
            this.end = end;
    }

    static clone(node: Node): Node {
        let newNode = new Node(node.type, node.content);
        for(let subNode of node.children) {
            newNode.children.push(Node.clone(subNode));
        }
        return newNode;
    }

    private myToString(level: string): string {
        /*
        if(node.type === Type.paragraph) {
            return `${level}"${node.content}"`;
        }
        else if(node.type === Type.setting) {
            return `#${level}${node.content}`;
        }
        else {
            let res = `${level}${node.content}`;
            for(let n of node.children) {
                res += "\n";
                res += myToString(n, level + "\t");
            }
            return res;
        }
        */
        let res = `${level}${this.type.name}: "${this.content}"`
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

