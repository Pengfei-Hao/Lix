import { Range } from "../source-text";
import { Node } from "../syntax-tree/node";
import { Type } from "../syntax-tree/type-table";
import { FileRecordList } from "./file-record";
import { HighlightList } from "./highlight";
import { ReferenceList } from "./reference";
import { Result } from "./result";


export class MatchResult<T> extends Result {

    // content
    value: T;
    range: Range;

    constructor(value: T, range: Range) {
        super();
        this.value = value;
        this.range = range;
    }
}

export enum MergeStrategy {
    AppendChild,
    Transfer,
    None
}

export class NodeResult extends Result {

    // content
    public readonly highlightList: HighlightList;
    public readonly referenceList: ReferenceList;
    public readonly fileRecordList: FileRecordList;

    public readonly node: Node;
    public readonly analysedNode: Node;
    public discarded: boolean;

    constructor(node: Node, analysedNode: Node, discarded = false) {
        super();

        this.highlightList = new HighlightList();
        this.referenceList = new ReferenceList();
        this.fileRecordList = new FileRecordList();

        this.node = node;
        this.discarded = discarded;
        this.analysedNode = analysedNode;
    }

    override merge(result: NodeResult, nodeStrategy: MergeStrategy, analysedNodeStrategy: MergeStrategy): NodeResult;
    override merge<T extends Result>(result: T): T;
    override merge<T extends Result>(result: T, nodeStrategy?: MergeStrategy, analysedNodeStrategy?: MergeStrategy): T {
        super.merge(result);
        if (result instanceof NodeResult) {
            this.highlightList.push(...result.highlightList.items);
            this.referenceList.push(...result.referenceList.items);
            this.fileRecordList.push(...result.fileRecordList.items);

            switch (nodeStrategy) {
                case MergeStrategy.AppendChild:
                    this.node.children.push(result.node);
                    break;
                case MergeStrategy.Transfer:
                    result.node.transferTo(this.node);
                    break;
                default:
                    break;
            }
            switch (analysedNodeStrategy) {
                case MergeStrategy.AppendChild:
                    if (!result.discarded) {
                        this.analysedNode.children.push(result.analysedNode);
                    }
                    break;
                case MergeStrategy.Transfer:
                    result.analysedNode.transferTo(this.analysedNode);
                    break;
                default:
                    break;
            }
        }
        return result;
    }

    setNodeRange(range: Range) {
        this.node.range = range;
    }

    setAnalysedNodeRange(range: Range) {
        this.analysedNode.range = range;
    }

    setNodeContent(content: string) {
        this.node.content = content;
    }

    appendNodeContent(content: string) {
        this.node.content += content;
    }

    setAnalysedNodeContent(content: string) {
        this.analysedNode.content = content;
    }

    appendAnalysedNodeContent(content: string) {
        this.analysedNode.content += content;
    }

    setNodeType(type: Type) {
        this.node.type = type;
    }

    setAnalysedNodeType(type: Type) {
        this.analysedNode.type = type;
    }

    setDiscarded(discarded: boolean) {
        this.discarded = discarded;
    }

    addChild(type: Type, range: Range, content: string = "", children: Node[] = []): Node {
        let nNode = new Node(type, range, content, children);
        this.node.children.push(nNode);
        return nNode;
    }

    addAnalysedChild(type: Type, range: Range, content: string = "", children: Node[] = []): Node {
        let nNode = new Node(type, range, content, children);
        this.analysedNode.children.push(nNode);
        return nNode;
    }
}
