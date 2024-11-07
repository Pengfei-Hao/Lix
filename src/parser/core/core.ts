
import exp = require("constants");
import { Node } from "../../sytnax-tree/node";
import { Type } from "../../sytnax-tree/type";
import { Module } from "../module";
import { MatchResult, Parser } from "../parser";
import { HighlightType, Result, ResultState } from "../../foundation/result";
import { MessageType } from "../../foundation/message";
import { Message } from "../../foundation/message";
import { parse } from "path";

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
        this.parser.blockHandlerTable.add("code", this.parser.textBlockHandler, this.parser);

        // format blocks
        this.parser.formatBlocks.add("emph");
        this.parser.formatBlocks.add("bold");
        this.parser.formatBlocks.add("italic");
        this.parser.blockHandlerTable.add("emph", this.emphBlockHandler, this);
        this.parser.blockHandlerTable.add("bold", this.boldBlockHandler, this);
        this.parser.blockHandlerTable.add("italic", this.italicBlockHandler, this);


                /*this.labelHandlerTable.add("title", this.defaultBlockHandler.bind(this, 1), this);
        this.labelHandlerTable.add("author", this.defaultBlockHandler.bind(this, 2), this);
        this.labelHandlerTable.add("section", this.defaultBlockHandler.bind(this, 3), this);
        this.labelHandlerTable.add("subsection", this.defaultBlockHandler.bind(this, 4), this);
        this.labelHandlerTable.add("_1", this.defaultBlockHandler.bind(this, 5), this);
        */

        // Init syntax tree node type
        this.figureType = this.parser.typeTable.add("figure")!;
        this.figureItemType = this.parser.typeTable.add("figure-item")!;
        this.figureCaptionType = this.parser.typeTable.add("figure-caption")!;

        this.listType = this.parser.typeTable.add("list")!;
        this.tableType = this.parser.typeTable.add("table")!;
        this.codeType = this.parser.typeTable.add("code")!;
        this.emphType = this.parser.typeTable.add("emph")!;
        this.boldType = this.parser.typeTable.add("bold")!;
        this.italicType = this.parser.typeTable.add("italic")!;

    }

    init() {
        
    }

    emphBlockHandler(args: Node = new Node(this.parser.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.parser.textType));
        let preIndex = this.parser.index;
        this.parser.begin("emph-block-handler");
        this.myFormatBlockHandler(result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.emphType;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    boldBlockHandler(args: Node = new Node(this.parser.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.parser.textType));
        let preIndex = this.parser.index;
        this.parser.begin("bold-block-handler");
        this.myFormatBlockHandler(result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.boldType;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    italicBlockHandler(args: Node = new Node(this.parser.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.parser.textType));
        let preIndex = this.parser.index;
        this.parser.begin("italic-block-handler");
        this.myFormatBlockHandler(result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.italicType;
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

        while (true) {
            if (this.parser.isEOF()) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, this.parser.index));
                }
                msg.push(this.parser.getMessage("Format text ends abruptly.", MessageType.warning));
                result.mergeState(ResultState.skippable);

                break;
            }

            else if (this.parser.is("]")) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, this.parser.index));
                    text = "";
                }
                result.mergeState(ResultState.successful);
                this.parser.move();
                return;
            }

            else if ((blnRes = this.parser.matchMultilineBlank()).matched) { // 结束条件判断过大于一行的空行, 这里只能是一行以内的
                if(text === "") {
                    preIndex = this.parser.index;
                }
                result.merge(blnRes);
                text += " ";
                if (blnRes.content > 1) {
                    msg.push(this.parser.getMessage("Format text should not have multiline breaks."));
                    result.mergeState(ResultState.skippable);
                }
            }

            else if ((curIndex = this.parser.index, symRes = this.parser.match("\\\\")).matched) {
                if(text === "") {
                    preIndex = curIndex;
                }
                msg.push(this.parser.getMessage("Format text should not have \\\\."));
                text += "\\\\";
                result.mergeState(ResultState.skippable);
            }

            else if ((curIndex = this.parser.index, symRes = this.parser.match("\\")).matched) {
                if(text === "") {
                    preIndex = curIndex;
                }
                result.merge(symRes);
                if (this.parser.notEnd()) {
                    switch (this.parser.curChar()) {
                        case "(": case ")":
                        case "[": case "]": case "/": case "#": case "@":
                            text += this.parser.curChar();
                            break;
                        // 这里不需要判断 \\ 因为结束条件判断过
                        default:
                            text += "\\";
                            text += this.parser.curChar();
                            msg.push(this.parser.getMessage(`\\${this.parser.curChar()} do not represent any char.`, MessageType.warning));
                    }
                    this.parser.move();
                }
                else {
                    text += "\\";
                    msg.push(this.parser.getMessage("Format text ends abruptly.", MessageType.warning));
                    result.mergeState(ResultState.skippable);
                }
            }

            else if ((curIndex = this.parser.index, ndRes = this.parser.matchReference()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(ndRes);

                if (result.shouldTerminate) {
                    //msg.push(this.parser.getMessage("Match reference failed."));
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if ((curIndex = this.parser.index, ndRes = this.parser.mathModule.matchInlineFormula()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(ndRes);
                this.parser.move();

                if (result.shouldTerminate) {
                    //msg.push(this.parser.getMessage("Match embeded formula failed."));
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if (this.parser.isBlock()) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, this.parser.index));
                    text = "";
                }
                msg.push(this.parser.getMessage("Format text should not have block."));
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
            msg.push(this.parser.getMessage("Missing '['."));
            return;
        }

        let ndRes = new Result(new Node(this.figureCaptionType));
        this.parser.myTextLikeBlockHandler("figure", ndRes);
        result.merge(ndRes);
        if (result.shouldTerminate) {
            msg.push(this.parser.getMessage("Match caption failed."));
            return;
        }
        node.children.push(ndRes.content);

        this.parser.skipBlank();

        let symRes: Result<null>;

        while (true) {
            let itemNode = new Node(this.figureItemType, "");
            if(this.parser.isEOF()) {
                result.mergeState(ResultState.skippable);
                msg.push(this.parser.getMessage("Figure block ended abruptly."));
                return;
            }
            else if((symRes = this.parser.match("]")).matched) {
                result.merge(symRes);
                return;
            }

            result.merge(this.parser.match("`"));
            if(result.shouldTerminate) {
                msg.push(this.parser.getMessage("Missing '`'."));
                return;
            }

            while(true) {
                if(this.parser.isEOF()) {
                    msg.push(this.parser.getMessage("Abruptly end."));
                    result.mergeState(ResultState.failing);
                    return;
                }
                else if((symRes = this.parser.match("\n")).matched) {
                    result.merge(symRes);
                    msg.push(this.parser.getMessage("Figure path should not have line break."));
                    return;
                }
                else if((symRes = this.parser.match("`")).matched) {
                    result.merge(symRes);
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
                // if (result.shouldTerminate) {
                //     msg.push(this.parser.getMessage("Missing '['."));
                //     return;
                // }

                let ndRes = new Result(new Node(this.figureCaptionType));
                this.parser.myTextLikeBlockHandler("figure", ndRes);
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    msg.push(this.parser.getMessage("Match caption failed."));
                    return;
                }
                itemNode.children.push(ndRes.content);
            }

            this.parser.skipBlank();
        }
    }
}
