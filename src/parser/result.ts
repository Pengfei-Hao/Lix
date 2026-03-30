import { Node } from "../syntax-tree/node";
import { Message, MessageType } from "./message";
import { Type } from "../syntax-tree/type";
import { parserExceptionTexts } from "./texts";
import { FileSystemRecord } from "../compiler/file-system";
import { UITexts } from "../extension/texts";
import { error } from "../foundation/error";

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

export function stateToString(state: ResultState, texts?: UITexts): string {
    let text = "";
    switch (state) {
        case ResultState.successful:
            text = texts?.StateSuccessful ?? "successful";
            break;
        case ResultState.skippable:
            text = texts?.StateSkippable ?? "skippable";
            break;
        case ResultState.matched:
            text = texts?.StateMatched ?? "matched";
            break;
        case ResultState.failing:
            text = texts?.StateFailing ?? "failing";
            break;
    }
    return text;
}

// **************** Result ****************

export class BasicResult {

    // state
    private rawState: ResultState;

    // promote
    private promotedToMatched: boolean;

    // environment
    private rawMessages: Message[];
    private rawHighlights: Highlight[];
    private rawReferences: Reference[];
    private rawFileRecords: FileSystemRecord[];

    constructor() {
        this.rawState = ResultState.successful;
        this.promotedToMatched = false;
        this.rawMessages = [];
        this.rawHighlights = [];
        this.rawReferences = [];
        this.rawFileRecords = [];
    }

    // **************** State ****************

    get state(): ResultState {
        return this.rawState;
    }

    get shouldStop(): boolean {
        if (this.promotedToMatched) {
            if (this.rawState === ResultState.failing) {
                error(parserExceptionTexts.ResultShouldTerminateLogicError);
            }
            return this.rawState === ResultState.matched;
        }
        else {
            if (this.rawState === ResultState.matched) {
                error(parserExceptionTexts.ResultShouldTerminateLogicError);
            }
            return this.rawState === ResultState.failing;
        }

    }

    get matched(): boolean {
        return this.rawState !== ResultState.failing;
    }

    get failed(): boolean {
        return this.rawState === ResultState.failing;
    }

    ensureMatched() {
        this.promotedToMatched = true;
        if (this.rawState === ResultState.failing) {
            this.rawState = ResultState.matched;
        }
    }

    // state
    private mergeState(state: ResultState) {
        // successful = 3,
        // skippable = 2,
        // matched = 1,
        // failing = 0
        if (this.promotedToMatched) {
            const table = [[-1, -1, -1, -1], [1, 1, 2, 3], [1, 1, 2, 2], [1, 1, 2, 3]]
            let res = table[this.rawState][state];
            if (res === -1) {
                error(parserExceptionTexts.ResultMergeLogicError);
            }
            else {
                this.rawState = res;
            }
        }
        else {
            const table = [[0, 0, 2, 3], [-1, -1, -1, -1], [0, 0, 2, 2], [0, 0, 2, 3]]
            let res = table[this.rawState][state];
            if (res === -1) {
                error(parserExceptionTexts.ResultMergeLogicError);
            }
            else {
                this.rawState = res;
            }
        }
    }

    recoverToSkippable() {
        if (this.promotedToMatched) {
            if (this.rawState !== ResultState.matched) {
                error(parserExceptionTexts.ResultPromoteLogicError);
            }
            this.rawState = ResultState.skippable;
        }
        else {
            if (this.rawState !== ResultState.failing) {
                error(parserExceptionTexts.ResultPromoteLogicError);
            }
            this.rawState = ResultState.skippable;
        }

    }

    mergeSuccessfulState() {
        this.mergeState(ResultState.successful);
    }

    mergeFailedState() {
        this.mergeState(ResultState.failing);
    }

    // **************** Merge ****************

    // state + environment
    merge<T extends BasicResult>(result: T): T {
        this.mergeState(result.rawState);

        for (let msg of result.rawMessages) {
            this.rawMessages.push(msg);
        }
        for (let hlt of result.rawHighlights) {
            this.rawHighlights.push(hlt);
        }
        for (let ref of result.rawReferences) {
            this.rawReferences.push(ref);
        }
        for (let file of result.rawFileRecords) {
            this.rawFileRecords.push(file);
        }
        return result;
    }

    // **************** Environment ****************

    get messages(): Message[] {
        return this.rawMessages;
    }

    get highlights(): Highlight[] {
        return this.rawHighlights;
    }

    get references(): Reference[] {
        return this.rawReferences;
    }

    get fileRecords(): FileSystemRecord[] {
        return this.rawFileRecords;
    }

    // message
    addMessage(message: string, type: MessageType, node: Node): void
    addMessage(message: string, type: MessageType, index: number, relativeBegin: number, relativeEnd: number): void
    addMessage(message: string, type: MessageType, indexOrNode: number | Node, relativeBegin: number = 0, relativeEnd: number = 1) {
        const code = 0;
        if (typeof (indexOrNode) === "number") {
            this.rawMessages.push(new Message(message, type, code, indexOrNode + relativeBegin, indexOrNode + relativeEnd, []));
        }
        else {
            this.rawMessages.push(new Message(message, type, code, indexOrNode.begin, indexOrNode.end, []));
        }
    }

    // highlight
    addHighlight(type: HighlightType, node: Node): void
    addHighlight(type: HighlightType, index: number, relativeBegin: number, relativeEnd: number): void
    addHighlight(type: HighlightType, indexOrNode: number | Node, relativeBegin: number = 0, relativeEnd: number = 1): void {
        if (typeof (indexOrNode) === "number") {
            this.rawHighlights.push(new Highlight(indexOrNode + relativeBegin, indexOrNode + relativeEnd, type));
        }
        else {
            this.rawHighlights.push(new Highlight(indexOrNode.begin, indexOrNode.end, type));
        }
    }

