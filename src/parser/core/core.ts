import { Node } from "../../sytnax-tree/node";
import { Type } from "../../sytnax-tree/type";
import { Module } from "../module";
import { Parser } from "../parser";
import { HighlightType, Result, ResultState } from "../../foundation/result";
import { MessageType } from "../../foundation/message";

export class Core extends Module {

    // types of syntax tree node

    figureType: Type;
    figureItemType: Type;
    figureCaptionType: Type;
    
    listType: Type;
    tableType: Type;
    codeType: Type;
    
    emphType: Type;
    boldType: Type;
    italicType: Type;

    constructor(parser: Parser) {
        super(parser);

        // Init label handle function

        // basic blocks
        this.parser.basicBlocks.add("figure");
        this.parser.basicBlocks.add("list");
        this.parser.basicBlocks.add("table");
        this.parser.basicBlocks.add("code");
        this.parser.blockHandlerTable.add("figure", this.figureBlockHandler, this);
        this.parser.blockHandlerTable.add("list", this.parser.textBlockHandler, this.parser);
        this.parser.blockHandlerTable.add("table", this.parser.textBlockHandler, this.parser);
        this.parser.blockHandlerTable.add("code", this.codeBlockHandler, this);

        // format blocks
        this.parser.formatBlocks.add("emph");
        this.parser.formatBlocks.add("bold");
        this.parser.formatBlocks.add("italic");
        this.parser.blockHandlerTable.add("emph", this.emphBlockHandler, this);
        this.parser.blockHandlerTable.add("bold", this.boldBlockHandler, this);
        this.parser.blockHandlerTable.add("italic", this.italicBlockHandler, this);

        this.parser.insertionHandlerTable.add("`", this.inlineCodeHandler, this);
        // 有问题暂时不用
        // this.parser.insertionHandlerTable.add("*", this.inlineBoldHandler, this);
        // this.parser.insertionHandlerTable.add("~", this.inlineEmphHandler, this);

        // Init syntax tree node type
        this.figureType = this.parser.typeTable.add("figure")!;
        this.figureItemType = this.parser.typeTable.add("figure-item")!;
        this.figureCaptionType = this.parser.typeTable.add("figure-caption")!;

        // Types
        this.listType = this.parser.typeTable.add("list")!;
        this.tableType = this.parser.typeTable.add("table")!;
        this.codeType = this.parser.typeTable.add("code")!;
        this.emphType = this.parser.typeTable.add("emph")!;
        this.boldType = this.parser.typeTable.add("bold")!;
        this.italicType = this.parser.typeTable.add("italic")!;

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

    emphBlockHandler(args: Node): Result<Node> {
        let result = new Result<Node>(new Node(this.parser.textType));
        let preIndex = this.parser.index;
        this.parser.begin("emph-block-handler");
        this.myFormatBlockHandler(result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.emphType;
        this.parser.cleanupText(result.content);
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    boldBlockHandler(args: Node): Result<Node> {
        let result = new Result<Node>(new Node(this.parser.textType));
        let preIndex = this.parser.index;
        this.parser.begin("bold-block-handler");
        this.myFormatBlockHandler(result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.boldType;
        this.parser.cleanupText(result.content);
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    italicBlockHandler(args: Node): Result<Node> {
        let result = new Result<Node>(new Node(this.parser.textType));
        let preIndex = this.parser.index;
        this.parser.begin("italic-block-handler");
        this.myFormatBlockHandler(result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.italicType;
        this.parser.cleanupText(result.content);
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    private myFormatBlockHandler(result: Result<Node>, args: Node) {
        let node = result.content;
        let msg = result.messages;

        let text = "";
        let symRes: Result<null>;
        let blnRes: Result<number>;
        let ndRes: Result<Node>;

        let preIndex = 0, curIndex;

        node.children.push(args);

        result.mergeState(ResultState.successful);

        while (true) {
            curIndex = this.parser.index;

            if (this.parser.isEOF()) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, curIndex));
                }
                msg.push(this.parser.getMessage("Format block ended abruptly."));
                result.mergeState(ResultState.skippable);
                break;
            }

            else if (this.parser.is("]")) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                return;
            }

            else if(this.parser.isMultilineBlankGeThanOne()) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex,curIndex));
                    text = "";
                }
                msg.push(this.parser.getMessage("Format block ended abruptly."));
                result.mergeState(ResultState.skippable);
                return;
            }

            else if ((blnRes = this.parser.matchMultilineBlank()).matched) { // 结束条件判断过大于一行的空行, 这里只能是一行以内的
                if(text === "") {
                    preIndex = curIndex;
                }
                result.merge(blnRes);
                text += " ";
                if (blnRes.content > 1) {
                    msg.push(this.parser.getMessage("Format block cannot contain linebreaks more than 1.", MessageType.warning));
                    //result.mergeState(ResultState.skippable);
                }
            }

            else if ((symRes = this.parser.match("\\\\")).matched) {
                if(text === "") {
                    preIndex = curIndex;
                }
                msg.push(this.parser.getMessage("Format block should not have \\\\.", MessageType.warning));
                text += "\\\\";
                //result.mergeState(ResultState.skippable);
            }

            else if((ndRes = this.parser.matchEscapeChar()).matched) {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.merge(ndRes);
                text += ndRes.content.content;
            }

            else if ((ndRes = this.parser.matchInsertion()).matched) {
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
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                msg.push(this.parser.getMessage("Format block should not have block."));
                result.mergeState(ResultState.skippable);
                this.parser.skipByBrackets();
            }

