import { Node } from "../../sytnax-tree/node";
import { Type } from "../../sytnax-tree/type";
import { Module } from "../module";
import { Parser } from "../parser";
import { NodeResult, ResultState } from "../result";
import { MessageType } from "../../foundation/message";
import { BlockOption, ArgumentType } from "../block-table";

export class Article extends Module {

    // types of syntax tree node

    titleType: Type;
    authorType: Type;
    dateType: Type;
    sectionType: Type;
    subsectionType: Type;
    subsubsectionType: Type;
    tableofcontentsType: Type;
    newpageType: Type;

    bibliographyType: Type;
    bibItemType: Type;

    definitionType: Type;
    lemmaType: Type;
    propositionType: Type;
    theoremType: Type;
    proofType: Type;
    corollaryType: Type;


    constructor(parser: Parser) {
        super(parser);

        // Init label handle function

        // other blocks
        this.parser.otherBlocks.add("section");
        this.parser.otherBlocks.add("subsection");
        this.parser.otherBlocks.add("subsubsection");
        this.parser.otherBlocks.add("tableofcontents");
        this.parser.otherBlocks.add("newpage");
        this.parser.otherBlocks.add("title");
        this.parser.otherBlocks.add("author");
        this.parser.otherBlocks.add("date");

        const sectionSpec: BlockOption = {
            argumentOptions: new Map([
                ["style", { type: ArgumentType.enumeration, options: ["numbered", "unnumbered"], default: "numbered" }],
            ]),
            allowReference: true
        };
        this.parser.blockTable.add("section", this.sectionBlockHandler, this, sectionSpec);
        this.parser.blockTable.add("subsection", this.subsectionBlockHandler, this, sectionSpec);
        this.parser.blockTable.add("subsubsection", this.subsubsectionBlockHandler, this, sectionSpec);
        this.parser.blockTable.add("tableofcontents", this.tableofcontentsBlockHandler, this);
        this.parser.blockTable.add("newpage", this.newpageBlockHandler, this);
        this.parser.blockTable.add("title", this.titleBlockHandler, this);
        this.parser.blockTable.add("author", this.authorBlockHandler, this);
        this.parser.blockTable.add("date", this.dateBlockHandler, this);

        // Init syntax tree node type
        this.titleType = this.parser.typeTable.add("title");
        this.authorType = this.parser.typeTable.add("author");
        this.dateType = this.parser.typeTable.add("date");
        this.sectionType = this.parser.typeTable.add("section");
        this.subsectionType = this.parser.typeTable.add("subsection");
        this.subsubsectionType = this.parser.typeTable.add("subsubsection");
        this.tableofcontentsType = this.parser.typeTable.add("tableofcontents");
        this.newpageType = this.parser.typeTable.add("newpage");


        // Bibliography
        this.parser.otherBlocks.add("bibliography");
        this.parser.blockTable.add("bibliography", this.bibliographyBlockHandler, this);

        // BibItem
        this.parser.basicBlocks.add("bib-item");
        const itemSpec: BlockOption = {
            argumentOptions: new Map(),
            allowReference: true
        };
        this.parser.blockTable.add("bib-item", this.bibItemBlockHandler, this, itemSpec);

        this.bibliographyType = this.parser.typeTable.add("bibliography");
        this.bibItemType = this.parser.typeTable.add("bib-item");

        // 此 definition 与 math 冲突了
        this.parser.otherBlocks.add("definition");
        this.parser.otherBlocks.add("lemma");
        this.parser.otherBlocks.add("proposition");
        this.parser.otherBlocks.add("theorem");
        this.parser.otherBlocks.add("corollary");
        this.parser.otherBlocks.add("proof");

        const mathEnvSpec: BlockOption = {
            argumentOptions: new Map(),
            allowReference: true
        };
        this.parser.blockTable.add("definition", this.definitionBlockHandler, this, mathEnvSpec);
        this.parser.blockTable.add("lemma", this.lemmaBlockHandler, this, mathEnvSpec);
        this.parser.blockTable.add("proposition", this.propositionBlockHandler, this, mathEnvSpec);
        this.parser.blockTable.add("theorem", this.theoremBlockHandler, this, mathEnvSpec);
        this.parser.blockTable.add("corollary", this.corollaryBlockHandler, this, mathEnvSpec);
        this.parser.blockTable.add("proof", this.proofBlockHandler, this, mathEnvSpec);
        
        // 此 definition 与 math 冲突了
        this.definitionType = this.parser.typeTable.add("definition'");
        this.lemmaType = this.parser.typeTable.add("lemma");
        this.propositionType = this.parser.typeTable.add("proposition");
        this.theoremType = this.parser.typeTable.add("theorem");
        this.corollaryType = this.parser.typeTable.add("corollary");
        this.proofType = this.parser.typeTable.add("proof");
    }

    init() {
        
    }

