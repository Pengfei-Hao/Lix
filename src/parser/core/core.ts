import { Node } from "../../sytnax-tree/node";
import { Type } from "../../sytnax-tree/type";
import { Module } from "../module";
import { Parser } from "../parser";
import { HighlightType, NodeResult, ResultState } from "../result";
import { MessageType } from "../../foundation/message";
import { BlockOption, ArgumentType } from "../block-table";

export class Core extends Module {

    // types of syntax tree node

    figureType: Type;
    figureItemType: Type;
    figureCaptionType: Type;
    
    listType: Type;
    itemType: Type;
    tableType: Type;
    tableCellType: Type;
    codeType: Type;
    
    emphType: Type;
    boldType: Type;
    italicType: Type;

    constructor(parser: Parser) {
        super(parser);

        // Init label handle function

        // **************** Basic Blocks ****************

        this.parser.basicBlocks.add("figure");
        const figureSpec: BlockOption = {
            argumentOptions: new Map([
                ["size", { type: ArgumentType.number, options: [], default: "100%" }],
            ]),
            allowReference: true
        };
        this.parser.blockTable.add("figure", this.figureBlockHandler, this, figureSpec);

        this.parser.basicBlocks.add("table");
        this.parser.blockTable.add("table", this.tableBlockHandler, this);

        this.parser.basicBlocks.add("code");
        const codeSpec: BlockOption = {
            argumentOptions: new Map(),
            allowReference: true
        };
        this.parser.blockTable.add("code", this.codeBlockHandler, this, codeSpec);

        // List
        this.parser.basicBlocks.add("list");
        const listSpec: BlockOption = {
            argumentOptions: new Map([
                ["style", { type: ArgumentType.enumeration, options: ["numbered", "unnumbered"], default: "numbered" }],
            ]),
            allowReference: false
        };
        this.parser.blockTable.add("list", this.listBlockHandler, this, listSpec);

        // Item
        this.parser.basicBlocks.add("item");
        const itemSpec: BlockOption = {
            argumentOptions: new Map([
                ["level", { type: ArgumentType.enumeration, options: ["first", "second", "third", "fourth"], default: "first" }],
            ]),
            allowReference: true
        };
        this.parser.blockTable.add("item", this.itemBlockHandler, this, itemSpec);

        // **************** Format Blocks ****************

        this.parser.formatBlocks.add("emph");
        this.parser.blockTable.add("emph", this.emphBlockHandler, this);
        
        this.parser.formatBlocks.add("bold");
        this.parser.blockTable.add("bold", this.boldBlockHandler, this);
        
        this.parser.formatBlocks.add("italic");
        this.parser.blockTable.add("italic", this.italicBlockHandler, this);

        // **************** Insertion Handler ****************

        this.parser.insertionTable.add("`", this.inlineCodeHandler, this);
        // 有问题暂时不用
        // this.parser.insertionHandlerTable.add("*", this.inlineBoldHandler, this);
        // this.parser.insertionHandlerTable.add("~", this.inlineEmphHandler, this);

        // **************** Types ****************

        // Init syntax tree node type
        this.figureType = this.parser.typeTable.add("figure");
        this.figureItemType = this.parser.typeTable.add("figure-item");
        this.figureCaptionType = this.parser.typeTable.add("figure-caption");
        this.listType = this.parser.typeTable.add("list");
        this.itemType = parser.typeTable.add("item");
        this.tableType = this.parser.typeTable.add("table");
        this.tableCellType = this.parser.typeTable.add("tableCell");
        this.codeType = this.parser.typeTable.add("code");

        this.emphType = this.parser.typeTable.add("emph");
        this.boldType = this.parser.typeTable.add("bold");
        this.italicType = this.parser.typeTable.add("italic");

    }

    init() {
        
    }

    // cleanup(node: Node) {
    //     if(node.children.length === 0) {
    //         return;
    //     }

