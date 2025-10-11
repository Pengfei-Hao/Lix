import { Node } from "../sytnax-tree/node";
import { LixError } from "../foundation/error";
import { Message, MessageType } from "../foundation/message";
import { Type } from "../sytnax-tree/type";

export enum HighlightType {
    operator,
    keyword,
    variable,
    string,
    comment,
    number
};

export class Highlight {
    constructor(
        public begin: number,
        public end: number,

        public type: HighlightType
    ) {
    }
}

// export enum ReferenceType {
//     formula,
//     bibliography,
//     default
// }

export class Reference {
    constructor(
        public name: string,
        //public type: ReferenceType,
        public node: Node) {

    }
}

export enum ResultState {
    successful = 3,
    skippable = 2,
    matched = 1,
    failing = 0
}

export enum FileOperationType {
    readFile,
    copyFile,
    writeFile,
    createDirectory,
    getFilesInDirectory
}

export class FileRecord {
    constructor(
        public type: FileOperationType,
        public from: string,
        public to: string,
        public result: undefined | string | string[]
    ) {
    }
}

// **************** Result ****************

export class BasicResult {

    // state
    public state: ResultState;

    // promote
    private promotedToMatched: boolean;

    constructor(
        // environment
        public messages: Message[] = [],
        public highlights: Highlight[] = [],
        public references: Reference[] = [],
        public fileRecords: FileRecord[] = []
    ) {
        this.state = ResultState.failing;
        this.promotedToMatched = false;
    }

    // **************** State ****************

    get shouldTerminate(): boolean {
        if (this.promotedToMatched) {
            if (this.state === ResultState.failing) {
                throw new LixError("Result.shouldTerminate has logic error.");
            }
            return this.state === ResultState.matched;
        }
        else {
            if (this.state === ResultState.matched) {
                throw new LixError("Result.shouldTerminate has logic error.");
            }
            return this.state === ResultState.failing;
        }

    }

    get matched(): boolean {
        return this.state !== ResultState.failing;
    }

    get failed(): boolean {
        return this.state === ResultState.failing;
    }

    get succeeded(): boolean {
        return this.state === ResultState.successful;
    }

    promoteToSkippable() {
        if (this.promotedToMatched) {
            if (this.state !== ResultState.matched) {
                throw new LixError("Result.promote has logic error.");
            }
            this.state = ResultState.skippable;
        }
        else {
            if (this.state !== ResultState.failing) {
                throw new LixError("Result.promote has logic error.");
            }
            this.state = ResultState.skippable;
        }

    }

    GuaranteeMatched() {
        this.promotedToMatched = true;
        if (this.state === ResultState.failing) {
            this.state = ResultState.matched;
        }
    }

    // **************** Merge ****************

    // state
    mergeState(state: ResultState) {
        // successful = 3,
        // skippable = 2,
        // matched = 1,
        // failing = 0
        if (this.promotedToMatched) {
            const table = [[-1, -1, -1, -1], [1, 1, 2, 3], [1, 1, 2, 2], [1, 1, 2, 3]]
            let res = table[this.state][state];
            if (res === -1) {
                throw new LixError("Result.merge has logic error.");
            }
            else {
                this.state = res;
            }
        }
        else {
            const table = [[0, 0, 2, 3], [-1, -1, -1, -1], [0, 0, 2, 2], [0, 0, 2, 3]]
            let res = table[this.state][state];
            if (res === -1) {
                throw new LixError("Result.merge has logic error.");
            }
            else {
                this.state = res;
            }
        }
    }

    // state + environment
    merge(result: BasicResult): void {
        this.mergeState(result.state);

        for (let msg of result.messages) {
            this.messages.push(msg);
        }
        for (let hlt of result.highlights) {
            this.highlights.push(hlt);
        }
        for (let ref of result.references) {
            this.references.push(ref);
        }
        for (let file of result.fileRecords) {
            this.fileRecords.push(file);
        }
    }

    // environment

    // message
    addMessage(message: string, type: MessageType, node: Node): void
    addMessage(message: string, type: MessageType, index: number, relativeBegin: number, relativeEnd: number): void
    addMessage(message: string, type: MessageType, indexOrNode: number | Node, relativeBegin: number = 0, relativeEnd: number = 1) {
        const code = 0;
        if (typeof (indexOrNode) === "number") {
            this.messages.push(new Message(message, type, code, indexOrNode + relativeBegin, indexOrNode + relativeEnd, []));
        }
        else {
            this.messages.push(new Message(message, type, code, indexOrNode.begin, indexOrNode.end, []));
        }
    }

    // highlight
    addHighlight(type: HighlightType, node: Node): void
    addHighlight(type: HighlightType, index: number, relativeBegin: number, relativeEnd: number): void
    addHighlight(type: HighlightType, indexOrNode: number | Node, relativeBegin: number = 0, relativeEnd: number = 1): void {
        if (typeof (indexOrNode) === "number") {
            this.highlights.push(new Highlight(indexOrNode + relativeBegin, indexOrNode + relativeEnd, type));
        }
        else {
            this.highlights.push(new Highlight(indexOrNode.begin, indexOrNode.end, type));
        }
    }

    // reference
    addReference(name: string, node: Node) {
        this.references.push(new Reference(name, node));
    }

    // file operation
    addFileRecord(type: FileOperationType, from: string, to: string) {
        this.fileRecords.push(new FileRecord(type, from, to, undefined));
    }
}

export class Result<T> extends BasicResult {

    // content
    value: T;

    constructor(value: T, messages: Message[] = [], highlights: Highlight[] = [], references: Reference[] = []) {
        super(messages, highlights, references);
        this.value = value;
    }

}

export class NodeResult extends BasicResult {

    // content
    node: Node;
    discarded: boolean;
    analysedNode: Node;

    constructor(node: Node, analysedNode: Node, discarded = false, messages: Message[] = [], highlights: Highlight[] = [], references: Reference[] = []) {
        super(messages, highlights, references);
        this.node = node;
        this.discarded = discarded;
        this.analysedNode = analysedNode;
    }

    mergeNodeToChildren(result: NodeResult) {
        this.node.children.push(result.node);
        if (!result.discarded) {
            this.analysedNode.children.push(result.analysedNode);
        }
    }

    addNode(type: Type, content: string, children: Node[], node: Node): Node
    addNode(type: Type, content: string, children: Node[], index: number, relativeBegin: number, relativeEnd: number): Node
    addNode(type: Type, content: string, children: Node[], indexOrNode: number | Node, relativeBegin: number = 0, relativeEnd: number = 1): Node {
        let nNode: Node;
        if (typeof (indexOrNode) === "number") {
            nNode = new Node(type, content, children, indexOrNode + relativeBegin, indexOrNode + relativeEnd);
        }
        else {
            nNode = new Node(type, content, children, indexOrNode.begin, indexOrNode.end);
        }
        this.node.children.push(nNode);
        return nNode;
    }

    addAnalysedNode(type: Type, content: string, children: Node[], node: Node): Node
    addAnalysedNode(type: Type, content: string, children: Node[], index: number, relativeBegin: number, relativeEnd: number): Node
    addAnalysedNode(type: Type, content: string, children: Node[], indexOrNode: number | Node, relativeBegin: number = 0, relativeEnd: number = 1): Node {
        let nNode: Node;
        if (typeof (indexOrNode) === "number") {
            nNode = new Node(type, content, children, indexOrNode + relativeBegin, indexOrNode + relativeEnd);
        }
        else {
            nNode = new Node(type, content, children, indexOrNode.begin, indexOrNode.end);
        }
        this.analysedNode.children.push(nNode);
        return nNode;
    }
}