            else {
                if(text === "") {
                    preIndex = curIndex;
                }
                result.mergeState(ResultState.successful);
                text += this.parser.curChar();
                this.parser.move();
            }
        }
    }

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
            msg.push(this.parser.getMessage(`Missing '${endWith}' in inline format.`));
            return;
        }
        result.highlights.push(this.parser.getHighlight(HighlightType.operator, -1, 0));

        while (true) {
            if (this.parser.isEOF()) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, this.parser.index));
                }
                msg.push(this.parser.getMessage("Inline format ended abruptly."));
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
                msg.push(this.parser.getMessage("Inline format ended abruptly."));
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
                    msg.push(this.parser.getMessage("Inline format cannot contain linebreaks more than 1.", MessageType.warning));
                    //result.mergeState(ResultState.skippable);
                }
            }

            else if ((curIndex = this.parser.index, symRes = this.parser.match("\\\\")).matched) {
                if(text === "") {
                    preIndex = curIndex;
                }
                msg.push(this.parser.getMessage("Inline format should not have \\\\.", MessageType.warning));
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
                msg.push(this.parser.getMessage("Inline format should not have block."));
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
            msg.push(this.parser.getMessage(`Missing '${endWith}' in inline format.`));
            return;
        }
        result.highlights.push(this.parser.getHighlight(HighlightType.operator, -1, 0));
    }

    figureBlockHandler(args: Node): Result<Node> {
        let result = new Result<Node>(new Node(this.figureType));
        let preIndex = this.parser.index;
        this.parser.begin("figure-block-handler");
        this.myFigureBlockHandler(result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    private myFigureBlockHandler(result: Result<Node>, args: Node) {
        
        let node = result.content;
        let msg = result.messages;

        for(let n of args.children) {
            if(n.content == "small" || n.content == "medium" || n.content == "large") {
                node.content = n.content;
            }
        }
        this.parser.skipBlank();

        result.merge(this.parser.match("["));
        if (result.shouldTerminate) {
            msg.push(this.parser.getMessage("Missing '[' in figure."));
            return;
        }

        let ndRes = this.figureCaptionHandler();
        result.merge(ndRes);
        if (result.shouldTerminate) {
            msg.push(this.parser.getMessage("Match caption failed."));
            return;
        }
        node.children.push(ndRes.content);

        result.merge(this.parser.match("]"));
        if (result.shouldTerminate) {
            msg.push(this.parser.getMessage("Missing ']' in figure."));
            return;
        }

        this.parser.skipBlank();

        let symRes: Result<null>;

        while (true) {
            let itemNode = new Node(this.figureItemType, "");
            if(this.parser.isEOF()) {
                result.mergeState(ResultState.skippable);
                msg.push(this.parser.getMessage("Figure block ended abruptly."));
                return;
            }
            else if(this.parser.is("]")) {
                return;
            }

            result.merge(this.parser.match("`"));
            if(result.shouldTerminate) {
                msg.push(this.parser.getMessage("Missing '`' in figure."));
                return;
            }
            itemNode.begin = this.parser.index - 1;

            while(true) {
                if(this.parser.isEOF()) {
                    msg.push(this.parser.getMessage("Abruptly end."));
                    result.mergeState(ResultState.skippable);
                    return;
                }
                else if((symRes = this.parser.match("\n")).matched) {
                    result.merge(symRes);
                    msg.push(this.parser.getMessage("Figure path should not have line break."));
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
                    msg.push(this.parser.getMessage("Match sub-caption failed."));
                    return;
                }
                itemNode.children.push(ndRes.content);
        
                result.merge(this.parser.match("]"));
                if (result.shouldTerminate) {
                    msg.push(this.parser.getMessage("Missing ']' in sub-figure."));
                    return;
                }
            }

            this.parser.skipBlank();
        }
    }

    figureCaptionHandler(args: Node = new Node(this.parser.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.figureCaptionType));
        let preIndex = this.parser.index;
        this.parser.begin("figure-caption-handler");
        this.parser.myTextLikeBlockHandler("figure-caption", result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.figureCaptionType;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    inlineCodeHandler(): Result<Node> {
        let result = new Result<Node>(new Node(this.codeType));
        let preIndex = this.parser.index;
        this.parser.begin("inline-code-handler");
        this.myInlineCodeHandler(result);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    private myInlineCodeHandler(result: Result<Node>) {
        let node = result.content;
        let msg = result.messages;

        let symRes: Result<null>;
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
                msg.push(this.parser.getMessage("Inline code ended abruptly."));
                return;
            }

            else if(this.parser.isMultilineBlankGeThanOne()) {
                result.mergeState(ResultState.skippable);
                msg.push(this.parser.getMessage("Inline code ended abruptly."));
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

    codeBlockHandler(args: Node): Result<Node> {
        let result = new Result<Node>(new Node(this.codeType));
        let preIndex = this.parser.index;
        this.parser.begin("code-block-handler");
        this.myCodeBlockHandler(result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    private myCodeBlockHandler(result: Result<Node>, args: Node) {
        let node = result.content;
        let msg = result.messages;

        result.merge(this.parser.skipBlank());

        let symRes: Result<null>;
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
            msg.push(this.parser.getMessage("First line should not have codes."));
            return;
        }

        let occur = 0;
        while (true) {
            if(this.parser.isEOF()) {
                result.mergeState(ResultState.skippable);
                msg.push(this.parser.getMessage("Code block ended abruptly."));
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
}