    //     // 将 word 连起来
    //     let preIsWord = false;
    //     for(let i = 0; i < node.children.length; i++) {
    //         let ch = node.children[i];
    //         if(preIsWord && ch.type === this.parser.wordsType) {
    //             let pre = node.children[i-1];
    //             if(pre.content.endsWith(" ") && ch.content.startsWith(" ")) {
    //                 ch.content = ch.content.slice(1);
    //             }
    //             pre.content = pre.content.concat(ch.content);
    //             node.children.splice(i, 1);
    //             i--;
    //             continue;
    //         }

    //         if(ch.type === this.parser.wordsType) {
    //             preIsWord = true;
    //         }
    //         else {
    //             preIsWord = false;
    //         }
    //     }

    //     // 去除首尾空格
    //     let i = 0;
    //     let ch = node.children[0];
    //     if(ch.type === this.parser.argumentsType) {
    //         if(node.children.length <= 1) {
    //             return;
    //         }
    //         i = 1;
    //         ch = node.children[1];
    //     }
    //     if(ch.type === this.parser.wordsType && ch.content.startsWith(" ")) {
    //         ch.content = ch.content.slice(1);
    //         if(ch.content.length === 0) {
    //             node.children.splice(i, 1);
    //         }
    //     }
    //     if(node.children.length === 0) {
    //         return;
    //     }
    //     ch = node.children.at(-1)!;
    //     if(ch.type === this.parser.wordsType && ch.content.endsWith(" ")) {
    //         ch.content = ch.content.slice(0, -1);
    //         if(ch.content.length === 0) {
    //             node.children.splice(-1, 1);
    //         }
    //     }
    // }