    // reference
    addReference(name: string, node: Node) {
        this.rawReferences.push(new Reference(name, node));
    }

    // file operation
    addFileRecord(record: FileSystemRecord) {
        this.rawFileRecords.push(record);
    }
}

export class Result<T> extends BasicResult {

    // content
    value: T;

    // constructor(value: T, messages: Message[] = [], highlights: Highlight[] = [], references: Reference[] = [], fileRecords: FileSystemRecord[] = []) {
    //     super(messages, highlights, references, fileRecords);
    //     this.value = value;
    // }

    constructor(value: T) {
        super();
        this.value = value;
    }

}

export class NodeResult extends BasicResult {

    // content
    private rawNode: Node;
    private rawDiscarded: boolean;
    private rawAnalysedNode: Node;

    // constructor(node: Node, analysedNode: Node, discarded = false, messages: Message[] = [], highlights: Highlight[] = [], references: Reference[] = [], fileRecords: FileSystemRecord[] = []) {
    //     super(messages, highlights, references, fileRecords);
    //     this.node = node;
    //     this.discarded = discarded;
    //     this.analysedNode = analysedNode;
    // }

    constructor(node: Node, analysedNode: Node, discarded = false) {
        super();
        this.rawNode = node;
        this.rawDiscarded = discarded;
        this.rawAnalysedNode = analysedNode;
    }

    get node(): Node {
        return this.rawNode;
    }

    get discarded(): boolean {
        return this.rawDiscarded;
    }

    get analysedNode(): Node {
        return this.rawAnalysedNode;
    }

    mergeNodeWithChild(result: NodeResult) {
        this.rawNode.children.push(result.rawNode);
    }

    mergeAnalysedNodeWithChild(result: NodeResult) {
        if (!result.rawDiscarded) {
            this.rawAnalysedNode.children.push(result.rawAnalysedNode);
        }
    }

    mergeNodeByTransferring(result: NodeResult) {
        result.rawNode.transferTo(this.rawNode);
    }

    mergeAnalysedNodeByTransferring(result: NodeResult) {
        result.rawAnalysedNode.transferTo(this.rawAnalysedNode);
    }

    mergeBothNodesWithChild(result: NodeResult) {
        this.mergeNodeWithChild(result);
        this.mergeAnalysedNodeWithChild(result);
    }

    mergeBothNodesByTransferring(result: NodeResult) {
        this.mergeNodeByTransferring(result);
        this.mergeAnalysedNodeByTransferring(result);
    }

    mergeNodeWithChildAndAnalysedNodeByTransferring(result: NodeResult) {
        this.mergeNodeWithChild(result);
        this.mergeAnalysedNodeByTransferring(result);
    }

    mergeNodeByTransferringAndAnalysedNodeWithChild(result: NodeResult) {
        this.mergeNodeByTransferring(result);
        this.mergeAnalysedNodeWithChild(result);
    }

    setNodeBegin(index: number) {
        this.rawNode.begin = index;
    }

    setNodeEnd(index: number) {
        this.rawNode.end = index;
    }

    setAnalysedNodeBegin(index: number) {
        this.rawAnalysedNode.begin = index;
    }

    setAnalysedNodeEnd(index: number) {
        this.rawAnalysedNode.end = index;
    }

    setNodeContent(content: string) {
        this.rawNode.content = content;
    }

    appendNodeContent(content: string) {
        this.rawNode.content += content;
    }

    setAnalysedNodeContent(content: string) {
        this.rawAnalysedNode.content = content;
    }

    appendAnalysedNodeContent(content: string) {
        this.rawAnalysedNode.content += content;
    }

    setNodeType(type: Type) {
        this.rawNode.type = type;
    }

    setAnalysedNodeType(type: Type) {
        this.rawAnalysedNode.type = type;
    }

    setDiscarded(discarded: boolean) {
        this.rawDiscarded = discarded;
    }

    addChild(type: Type, content: string, children: Node[], node: Node): Node
    addChild(type: Type, content: string, children: Node[], index: number, relativeBegin: number, relativeEnd: number): Node
    addChild(type: Type, content: string, children: Node[], indexOrNode: number | Node, relativeBegin: number = 0, relativeEnd: number = 1): Node {
        let nNode: Node;
        if (typeof (indexOrNode) === "number") {
            nNode = new Node(type, content, children, indexOrNode + relativeBegin, indexOrNode + relativeEnd);
        }
        else {
            nNode = new Node(type, content, children, indexOrNode.begin, indexOrNode.end);
        }
        this.rawNode.children.push(nNode);
        return nNode;
    }

    addAnalysedChild(type: Type, content: string, children: Node[], node: Node): Node
    addAnalysedChild(type: Type, content: string, children: Node[], index: number, relativeBegin: number, relativeEnd: number): Node
    addAnalysedChild(type: Type, content: string, children: Node[], indexOrNode: number | Node, relativeBegin: number = 0, relativeEnd: number = 1): Node {
        let nNode: Node;
        if (typeof (indexOrNode) === "number") {
            nNode = new Node(type, content, children, indexOrNode + relativeBegin, indexOrNode + relativeEnd);
        }
        else {
            nNode = new Node(type, content, children, indexOrNode.begin, indexOrNode.end);
        }
        this.rawAnalysedNode.children.push(nNode);
        return nNode;
    }
}