    sectionBlockHandler(args: Node): NodeResult {
        return this.parser.formatLikeBlockHandler("section", this.sectionType, args);

        // let result = new Result<Node>(new Node(this.sectionType));
        // let preIndex = this.parser.index;
        // this.parser.begin("section-block-handler");
        // for(let arg of args.children) {
        //     if(arg.content === "unnumbered") {
        //         result.content.content = "unnumbered";
        //     }
        // }
        // this.parser.myTextLikeBlockHandler("section", result, args);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // result.content.type = this.sectionType;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    subsectionBlockHandler(args: Node): NodeResult {
        return this.parser.formatLikeBlockHandler("subsection", this.subsectionType, args);

        // let result = new Result<Node>(new Node(this.subsectionType));
        // let preIndex = this.parser.index;
        // this.parser.begin("subsection-block-handler");
        // for(let arg of args.children) {
        //     if(arg.content === "unnumbered") {
        //         result.content.content = "unnumbered";
        //     }
        // }
        // this.parser.myTextLikeBlockHandler("subsection", result, args);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // result.content.type = this.subsectionType;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    subsubsectionBlockHandler(args: Node): NodeResult {
        return this.parser.formatLikeBlockHandler("subsubsection", this.subsubsectionType, args);

        // let result = new Result<Node>(new Node(this.subsubsectionType));
        // let preIndex = this.parser.index;
        // this.parser.begin("subsubsection-block-handler");
        // for(let arg of args.children) {
        //     if(arg.content === "unnumbered") {
        //         result.content.content = "unnumbered";
        //     }
        // }
        // this.parser.myTextLikeBlockHandler("subsubsection", result, args);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // result.content.type = this.subsubsectionType;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    tableofcontentsBlockHandler(args: Node): NodeResult {
        let result = this.parser.formatLikeBlockHandler("tableofcontents", this.tableofcontentsType, args);
        result.discarded = false;
        return result;
    }

    newpageBlockHandler(args: Node): NodeResult {
        let result = this.parser.formatLikeBlockHandler("newpage", this.newpageType, args);
        result.discarded = false;
        return result;
    }

    titleBlockHandler(args: Node = new Node(this.parser.argumentsType)): NodeResult {
        return this.parser.formatLikeBlockHandler("title", this.titleType, args);

        // let result = new Result<Node>(new Node(this.titleType));
        // let preIndex = this.parser.index;
        // this.parser.begin("title-block-handler");
        // this.parser.myTextLikeBlockHandler("title", result, args);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // result.content.type = this.titleType;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    authorBlockHandler(args: Node = new Node(this.parser.argumentsType)): NodeResult {
        return this.parser.formatLikeBlockHandler("author", this.authorType, args);

        // let result = new Result<Node>(new Node(this.authorType));
        // let preIndex = this.parser.index;
        // this.parser.begin("author-block-handler");
        // this.parser.myTextLikeBlockHandler("author", result, args);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // result.content.type = this.authorType;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    dateBlockHandler(args: Node = new Node(this.parser.argumentsType)): NodeResult {
        return this.parser.formatLikeBlockHandler("date", this.dateType, args);

        // let result = new Result<Node>(new Node(this.sectionType));
        // let preIndex = this.parser.index;
        // this.parser.begin("date-block-handler");
        // this.parser.myTextLikeBlockHandler("date", result, args);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // result.content.type = this.dateType;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }


    bibliographyBlockHandler(args: Node): NodeResult {
        return this.parser.paragraphLikeBlockHandler("bibliography", this.bibliographyType, args);
    }

    bibItemBlockHandler(args: Node): NodeResult {
        let result = this.parser.formatLikeBlockHandler("bib-item", this.bibItemType, args);
        result.discarded = false;
        return result;
    }

    /*
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
                result.addMessage("Format text ends abruptly.", MessageType.warning), MessageType.error, this.parser.index);
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
                    result.addMessage("Format text should not have multiline breaks."), MessageType.error, this.parser.index);
                    result.mergeState(ResultState.skippable);
                }
            }

            else if ((curIndex = this.parser.index, symRes = this.parser.match("\\\\")).matched) {
                if(text === "") {
                    preIndex = curIndex;
                }
                result.addMessage("Format text should not have \\\\."), MessageType.error, this.parser.index);
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
                            result.addMessage(`\\${this.parser.curChar()} do not represent any char.`, MessageType.warning), MessageType.error, this.parser.index);
                    }
                    this.parser.move();
                }
                else {
                    text += "\\";
                    result.addMessage("Format text ends abruptly.", MessageType.warning), MessageType.error, this.parser.index);
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
                    //result.addMessage("Match reference failed."), MessageType.error, this.parser.index);
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if ((curIndex = this.parser.index, ndRes = this.parser.mathModule.formulaInsertionHandler()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(ndRes);
                this.parser.move();

                if (result.shouldTerminate) {
                    //result.addMessage("Match embeded formula failed."), MessageType.error, this.parser.index);
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if (this.parser.isBlock()) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, this.parser.index));
                    text = "";
                }
                result.addMessage("Format text should not have block."), MessageType.error, this.parser.index);
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
     */

    definitionBlockHandler(args: Node): NodeResult {
        return this.parser.paragraphLikeBlockHandler("definition", this.definitionType, args);
    }

    lemmaBlockHandler(args: Node): NodeResult {
        return this.parser.paragraphLikeBlockHandler("lemma", this.lemmaType, args);
    }

    propositionBlockHandler(args: Node): NodeResult {
        return this.parser.paragraphLikeBlockHandler("proposition", this.propositionType, args);
    }

    theoremBlockHandler(args: Node): NodeResult {
        return this.parser.paragraphLikeBlockHandler("theorem", this.theoremType, args);
    }

    corollaryBlockHandler(args: Node): NodeResult {
        return this.parser.paragraphLikeBlockHandler("corollary", this.corollaryType, args);
    }

    proofBlockHandler(args: Node): NodeResult {
        return this.parser.paragraphLikeBlockHandler("proof", this.proofType, args);
    }
}