    emphBlockHandler(args: Node): NodeResult {
        return this.parser.formatLikeBlockHandler("emph", this.emphType, args);

        // let result = new Result<Node>(new Node(this.parser.textType));
        // let preIndex = this.parser.index;
        // this.parser.begin("emph-block-handler");
        // this.myFormatBlockHandler(result, args);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // result.content.type = this.emphType;
        // this.parser.cleanupText(result.content);
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    boldBlockHandler(args: Node): NodeResult {
        return this.parser.formatLikeBlockHandler("bold", this.boldType, args);
        
        // let result = new Result<Node>(new Node(this.parser.textType));
        // let preIndex = this.parser.index;
        // this.parser.begin("bold-block-handler");
        // this.myFormatBlockHandler(result, args);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // result.content.type = this.boldType;
        // this.parser.cleanupText(result.content);
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    italicBlockHandler(args: Node): NodeResult {
        return this.parser.formatLikeBlockHandler("italic", this.italicType, args);

        // let result = new Result<Node>(new Node(this.parser.textType));
        // let preIndex = this.parser.index;
        // this.parser.begin("italic-block-handler");
        // this.myFormatBlockHandler(result, args);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // result.content.type = this.italicType;
        // this.parser.cleanupText(result.content);
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    /*
    inlineEmphHandler(): Result<Node> {
        let result = new Result<Node>(new Node(this.emphType));
        let preIndex = this.parser.index;
        this.parser.begin("inline-emph-handler");
        this.myInlineFormatHandler(result, "~");
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.emphType;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    inlineBoldHandler(): Result<Node> {
        let result = new Result<Node>(new Node(this.boldType));
        let preIndex = this.parser.index;
        this.parser.begin("inline-bold-handler");
        this.myInlineFormatHandler(result, "*");
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.boldType;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    private myInlineFormatHandler(result: Result<Node>, endWith: string) {
        let node = result.content;
        let msg = result.messages;

        let text = "";
        let symRes: Result<null>;
        let blnRes: Result<number>;
        let ndRes: Result<Node>;

        let preIndex = 0, curIndex;

        result.merge(this.parser.match(endWith));
        if(result.shouldTerminate) {
            result.addMessage(`Missing '${endWith}' in inline format.`), MessageType.error, this.parser.index);
            return;
        }
        result.highlights.push(this.parser.getHighlight(HighlightType.operator, -1, 0));

        while (true) {
            if (this.parser.isEOF()) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, this.parser.index));
                }
                result.addMessage("Inline format ended abruptly."), MessageType.error, this.parser.index);
                result.mergeState(ResultState.skippable);
                return;
            }

            else if (this.parser.is(endWith)) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, this.parser.index));
                    text = "";
                }
                break;
            }

            else if(this.parser.isMultilineBlankGeThanOne()) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, this.parser.index));
                    text = "";
                }
                result.addMessage("Inline format ended abruptly."), MessageType.error, this.parser.index);
                result.mergeState(ResultState.skippable);
                return;
            }

            else if ((blnRes = this.parser.matchMultilineBlank()).matched) { // 结束条件判断过大于一行的空行, 这里只能是一行以内的
                if(text === "") {
                    preIndex = this.parser.index;
                }
                result.merge(blnRes);
                text += " ";
                if (blnRes.content > 1) {
                    result.addMessage("Inline format cannot contain linebreaks more than 1.", MessageType.warning), MessageType.error, this.parser.index);
                    //result.mergeState(ResultState.skippable);
                }
            }

            else if ((curIndex = this.parser.index, symRes = this.parser.match("\\\\")).matched) {
                if(text === "") {
                    preIndex = curIndex;
                }
                result.addMessage("Inline format should not have \\\\.", MessageType.warning), MessageType.error, this.parser.index);
                text += "\\\\";
                //result.mergeState(ResultState.skippable);
            }

            else if((curIndex = this.parser.index, ndRes = this.parser.matchEscapeChar()).matched) {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.merge(ndRes);
                text += ndRes.content.content;
            }

            else if ((curIndex = this.parser.index, ndRes = this.parser.matchInsertion()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(ndRes);
                // 不会失败
                node.children.push(ndRes.content);
            }

            else if (this.parser.isBlock()) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, this.parser.index));
                    text = "";
                }
                result.addMessage("Inline format should not have block."), MessageType.error, this.parser.index);
                result.mergeState(ResultState.skippable);
                this.parser.skipByBrackets();
            }

            else {
                if(text === "") {
                    preIndex = this.parser.index;
                }
                result.mergeState(ResultState.successful);
                text += this.parser.curChar();
                this.parser.move();
            }
        }

        result.merge(this.parser.match(endWith));
        if(result.shouldTerminate) {
            result.addMessage(`Missing '${endWith}' in inline format.`), MessageType.error, this.parser.index);
            return;
        }
        result.highlights.push(this.parser.getHighlight(HighlightType.operator, -1, 0));
    }
    */

    figureBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.figureType, "figure-block-handler", this.myFigureBlockHandler, this, this.parser.defaultAnalysis);

        // let result = new Result<Node>(new Node(this.figureType));
        // let preIndex = this.parser.index;
        // this.parser.begin("figure-block-handler");
        // this.myFigureBlockHandler(result, args);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    private myFigureBlockHandler(result: NodeResult, args: Node = new Node(this.parser.argumentsType)) {
        
        let node = result.node;

        // for(let n of args.children) {
        //     if(n.content == "small" || n.content == "medium" || n.content == "large") {
        //         node.content = n.content;
        //     }
        // }
        this.parser.skipBlank();

        result.merge(this.parser.match("["));
        if (result.shouldTerminate) {
            result.addMessage("Missing '[' in figure.", MessageType.error, this.parser.index);
            return;
        }

        let ndRes = this.figureCaptionHandler();
        result.merge(ndRes);
        if (result.shouldTerminate) {
            result.addMessage("Match caption failed.", MessageType.error, this.parser.index);
            return;
        }
        node.children.push(ndRes.node);

        result.merge(this.parser.match("]"));
        if (result.shouldTerminate) {
            result.addMessage("Missing ']' in figure.", MessageType.error, this.parser.index);
            return;
        }

        this.parser.skipBlank();

        let symRes: BasicResult;

        while (true) {
            let itemNode = new Node(this.figureItemType, "");
            if(this.parser.isEOF()) {
                result.mergeState(ResultState.skippable);
                result.addMessage("Figure block ended abruptly.", MessageType.error, this.parser.index);
                return;
            }
            else if(this.parser.is("]")) {
                return;
            }

            result.merge(this.parser.match("`"));
            if(result.shouldTerminate) {
                result.addMessage("Missing '`' in figure.", MessageType.error, this.parser.index);
                return;
            }
            itemNode.begin = this.parser.index - 1;

            while(true) {
                if(this.parser.isEOF()) {
                    result.addMessage("Abruptly end.", MessageType.error, this.parser.index);
                    result.mergeState(ResultState.skippable);
                    return;
                }
                else if((symRes = this.parser.match("\n")).matched) {
                    result.merge(symRes);
                    result.addMessage("Figure path should not have line break.", MessageType.error, this.parser.index);
                    return;
                }
                else if((symRes = this.parser.match("`")).matched) {
                    result.merge(symRes);
                    itemNode.end = this.parser.index -1;
                    result.highlights.push(this.parser.getHighlight(HighlightType.string, itemNode));
                    break;
                }
                else {
                    itemNode.content += this.parser.curChar();
                    this.parser.move();
                }
            }
            node.children.push(itemNode);

            this.parser.skipBlank();

            if ((symRes = this.parser.match("[")).matched) {
                result.merge(symRes);
        
                let ndRes = this.figureCaptionHandler();
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    result.addMessage("Match sub-caption failed.", MessageType.error, this.parser.index);
                    return;
                }
                itemNode.children.push(ndRes.node);
        
                result.merge(this.parser.match("]"));
                if (result.shouldTerminate) {
                    result.addMessage("Missing ']' in sub-figure.", MessageType.error, this.parser.index);
                    return;
                }
            }

            this.parser.skipBlank();
        }
    }

