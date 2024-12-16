import { Node } from "../../sytnax-tree/node";
import { Type } from "../../sytnax-tree/type";
import { Module } from "../module";
import { Parser } from "../parser";
import { Result, ResultState } from "../../foundation/result";
import { MessageType } from "../../foundation/message";

export class Article extends Module {

    // types of syntax tree node

    titleType: Type;
    authorType: Type;
    dateType: Type;
    sectionType: Type;
    subsectionType: Type;
    subsubsectionType: Type;

    constructor(parser: Parser) {
        super(parser);

        // Init label handle function

        // other blocks
        this.parser.otherBlocks.add("section");
        this.parser.otherBlocks.add("subsection");
        this.parser.otherBlocks.add("subsubsection");
        this.parser.otherBlocks.add("title");
        this.parser.otherBlocks.add("author");
        this.parser.otherBlocks.add("date");
        this.parser.blockHandlerTable.add("section", this.sectionBlockHandler, this);
        this.parser.blockHandlerTable.add("subsection", this.subsectionBlockHandler, this);
        this.parser.blockHandlerTable.add("subsubsection", this.subsubsectionBlockHandler, this);
        this.parser.blockHandlerTable.add("title", this.titleBlockHandler, this);
        this.parser.blockHandlerTable.add("author", this.authorBlockHandler, this);
        this.parser.blockHandlerTable.add("date", this.dateBlockHandler, this);

        // Init syntax tree node type
        this.titleType = this.parser.typeTable.add("title")!;
        this.authorType = this.parser.typeTable.add("author")!;
        this.dateType = this.parser.typeTable.add("date")!;
        this.sectionType = this.parser.typeTable.add("section")!;
        this.subsectionType = this.parser.typeTable.add("subsection")!;
        this.subsubsectionType = this.parser.typeTable.add("subsubsection")!;

    }

    init() {
        
    }

    sectionBlockHandler(args: Node = new Node(this.parser.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.sectionType));
        let preIndex = this.parser.index;
        this.parser.begin("section-block-handler");
        this.parser.myTextLikeBlockHandler("section", result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.sectionType;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    subsectionBlockHandler(args: Node = new Node(this.parser.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.subsectionType));
        let preIndex = this.parser.index;
        this.parser.begin("subsection-block-handler");
        this.parser.myTextLikeBlockHandler("subsection", result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.subsectionType;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    subsubsectionBlockHandler(args: Node = new Node(this.parser.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.subsubsectionType));
        let preIndex = this.parser.index;
        this.parser.begin("subsubsection-block-handler");
        this.parser.myTextLikeBlockHandler("subsubsection", result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.subsubsectionType;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    titleBlockHandler(args: Node = new Node(this.parser.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.titleType));
        let preIndex = this.parser.index;
        this.parser.begin("title-block-handler");
        this.parser.myTextLikeBlockHandler("title", result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.titleType;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    authorBlockHandler(args: Node = new Node(this.parser.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.authorType));
        let preIndex = this.parser.index;
        this.parser.begin("author-block-handler");
        this.parser.myTextLikeBlockHandler("author", result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.authorType;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    dateBlockHandler(args: Node = new Node(this.parser.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.sectionType));
        let preIndex = this.parser.index;
        this.parser.begin("date-block-handler");
        this.parser.myTextLikeBlockHandler("date", result, args);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        result.content.type = this.dateType;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    private myTitleAuthorDateBlockHandler(result: Result<Node>, args: Node) {
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


}