    figureCaptionHandler(args: Node = new Node(this.parser.argumentsType)): NodeResult {
        return this.parser.textLikeBlockHandler("figure-caption", this.figureCaptionType, args);

        // let result = new Result<Node>(new Node(this.figureCaptionType));
        // let preIndex = this.parser.index;
        // this.parser.begin("figure-caption-handler");
        // this.parser.myTextLikeBlockHandler("figure-caption", result, args);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // result.content.type = this.figureCaptionType;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    inlineCodeHandler(): NodeResult {
        return this.parser.prepareMatch(this.codeType, "inline-code-handler", this.myInlineCodeHandler, this, this.parser.defaultAnalysis);

        // let result = new Result<Node>(new Node(this.codeType));
        // let preIndex = this.parser.index;
        // this.parser.begin("inline-code-handler");
        // this.myInlineCodeHandler(result);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    private myInlineCodeHandler(result: NodeResult) {
        let node = result.node;

        let symRes: BasicResult;
        let count = 0;
        while((symRes = this.parser.match("`")).matched) {
            result.merge(symRes);
            count++;
        }
        if(count !== 0) {
            result.highlights.push(this.parser.getHighlight(HighlightType.operator, -count, 0));
        }

        let occur = 0;
        while (true) {
            if(this.parser.isEOF()) {
                result.mergeState(ResultState.skippable);
                result.addMessage("Inline code ended abruptly.", MessageType.error, this.parser.index);
                return;
            }

            else if(this.parser.isMultilineBlankGtOne()) {
                result.mergeState(ResultState.skippable);
                result.addMessage("Inline code ended abruptly.", MessageType.error, this.parser.index);
                return;
            }

            else if((symRes = this.parser.match("`")).matched) {
                result.merge(symRes);
                occur++;
                node.content += "`";
                if(occur == count) {
                    if(count !== 0) {
                        node.content = node.content.slice(0, -count);
                        result.highlights.push(this.parser.getHighlight(HighlightType.operator, -count, 0));
                    }
                    return;
                }
            }

            else {
                result.mergeState(ResultState.successful);
                occur = 0;
                node.content += this.parser.curChar();
                this.parser.move();
            }

        }
    }

    codeBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.codeType, "code-block-handler", this.myCodeBlockHandler, this, this.parser.defaultAnalysis);

        // let result = new Result<Node>(new Node(this.codeType));
        // let preIndex = this.parser.index;
        // this.parser.begin("code-block-handler");
        // this.myCodeBlockHandler(result, args);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    private myCodeBlockHandler(result: NodeResult, args: Node = new Node(this.parser.argumentsType)) {
        let node = result.node;

        result.merge(this.parser.skipBlank());

        let symRes: BasicResult;
        let count = 0;
        while((symRes = this.parser.match("`")).matched) {
            result.merge(symRes);
            count++;
        }
        if(count !== 0) {
            result.highlights.push(this.parser.getHighlight(HighlightType.operator, -count, 0));
        }

        result.merge(this.parser.skipBlank());

        result.merge(this.parser.match("\n"));
        if(result.shouldTerminate) {
            result.addMessage("First line should not have codes.", MessageType.error, this.parser.index);
            return;
        }

        let occur = 0;
        while (true) {
            if(this.parser.isEOF()) {
                result.mergeState(ResultState.skippable);
                result.addMessage("Code block ended abruptly.", MessageType.error, this.parser.index);
                return;
            }
            else if(this.parser.is("]")) {
                if(occur >= count) {
                    if(count !== 0) {
                        node.content = node.content.slice(0, -count);
                        result.highlights.push(this.parser.getHighlight(HighlightType.operator, -count, 0));
                    }
                    return;
                }
                occur=0;
                node.content += "]";
                result.merge(this.parser.match("]"));
            }

            else if((symRes = this.parser.match("`")).matched) {
                result.merge(symRes);
                occur++;
                node.content += "`";
            }

            else {
                result.mergeState(ResultState.successful);
                occur = 0;
                node.content += this.parser.curChar();
                this.parser.move();
            }

        }
    }

    listBlockHandler(args: Node): NodeResult {
        return this.parser.paragraphLikeBlockHandler("list", this.listType, args);
    }

    itemBlockHandler(args: Node): NodeResult {
        let result = this.parser.formatLikeBlockHandler("item", this.itemType, args);
        result.discarded = false;
        return result;
    }

        // TextBlockHandler: failing | skippable | successful


    tableBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.tableType, "table-block-handler", this.myTableBlockHandler, this, this.parser.defaultAnalysis, this.parser);

        // let result = new Result<Node>(new Node(this.codeType));
        // let preIndex = this.parser.index;
        // this.parser.begin("code-block-handler");
        // this.myCodeBlockHandler(result, args);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    private myTableBlockHandler(result: NodeResult, args: Node = new Node(this.parser.argumentsType)) {
        let node = result.node;

        let symRes: BasicResult;
        let nodeRes: NodeResult;
        result.mergeState(ResultState.successful);

        let column = new Node(this.tableCellType);
        result.node.children.push(column);

        while (true) {
            if (this.parser.isEOF()) {
                result.mergeState(ResultState.skippable);
                result.addMessage("Code block ended abruptly.", MessageType.error, this.parser.index);
                return;
            }
            else if (this.parser.is("]")) {
                break;

            }

            else if ((symRes = this.parser.match("&")).matched) {
                result.merge(symRes);
                result.highlights.push(this.parser.getHighlight(HighlightType.operator, 0, -1));
            }
            else if ((symRes = this.parser.match(";")).matched) {
                result.merge(symRes);
                this.parser.mergeHighlight(result, HighlightType.operator, 0, -1);
                column = new Node(this.tableCellType);
                result.node.children.push(column);

            }
            else if ((nodeRes = this.matchTableCell()).matched) {
                result.merge(nodeRes);
                column.children.push(nodeRes.analysedNode);
            }

            else {
                // 理论上不会出现
                result.mergeState(ResultState.failing);
                result.addMessage("[[Logical Error]] Matching table cell failed.", MessageType.error, this.parser.index);
                return;
            }

        }
    }

    matchTableCell(): NodeResult {
        return this.parser.prepareMatch(this.tableCellType, "table-cell", this.myMatchTableCell, this, this.parser.cleanupText, this.parser);

        // let result = new Result<Node>(new Node(this.textType));
        // result.analysedContent = new Node(this.textType);
        // let preIndex = this.index;
        // this.begin("text-block-handler");
        // this.myTextBlockHandler(result, args);
        // this.end();
        // result.content.begin = preIndex;
        // result.content.end = this.index;
        // this.cleanupText(result.analysedContent);
        // result.discarded = (result.analysedContent.children.length === 0);
        // if (result.failed) {
        //     this.index = preIndex;
        // }
        // return result;
    }

    private myMatchTableCell(result: NodeResult) {
        let node = result.node;
        let analysedNode = result.analysedNode;

        let text = "";
        let symRes: BasicResult;
        let blkRes: NodeResult<number>;
        let nodeRes: NodeResult;

        let preIndex = 0, curIndex: number;

        // node.children.push(args);

        const mergeWordsNode = () => {
            if (text !== "") {
                node.children.push(new Node(this.parser.wordsType, text, [], preIndex, curIndex));
                analysedNode.children.push(new Node(this.parser.wordsType, text, [], preIndex, curIndex));
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        result.mergeState(ResultState.successful);

        // for (let arg of args.children) {
        //     if (arg.content === "noindent") {
        //         node.content = "noindent";
        //     }
        //     if (arg.content === "indent") {
        //         node.content = "indent";
        //     }
        // }

        while (true) {
            curIndex = this.parser.index;

            if (this.parser.isEOF()) {
                mergeWordsNode();
                result.addMessage("Text block ended abruptly.", MessageType.error, this.parser.index);
                result.mergeState(ResultState.skippable);
                break;
            }
            else if (this.parser.is("]")) {
                mergeWordsNode();
                break;
            }
            else if (this.parser.is("&")) {
                mergeWordsNode();
                break;
            }
            else if (this.parser.is(";")) {
                mergeWordsNode();
                break;
            }
            else if (this.parser.isMultilineBlankGtOne()) {
                mergeWordsNode();
                result.addMessage("Text block ended abruptly.", MessageType.error, this.parser.index);
                result.mergeState(ResultState.skippable);
                return;
            }

            else if ((blkRes = this.parser.matchMultilineBlank()).matched) {
                resetIndex();
                result.merge(blkRes);
                text += " ";

                if (blkRes.node > 1) {
                    result.addMessage("Text block cannot contain linebreaks more than 1.", MessageType.warning, MessageType.error, this.parser.index);
                    //result.mergeState(ResultState.skippable);
                }
            }

            else if ((symRes = this.parser.match("\\\\")).matched) {
                resetIndex();
                result.addMessage("Text block should not have \\\\.", MessageType.warning, MessageType.error, this.parser.index);
                text += "\\\\";
                //result.mergeState(ResultState.skippable);
            }

            else if ((nodeRes = this.parser.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes);
                text += nodeRes.node.content;
            }

            else if ((nodeRes = this.parser.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes);
                // 不会失败
                this.parser.mergeNodeToChildren(result, nodeRes);
            }

            else if (this.parser.isBasicBlock()) {
                mergeWordsNode();

                result.addMessage("Text block should not have basic block", MessageType.error, this.parser.index);
                result.mergeState(ResultState.skippable);
                this.parser.skipByBrackets();
            }

            else if (this.parser.isStructuralBlock()) {
                mergeWordsNode();
                result.addMessage("Text block should not have other block", MessageType.error, this.parser.index);
                result.mergeState(ResultState.skippable);
                this.parser.skipByBrackets();
            }

            else if ((nodeRes = this.parser.matchFormatBlock()).matched) {
                // 只能是 format block 前边判断过
                mergeWordsNode();
                result.merge(nodeRes);
                // match block 不会失败
                this.parser.mergeNodeToChildren(result, nodeRes);
            }

            else {
                resetIndex();
                result.mergeState(ResultState.successful);
                text += this.parser.curChar();
                this.parser.move();
            }
        }
    }
}
