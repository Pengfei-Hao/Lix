/**
* Parser: analyise the document, generate the sytnax tree
*/

import { Type } from "../sytnax-tree/type";
import { Node } from "../sytnax-tree/node";
import { TypeTable } from "../sytnax-tree/type-table";
import { BlockHandlerTable, HandlerFunction } from "./block-handler-table";
import { Math } from "./math/math";
import { Module } from "./module";
import { Config } from "../foundation/config";
import { Highlight, HighlightType, Result, ResultState } from "../foundation/result";
import { off, send } from "process";
import { Message, MessageType } from "../foundation/message";
import { notebooks } from "vscode";
import { format } from "path";
import { Core } from "./core/core";
import { Article } from "./article/article";


export type MatchResult = Result<Node>;

export class Parser {

    // Text and index of the source text.
    private text: string;
    index: number;

    // Generated syntax tree will be storaged here, type table holds all the type of node.
    syntaxTree: Node;

    // Types in type table
    typeTable: TypeTable;

    documentType: Type;
    paragraphType: Type;
    textType: Type;
    wordsType: Type;
    nameType: Type;
    referenceType: Type;
    settingType: Type;
    settingParameterType: Type;
    blockType: Type;
    errorType: Type;
    argumentsType: Type;
    argumentItemType: Type;

    // This table holds all the labels that lix contains with its handle function.
    blockHandlerTable: BlockHandlerTable;
    basicBlocks: Set<string>;
    formatBlocks: Set<string>;
    otherBlocks: Set<string>;

    // Modules
    modules: Module[];
    mathModule: Math;
    coreModule: Core;

    // Configs
    configs: Config;

    // Message list
    messageList: Message[];
    lineRanges: [number, number][];
    process: string[];

    // Highlights
    highlights: Highlight[];

    // Successful
    state: ResultState;

    constructor(configs: Config) {

        this.configs = configs;

        this.typeTable = new TypeTable(this);
        this.documentType = this.typeTable.add("document")!;
        this.paragraphType = this.typeTable.add("paragraph")!;
        this.textType = this.typeTable.add("text")!;
        this.wordsType = this.typeTable.add("words")!;
        this.nameType = this.typeTable.add("name")!;
        this.referenceType = this.typeTable.add("reference")!;
        this.settingType = this.typeTable.add("setting")!;
        this.settingParameterType = this.typeTable.add("setting-parameter")!;
        this.blockType = this.typeTable.add("block")!;
        this.errorType = this.typeTable.add("error")!;
        this.argumentsType = this.typeTable.add("arguments")!;
        this.argumentItemType = this.typeTable.add("argument-item")!;

        this.blockHandlerTable = new BlockHandlerTable(this);

        // other blocks
        this.otherBlocks = new Set(["paragraph"]);
        this.blockHandlerTable.add("paragraph", this.paragraphBlockHandler, this);

        // basic blocks (formula is added in math module)
        this.basicBlocks = new Set(["text"]);
        this.blockHandlerTable.add("text", this.textBlockHandler, this);

        this.formatBlocks = new Set();

        this.mathModule = new Math(this);
        this.coreModule = new Core(this);
        this.modules = [this.mathModule, this.coreModule, new Article(this)];

        this.text = "";
        this.index = 0;
        this.lineRanges = [];
        this.process = [];

        this.syntaxTree = new Node(this.documentType);
        this.messageList = [];
        this.highlights = [];
        this.state = ResultState.failing;
    }

    // *********** Init and Parse ***************

    private init(text: string) {
        this.text = text;
        this.index = 0;
        this.lineRanges = [];
        this.process = [];

        this.syntaxTree = new Node(this.documentType);
        this.messageList = [];
        this.highlights = [];
        this.state = ResultState.failing;

        // 统一行尾
        this.text = this.text.replace(/\r\n/g, "\n");
        this.text = this.text.replace(/\r/g, "\n");

        this.generateLineRanges();
    }

    parse(text: string) {
        this.init(text);
        for (let module of this.modules) {
            module.init();
        }

        // parse
        let result = this.matchDocument();
        this.syntaxTree = result.content;
        this.messageList = result.messages;
        this.highlights = result.highlights;
        this.state = result.state;
    }

    // ************ Core Grammers *************

    // MatchDocument: failing | skippable | successful

    matchDocument(): Result<Node> {
        let result = new Result<Node>(new Node(this.documentType));
        let preIndex = this.index;
        this.begin("document");
        this.myMatchDocument(result);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchDocument(result: Result<Node>) {
        let tmpRes: Result<Node>;

        while (true) {
            if (this.isEOF()) {
                break;
            }

            else if ((tmpRes = this.matchSetting()).matched) {
                result.merge(tmpRes);
                if (result.shouldTerminate) {
                    return;
                }
                result.content.children.push(tmpRes.content);
            }

            else if ((tmpRes = this.matchFreeParagraph()).matched) {
                result.merge(tmpRes);
                if (result.shouldTerminate) {
                    return;
                }
                result.content.children.push(tmpRes.content);
            }

            else if ((tmpRes = this.matchBlock()).matched) {
                result.merge(tmpRes);
                if (result.shouldTerminate) {
                    return;
                }
                result.content.children.push(tmpRes.content);
            }

            else {
                // failed
                result.mergeState(ResultState.failing);
                result.messages.push(this.getMessage("Match paragraph, setting and Block failed."));
                return;
            }
        }
    }

    // MatchSetting: failing | skippable | successful

    matchSetting(): Result<Node> {
        let result = new Result<Node>(new Node(this.settingType));
        let preIndex = this.index;
        this.begin("setting");
        this.myMatchSetting(result);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchSetting(result: Result<Node>) {
        let node = result.content;
        let msg = result.messages;

        result.merge(this.match("#"));
        if (result.shouldTerminate) {
            msg.push(this.getMessage("Missing '#'."));
            return;
        }
        result.highlights.push(this.getHighlight(HighlightType.operator, -1, 0));
        result.GuaranteeMatched();

        result.merge(this.skipBlank());

        let nameRes = this.matchName();
        result.merge(nameRes);
        if (result.shouldTerminate) {
            msg.push(this.getMessage("Missing name."));

            result.promoteToSkippable();
            this.skipToEndOfLine();
            return;
        }
        result.highlights.push(this.getHighlight(HighlightType.keyword, nameRes.content));
        node.content = nameRes.content.content;

        result.merge(this.skipBlank());

        result.merge(this.match(":"));
        if (result.shouldTerminate) {
            msg.push(this.getMessage("Missing ':'."));

            result.promoteToSkippable();
            this.skipToEndOfLine();
            return;
        }
        result.highlights.push(this.getHighlight(HighlightType.operator, -1, 0));

        let command = "";
        while (true) {
            if (this.isEOF()) {
                break;
            }
            else if (this.is(Parser.newline)) {
                break;
            }

            else {
                result.mergeState(ResultState.successful);
                command += this.curChar();
                this.move();
            }

        }
        node.children.push(new Node(this.settingParameterType, command));
    }

    // **************** Text & Paragraph ****************

    // MatchFreeParagraph: failing | matched | skippable | successful

    private matchFreeParagraph(): Result<Node> {
        let result = new Result<Node>(new Node(this.paragraphType));
        let preIndex = this.index;
        this.begin("free-paragraph");
        this.myMatchFreeParagraph(result);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchFreeParagraph(result: Result<Node>) {
        let node = result.content;
        let msg = result.messages;

        let ndRes: Result<Node>;
        let nullRes: Result<null>;

        while (true) {
            if (this.isEOF()) {
                break;
            }
            else if ((nullRes = this.matchMultilineBlankGeThanOne()).matched) {
                result.merge(nullRes);
                break;
            }
            else if (this.isOtherBlock()) {
                break;
            }
            else if (this.is("#")) {
                break;
            }

            else if ((ndRes = this.matchFreeText()).matched) {
                result.GuaranteeMatched();
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if (this.isBasicBlock()) { // match par free text 中检测过
                result.GuaranteeMatched();
                ndRes = this.matchBlock();
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }
            else {
                msg.push(this.getMessage("[logic error].Unintended branch. Free paragraph match failed."));
                result.mergeState(ResultState.failing);
                return;
            }
        }
    }

    // ParagraphBlockHandler: failing | skippable | successful

    paragraphBlockHandler(args: Node = new Node(this.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.paragraphType));
        let preIndex = this.index;
        this.begin("paragraph-block-handler");
        this.myParagraphBlockHandler(result, args);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }


    paragraphLikeBlockHandler(blockName: string, args: Node = new Node(this.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.paragraphType));
        let preIndex = this.index;
        this.begin(`${blockName}-block-handler`);
        this.myParagraphBlockHandler(result, args);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myParagraphBlockHandler(result: Result<Node>, args: Node, blockName: string = "paragraph") {
        let node = result.content;
        let msg = result.messages;

        let ndRes: Result<Node>;
        let nullRes: Result<null>;

        node.children.push(args);

        while (true) {
            if (this.isEOF()) {
                msg.push(this.getMessage("In paragraph text ends abruptly.", MessageType.warning));
                result.mergeState(ResultState.failing);
                result.promoteToSkippable();
                return;
            }
            else if ((nullRes = this.match("]")).matched) {
                result.merge(nullRes);
                result.highlights.push(this.getHighlight(HighlightType.operator, -1, 0));
                break;
            }
            else if (this.isOtherBlock()) {
                msg.push(this.getMessage("Paragraph block should not have other block."));
                result.mergeState(ResultState.failing);
                result.promoteToSkippable();
                this.skipByBrackets();
                return;
            }

            else if ((ndRes = this.matchParFreeText()).matched) {
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if (this.isBasicBlock()) { // match par free text 中检测过
                ndRes = this.matchBlock();
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }

                node.children.push(ndRes.content);
            }

            else {
                msg.push(this.getMessage("[logic error].Unintended branch. Free paragraph match failed."));
                result.mergeState(ResultState.failing);
                return;
            }
        }
    }

    /*
        private myMatchParagraph(result: Result<Node>, inner: boolean = false) {
            let node = result.content;
            let msg = result.messages;
    
            let free = !inner;
    
            let ndRes: Result<Node>;
    
            while (true) {
                if (this.isEOF()) {
                    if (inner) {
                        msg.push(this.getMessage("Unexpected end.", MessageType.warning));
                        result.mergeState(ResultState.skippable);
                    }
                    break;
                }
                else if (free && this.isMultilineBlankGeThanOne()) {
                    result.merge(this.matchMultilineBlank());
                    // if (inner) {
                    //     msg.push(this.getMessage("Inner paragraph should not have more than one line breaks."));
                    //     result.mergeState(ResultState.skippable);
                    // }
                    break;
                }
                else if (free && this.isBlock(Parser.otherBlocks)) {
                    // if (inner) {
                    //     msg.push(this.getMessage("Inner paragraph should not have other blocks."));
                    //     result.mergeState(ResultState.matched);
                    // }
                    break;
                }
                else if (free && this.is("#")) {
                    break;
                }
                else if (inner && this.is("]")) {
                    this.move();
                    result.mergeState(ResultState.successful);
                    break;
                }
    
                else if (free && (ndRes = this.matchFreeText()).matched) {
                    result.merge(ndRes);
                    if (result.shouldTerminate) {
                        return;
                    }
                    node.children.push(ndRes.content);
                }
                else if (inner && (ndRes = this.matchParFreeText()).matched) {
                    result.merge(ndRes);
                    if (result.shouldTerminate) {
                        return;
                    }
                    node.children.push(ndRes.content);
                }
                // if (ndRes.state !== ResultState.failing) {
                //     //result.success = true;
                //     succ = true;
                //     result.merge(ndRes);
                //     if(result.state === ResultState.matched) {
                //         return;
                //     }
                //     node.children.push(ndRes.content);
                //     continue;
                // }
                //this.discard(ndRes);
    
                else if (this.isBlock(Parser.basicBlocks)) { // match par free text 中检测过
                    ndRes = this.matchBlock();
                    result.merge(ndRes);
                    if (result.shouldTerminate) {
                        return;
                    }
                    node.children.push(ndRes.content);
                }
                // if (this.is("[")) {
                //     let nResult = this.matchBlockName();
                //     this.discard(nResult);
                //     if (nResult.state === ResultState.successful) {
                //         if (Parser.basicBlocks.has(nResult.content)) {
                //             //result.success = true;
                //             succ = true;
                //             let mResult = this.matchBlock();
                //             result.merge(mResult);
                //             node.children.push(mResult.content);
                //             if (result.state === ResultState.matched) {
                //                 //msg.push(this.getMessage("Match block failed."));
                //                 return;
                //             }
                //         }
                //         else {
                //             if (inner) {
                //                 //result.success = false;
                //                 msg.push(this.getMessage("Inner paragraph should not have other block."));
                //                 result.state = ResultState.matched;
                //             }
                //             if(!succ) {
                //                 result.state = ResultState.failing;
                //             }
                //             return;
                //         }
                //     }
                //     else {
                //         //result.success = false;
                //         if(inner) {
                //             msg.push(this.getMessage("Inner paragraph should not have other block."));
                //             result.state = ResultState.matched;
                //         }
                //         //msg.push(this.getMessage("Match block name failed."));
                //         if(!succ) {
                //             result.state = ResultState.failing;
                //         }
                //         return;
                //     }
                // }
    
                else {
                    //result.success = false;
                    // if(!succ) {
                    //     result.state = ResultState.failing;
                    // }
                    msg.push(this.getMessage("Free paragraph match failed."));
                    result.mergeState(ResultState.matched);
                    break;
                }
            }
        }
            */

    // MatchFreeText: failing | matched | skippable | successful

    matchFreeText(): Result<Node> {
        let result = new Result<Node>(new Node(this.textType));
        let preIndex = this.index;
        this.begin("free-text");
        this.myMatchFreeText(result);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchFreeText(result: Result<Node>) {
        let node = result.content;
        let msg = result.messages;

        let text = "";
        let symRes: Result<null>;
        let blnRes: Result<number>;
        let ndRes: Result<Node>;

        let preIndex = 0, curIndex;

        while (true) {
            if (this.isEOF()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                }
                break;
            }

            else if (this.isMultilineBlankGeThanOne()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                    text = "";
                }
                break;
            }
            else if ((curIndex = this.index, symRes = this.match("\\\\")).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.GuaranteeMatched();
                result.highlights.push(this.getHighlight(HighlightType.operator, -2, 0));
                result.merge(symRes);
                break;
            }
            else if (this.isBasicBlock()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                    text = "";
                }
                break;
            }
            else if (this.isOtherBlock()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                    text = "";
                }
                break;
            }
            else if (this.is("#")) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                    text = "";
                }
                return;
            }


            else if ((curIndex = this.index, blnRes = this.matchMultilineBlank()).matched) { // 结束条件判断过大于一行的空行, 这里只能是一行以内的
                if (text === "") {
                    preIndex = curIndex;
                }
                result.GuaranteeMatched();
                result.merge(blnRes);
                text += " ";
            }

            else if ((curIndex = this.index, symRes = this.match("\\")).matched) {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.GuaranteeMatched();
                result.merge(symRes);
                if (this.notEnd()) {
                    switch (this.curChar()) {
                        case "(": case ")":
                        case "[": case "]": case "/": case "#": case "@":
                            text += this.curChar();
                            result.highlights.push(this.getHighlight(HighlightType.operator, -1, 1));
                            break;
                        // 这里不需要判断 \\ 因为结束条件判断过
                        default:
                            text += "\\";
                            text += this.curChar();
                            msg.push(this.getMessage(`\\${this.curChar()} do not represent any char.`, MessageType.warning));
                    }
                    this.move();
                }
                else {
                    text += "\\";
                }
            }

            else if ((curIndex = this.index, ndRes = this.matchReference()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.GuaranteeMatched();
                result.merge(ndRes);

                if (result.shouldTerminate) {
                    //msg.push(this.getMessage("Match reference failed."));
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if ((curIndex = this.index, ndRes = this.mathModule.matchInlineFormula()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.GuaranteeMatched();
                result.merge(ndRes);
                //this.move();

                if (result.shouldTerminate) {
                    //msg.push(this.getMessage("Match embeded formula failed."));
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if ((curIndex = this.index, ndRes = this.matchBlock()).matched) {
                // 只能是 format block  前边判断过
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.GuaranteeMatched();
                result.merge(ndRes);

                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }

            else {
                if (text === "") {
                    preIndex = this.index;
                }
                result.GuaranteeMatched();
                result.mergeState(ResultState.successful);
                text += this.curChar();
                this.move();
            }
        }
    }

    // MatchParFreeText: failing | matched | skippable | successful

    matchParFreeText(): Result<Node> {
        let result = new Result<Node>(new Node(this.textType));
        let preIndex = this.index;
        this.begin("par-free-text");
        this.myMatchParFreeText(result);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchParFreeText(result: Result<Node>) {
        let node = result.content;
        let msg = result.messages;

        let text = "";
        let symRes: Result<null>;
        let blnRes: Result<number>;
        let ndRes: Result<Node>;

        let preIndex = 0, curIndex;

        while (true) {
            if (this.isEOF()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                }
                break;
            }

            else if (this.is("]")) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                    text = "";
                }
                break;
            }
            else if ((curIndex = this.index, symRes = this.match("\\\\")).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(symRes);
                result.GuaranteeMatched();
                result.highlights.push(this.getHighlight(HighlightType.operator, -2, 0));
                break;
            }
            else if (this.isBasicBlock()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                    text = "";
                }
                break;
            }
            else if (this.isOtherBlock()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                    text = "";
                }
                break;
            }

            else if ((curIndex = this.index, blnRes = this.matchMultilineBlank()).matched) {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.GuaranteeMatched();
                result.merge(blnRes);
                text += " ";
                if (blnRes.content > 1) {
                    msg.push(this.getMessage("Inpar paragraph text cannot contain linebreak."));
                    result.mergeState(ResultState.failing);
                    result.promoteToSkippable();
                }
            }

            else if ((curIndex = this.index, symRes = this.match("\\")).matched) {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.GuaranteeMatched();
                result.merge(symRes);
                if (this.notEnd()) {
                    switch (this.curChar()) {
                        case "(": case ")":
                        case "[": case "]": case "/": case "#": case "@":
                            text += this.curChar();
                            result.highlights.push(this.getHighlight(HighlightType.operator, -1, 1));
                            break;
                        // 这里不需要判断 \\ 因为结束条件判断过
                        default:
                            text += "\\";
                            text += this.curChar();
                            msg.push(this.getMessage(`\\${this.curChar()} do not represent any char.`, MessageType.warning));
                    }
                    this.move();
                }
                else {
                    text += "\\";
                    continue; // 借用isEOF
                }
            }

            else if ((curIndex = this.index, ndRes = this.matchReference()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.GuaranteeMatched();
                result.merge(ndRes);

                if (result.shouldTerminate) {
                    //msg.push(this.getMessage("Match reference failed."));
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if ((curIndex = this.index, ndRes = this.mathModule.matchInlineFormula()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.GuaranteeMatched();
                result.merge(ndRes);
                //this.move();

                if (result.shouldTerminate) {
                    //msg.push(this.getMessage("Match embeded formula failed."));
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if ((curIndex = this.index, ndRes = this.matchBlock()).matched) {
                // 只能是 format block 前边判断过
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.GuaranteeMatched();
                result.merge(ndRes);

                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }

            else {
                if (text === "") {
                    preIndex = this.index;
                }
                result.GuaranteeMatched();
                result.mergeState(ResultState.successful);
                text += this.curChar();
                this.move();
            }
        }
    }

    // TextBlockHandler: failing | skippable | successful

    textBlockHandler(args: Node = new Node(this.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.textType));
        let preIndex = this.index;
        this.begin("text-block-handler");
        this.myTextBlockHandler(result, args);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    myTextLikeBlockHandler(blockName: string, result: Result<Node>, args: Node = new Node(this.argumentsType)) {
        this.myTextBlockHandler(result, args);
    }

    private myTextBlockHandler(result: Result<Node>, args: Node) {
        let node = result.content;
        let msg = result.messages;

        let text = "";
        let symRes: Result<null>;
        let blnRes: Result<number>;
        let ndRes: Result<Node>;

        let preIndex = 0, curIndex;

        node.children.push(args);

        while (true) {
            if (this.isEOF()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                }
                msg.push(this.getMessage("Inner text ends abruptly.", MessageType.warning));
                result.mergeState(ResultState.failing);
                result.promoteToSkippable();

                break;
            }

            else if ((symRes = this.match("]")).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                    text = "";
                }
                result.highlights.push(this.getHighlight(HighlightType.operator, -1, 0));
                result.merge(symRes);
                return;
            }

            else if ((blnRes = this.matchMultilineBlank()).matched) { // 结束条件判断过大于一行的空行, 这里只能是一行以内的
                if (text === "") {
                    preIndex = this.index;
                }
                result.merge(blnRes);
                text += " ";
                if (blnRes.content > 1) {
                    msg.push(this.getMessage("Inner text should not have multiline breaks."));
                    result.mergeState(ResultState.failing);
                    result.promoteToSkippable();
                }
            }

            else if ((curIndex = this.index, symRes = this.match("\\\\")).matched) {
                if (text === "") {
                    preIndex = curIndex;
                }
                msg.push(this.getMessage("Inner text should not have \\\\."));
                text += "\\\\";
                result.mergeState(ResultState.failing);
                result.promoteToSkippable();
            }

            else if ((curIndex = this.index, symRes = this.match("\\")).matched) {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.merge(symRes);
                if (this.notEnd()) {
                    switch (this.curChar()) {
                        case "(": case ")":
                        case "[": case "]": case "/": case "#": case "@":
                            text += this.curChar();
                            result.highlights.push(this.getHighlight(HighlightType.operator, -1, 1));
                            break;
                        // 这里不需要判断 \\ 因为结束条件判断过
                        default:
                            text += "\\";
                            text += this.curChar();
                            msg.push(this.getMessage(`\\${this.curChar()} do not represent any char.`, MessageType.warning));
                    }
                    this.move();
                }
                else {
                    text += "\\";
                    continue; // 借用isEOF
                }
            }

            else if ((curIndex = this.index, ndRes = this.matchReference()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(ndRes);

                if (result.shouldTerminate) {
                    //msg.push(this.getMessage("Match reference failed."));
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if ((curIndex = this.index, ndRes = this.mathModule.matchInlineFormula()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(ndRes);
                //this.move();

                if (result.shouldTerminate) {
                    //msg.push(this.getMessage("Match embeded formula failed."));
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if (this.isBasicBlock()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                    text = "";
                }

                msg.push(this.getMessage("Inner text should not have basic block."));
                result.mergeState(ResultState.failing);
                result.promoteToSkippable();
                this.skipByBrackets();

            }

            else if (this.isOtherBlock()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                    text = "";
                }
                msg.push(this.getMessage("Inner text should not have other block."));
                result.mergeState(ResultState.failing);
                result.promoteToSkippable();
                this.skipByBrackets();
            }

            else if ((curIndex = this.index, ndRes = this.matchBlock()).matched) {
                // 只能是 format block 前边判断过
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(ndRes);

                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }

            else {
                if (text === "") {
                    preIndex = this.index;
                }
                result.mergeState(ResultState.successful);
                text += this.curChar();
                this.move();
            }
        }
    }

    /*
    private myMatchText(result: Result<Node>, inner: boolean = false, inpar = false) {
        let node = result.content;
        let msg = result.messages;

        let free = !inner && !inpar;

        let text = "";
        let symRes: Result<null>;
        let blnRes: Result<number>;
        let ndRes: Result<Node>;

        while (true) {
            if (this.isEOF()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text));
                }
                if (inner) {
                    msg.push(this.getMessage("Inner text ends abruptly.", MessageType.warning));
                    result.mergeState(ResultState.skippable);
                }
                if (inpar) {
                    msg.push(this.getMessage("In paragraph text ends abruptly.", MessageType.warning));
                    result.mergeState(ResultState.skippable);
                }
                break;
            }

            else if (inner && this.is("]")) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text));
                    text = "";
                }
                this.move();
                return;
            }

            else if (inpar && this.is("]")) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text));
                    text = "";
                }
                // if(!succ) {
                //     result.state = ResultState.failing;
                // }
                return;
            }

            else if (this.isMultilineBlankGeThanOne()) {
                if (free) {
                    if (text !== "") {
                        node.children.push(new Node(this.wordsType, text));
                        text = "";
                    }
                    break;
                }
                result.merge(this.skipMutilineBlank());
                if (inner) {
                    msg.push(this.getMessage("Inner text should ended with ]."));
                }
                if (inpar) {
                    msg.push(this.getMessage("Inpar paragraph text cannot contain linebreak."));
                }
                text += " ";
                result.mergeState(ResultState.skippable);
            }

            else if ((symRes = this.match("\\\\")).matched) {
                if (free || inpar) {
                    if (text !== "") {
                        node.children.push(new Node(this.wordsType, text));
                        text = "";
                    }
                    result.merge(symRes);
                    break;
                }
                if (inner) {
                    msg.push(this.getMessage("Inner text should not have \\\\."));
                    //result.success = false;
                    text += "\\\\";
                    result.mergeState(ResultState.successful);
                }

            }
            else if (this.isBlock(Parser.basicBlocks)) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text));
                    text = "";
                }
                if (inner) {
                    msg.push(this.getMessage("Inner text should not have basic block."));
                    result.mergeState(ResultState.matched);
                }
                break;
            }

            else if (this.isBlock(Parser.otherBlocks)) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text));
                    text = "";
                }
                if (inner) {
                    msg.push(this.getMessage("Inner text should not have other block."));
                    result.mergeState(ResultState.matched);
                }
                if (inpar) {
                    msg.push(this.getMessage("Inpar text should not have other block."));
                    result.mergeState(ResultState.matched);
                }
                break;
            }

            else if (free && this.is("#")) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text));
                    text = "";
                }
                // if(!succ) {
                //     result.state = ResultState.failing;
                // }
                return;

            }


            else if ((blnRes = this.matchMultilineBlank()).matched) { // 结束条件判断过大于一行的空行, 这里只能是一行以内的
                result.merge(blnRes);
                text += " ";
            }

            else if ((symRes = this.match("\\")).matched) {
                result.merge(symRes);
                this.move();
                if (this.notEnd()) {
                    switch (this.curChar()) {
                        case "(": case ")":
                        case "[": case "]": case "/": case "#": case "@":
                            text += this.curChar();
                            break;
                        // 这里不需要判断 \\ 因为结束条件判断过
                        default:
                            text += "\\";
                            text += this.curChar();
                            msg.push(this.getMessage(`\\${this.curChar()} do not represent any char.`, MessageType.warning));
                    }
                    this.move();
                }
                else {
                    text += "\\";
                    if (inner) {
                        msg.push(this.getMessage("Inner text ends abruptly.", MessageType.warning));
                        result.mergeState(ResultState.skippable);
                    }
                    if (inpar) {
                        msg.push(this.getMessage("In paragraph text ends abruptly.", MessageType.warning));
                        result.mergeState(ResultState.skippable);
                    }
                }
            }

            else if ((ndRes = this.matchReference()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text));
                    text = "";
                }
                result.merge(ndRes);

                if (result.shouldTerminate) {
                    //msg.push(this.getMessage("Match reference failed."));
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if ((ndRes = this.mathModule.matchInlineFormula()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text));
                    text = "";
                }
                result.merge(ndRes);
                this.move();

                if (result.shouldTerminate) {
                    //msg.push(this.getMessage("Match embeded formula failed."));
                    return;
                }
                node.children.push(ndRes.content);
            }

            //else if(this.isBlock(Parser.formatBlocks)) {
            //}

            else if ((ndRes = this.matchBlock()).matched) {
                // 只能是 format block 前边判断过
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text));
                    text = "";
                }
                result.merge(ndRes);
                this.move();

                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }



            /*
            else if (this.is("[")) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text));
                    text = "";
                }
                let nResult = this.matchBlockName();
                this.discard(nResult);

                if (nResult.state === ResultState.successful) {
                    if (Parser.formatBlocks.has(nResult.content)) {
                        //result.success = true;
                        succ = true;

                        let tResult = this.matchBlock();
                        result.merge(tResult);
                        if (result.state === ResultState.matched) {
                            msg.push(this.getMessage("Match format block failed."));
                            return;
                        }
                        node.children.push(tResult.content);
                    }
                    else {
                        if (inner) {
                            //result.success = false;
                            msg.push(this.getMessage("Inner text should not have other block."));
                            result.state = ResultState.matched;
                        }
                        if(!succ) {
                            result.state = ResultState.failing;
                        }
                        return;
                    }
                }

                else {
                    if(inner) {
                        msg.push(this.getMessage("Inner text should not have other block."));
                        result.state = ResultState.matched;
                    }
                    //msg.push(this.getMessage("Name of block not found."));
                    //result.success = false;
                    if(!succ) {
                        result.state = ResultState.failing;
                    }
                    return;
                }
                
            }
            
            else {
                result.mergeState(ResultState.successful);
                text += this.curChar();
                this.move();
            }
        }
    }
    */

    // MatchReference: failing | matched | skippable | successful

    matchReference(): Result<Node> {
        let result = new Result<Node>(new Node(this.referenceType));
        let preIndex = this.index;
        this.begin("reference");
        this.myMatchReference(result);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchReference(result: Result<Node>) {
        let node = result.content;
        let msg = result.messages;

        result.merge(this.match("@"));
        if (result.shouldTerminate) {
            msg.push(this.getMessage("Missing '@'."));
            return;
        }
        result.highlights.push(this.getHighlight(HighlightType.operator, -1, 0));
        result.GuaranteeMatched();

        result.merge(this.skipBlank());

        let name = this.matchName();
        result.merge(name);
        if (result.shouldTerminate) {
            msg.push(this.getMessage("Missing name."));
            return;
        }
        node.content = name.content.content;
        result.highlights.push(this.getHighlight(HighlightType.keyword, name.content));


        result.merge(this.skipBlank());
    }

    // **************** Block ****************


    // MatchBlock: failing | (matched) | skippable | successful

    matchBlock(): Result<Node> {
        let result = new Result<Node>(new Node(this.blockType));
        let preIndex = this.index;
        this.begin("block");
        this.myMatchBlock(result);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchBlock(result: Result<Node>) {
        let node = result.content;
        let msg = result.messages;

        result.merge(this.match("["));
        if (result.shouldTerminate) {
            msg.push(this.getMessage("Missing '['."));
            return;
        }
        result.highlights.push(this.getHighlight(HighlightType.operator, -1, 0));

        result.merge(this.skipBlank());

        let handle: HandlerFunction | undefined;

        let nameRes = this.matchName();
        result.merge(nameRes);
        if (result.shouldTerminate) {
            msg.push(this.getMessage("Missing name."));

            result.promoteToSkippable();
            this.skipByBrackets(1);
            return;
        }
        node.content = nameRes.content.content;

        handle = this.blockHandlerTable.getHandler(nameRes.content.content);
        if (handle === undefined) {
            msg.push(this.getMessage(`Block name '${nameRes.content}' not found.`));
            result.mergeState(ResultState.failing);
            return;
        }
        result.GuaranteeMatched();
        result.highlights.push(this.getHighlight(HighlightType.keyword, nameRes.content));

        result.merge(this.skipBlank());

        let argRes = this.matchArguments();
        result.merge(argRes);
        if (result.shouldTerminate) {
            result.promoteToSkippable();
            this.skipByBrackets(1);
            return;
        }
        result.content.children.push(argRes.content);

        let nResult = handle!(argRes.content);
        result.merge(nResult);
        if (result.shouldTerminate) {
            result.promoteToSkippable();
            this.skipByBrackets(1);
            return;
        }
        result.content = nResult.content;
    }

    // MatchArguments: failing | skippable | successful

    matchArguments(): Result<Node> {
        let result = new Result<Node>(new Node(this.argumentsType));
        let preIndex = this.index;
        this.begin("argument");
        this.myMatchArgument(result);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchArgument(result: Result<Node>) {
        let node = result.content;
        let msg = result.messages;

        let nullRes: Result<null>;

        if ((nullRes = this.match("(")).matched) {
            result.merge(nullRes);
            result.highlights.push(this.getHighlight(HighlightType.operator, -1, 0));

            result.merge(this.skipBlank());

            let nmRes: Result<Node>;

            if (this.isEOF()) {
                msg.push(this.getMessage(`Argument ended unexpectedly.`));
                result.mergeState(ResultState.failing);
                return;
            }
            else if ((nullRes = this.match(")")).matched) {
                result.merge(nullRes);
                result.highlights.push(this.getHighlight(HighlightType.operator, -1, 0));
            }
            else if ((nmRes = this.matchName()).matched) {
                result.merge(nmRes);
                result.highlights.push(this.getHighlight(HighlightType.keyword, nmRes.content));
                nmRes.content.type = this.argumentItemType;
                node.children.push(nmRes.content);

                while (true) {
                    if (this.isEOF()) {
                        msg.push(this.getMessage(`Argument ended unexpectedly.`));
                        result.mergeState(ResultState.failing);
                        return;
                    }
                    else if ((nullRes = this.match(")")).matched) {
                        result.merge(nullRes);
                        result.highlights.push(this.getHighlight(HighlightType.operator, -1, 0));
                        break;
                    }

                    result.merge(this.match(","));
                    if (result.shouldTerminate) {
                        msg.push(this.getMessage(`Missing ','.`));
                        result.promoteToSkippable();
                        this.skipTo(")");
                        return;
                    }
                    result.highlights.push(this.getHighlight(HighlightType.operator, -1, 0));

                    result.merge(this.skipBlank());

                    nmRes = this.matchName();
                    result.merge(nmRes);
                    if (result.shouldTerminate) {
                        msg.push(this.getMessage(`Matching argument name failed.`));
                        result.promoteToSkippable();
                        this.skipTo(")");
                        return;
                    }
                    result.highlights.push(this.getHighlight(HighlightType.keyword, nmRes.content));
                    nmRes.content.type = this.argumentItemType;
                    node.children.push(nmRes.content);

                    result.merge(this.skipBlank());
                }
            }
            else {
                msg.push(this.getMessage(`Unrecognized argument.`));
                result.mergeState(ResultState.failing);
                return;
            }
        }
        else if ((nullRes = this.match(":")).matched) {
            result.merge(nullRes);
        }
        else {
            result.mergeState(ResultState.successful);
        }
    }

    // GetBlockName: failing | successful

    private getBlockName(): Result<string> {
        let result = new Result<string>("");
        result.merge(this.match("["));
        if (result.shouldTerminate) {
            return result;
        }

        result.merge(this.skipBlank());

        let nameRes = this.matchName();
        result.merge(nameRes);
        if (result.shouldTerminate) {
            return result;
        }
        result.content = nameRes.content.content;
        return result;
    }

    /*
    isBlock(type: Set<string> | null): boolean {
        if(type === null) {
            return this.is("[");
        }
        let preIndex = this.index;
        let blcRes = this.matchBlockName();
        this.index = preIndex;
        if (blcRes.matched && type.has(blcRes.content)) {
            return true;
        }
        return false;
    }
    */

    isBlock(): boolean {
        let preIndex = this.index;
        let blcRes = this.getBlockName();
        this.index = preIndex;
        if (blcRes.matched && (this.basicBlocks.has(blcRes.content) || this.formatBlocks.has(blcRes.content) || this.otherBlocks.has(blcRes.content))) {
            return true;
        }
        return false;
    }

    isBasicBlock(): boolean {
        let preIndex = this.index;
        let blcRes = this.getBlockName();
        this.index = preIndex;
        if (blcRes.matched && this.basicBlocks.has(blcRes.content)) {
            return true;
        }
        return false;
    }

    isFormatBlock(): boolean {
        let preIndex = this.index;
        let blcRes = this.getBlockName();
        this.index = preIndex;
        if (blcRes.matched && this.formatBlocks.has(blcRes.content)) {
            return true;
        }
        return false;
    }

    isOtherBlock(): boolean {
        let preIndex = this.index;
        let blcRes = this.getBlockName();
        this.index = preIndex;
        if (blcRes.matched && this.otherBlocks.has(blcRes.content)) {
            return true;
        }
        return false;
    }

    matchBasicBlock(): Result<Node> {
        let result = new Result<Node>(new Node(this.blockType));
        let preIndex = this.index;
        this.begin("basic-block");
        if (this.isBasicBlock()) {
            this.myMatchBlock(result);
        }
        else {
            result.messages.push(this.getMessage("Not basic block."));
        }
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    matchFormatBlock(): Result<Node> {
        let result = new Result<Node>(new Node(this.blockType));
        let preIndex = this.index;
        this.begin("format-block");
        if (this.isFormatBlock()) {
            this.myMatchBlock(result);
        }
        else {
            result.messages.push(this.getMessage("Not format block."));
        }
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    matchOtherBlock(): Result<Node> {
        let result = new Result<Node>(new Node(this.blockType));
        let preIndex = this.index;
        this.begin("other-block");
        if (this.isOtherBlock()) {
            this.myMatchBlock(result);
        }
        else {
            result.messages.push(this.getMessage("Not other block."));
        }
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    // **************** Skippable ****************

    skipByBrackets(count: number = 0): boolean {
        while (this.notEnd()) {
            if (this.is("[")) {
                count++;
            }
            else if (this.is("]")) {
                count--;
                if (count === 0) {
                    this.move();
                    return true;
                }
            }
            this.move();
        }
        return false;
    }

    skipToEndOfLine(): boolean {
        while (true) {
            if (this.isEOF()) {
                return true;
            }
            else if (this.is(Parser.newline)) {
                return true;
            }

            else {
                this.move();
            }

        }
    }

    skipTo(char: string): boolean {
        while (true) {
            if (this.isEOF()) {
                return true;
            }
            else if (this.is(char)) {
                return true;
            }

            else {
                this.move();
            }

        }
    }

    // **************** Foundation ****************

    // MatchName: failing | successful, non-msg

    matchName(): Result<Node> {
        let result = new Result<Node>(new Node(this.nameType));
        result.content.begin = this.index;
        this.begin("name");
        this.myMatchName(result);
        this.end();
        result.content.end = this.index;
        return result;
    }

    private myMatchName(result: Result<Node>) {
        while (true) {
            if (this.isEOF()) {
                break;
            }
            else if (this.is(Parser.nameChar)) {
                result.content.content += this.curChar();
                this.move();
                result.mergeState(ResultState.successful);

            }
            else {
                break;
            }
        }
    }

    // Match: failing | successful, non-msg

    match(text: string): Result<null> {
        let result = new Result<null>(null);
        let preIndex = this.index;
        this.begin(`match'${text}'`);
        this.myMatch(text, result);
        this.end();
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatch(text: string, result: Result<null>) {
        let length = text.length;
        if (!this.notEnd(length - 1)) {
            return;
        }
        result.mergeState(ResultState.successful);
        for (let i = 0; i < length; i++, this.move()) {
            if (this.curChar() != text[i]) {
                result.mergeState(ResultState.failing);
                break;
            }
        }
    }

    // MatchSinglelineBlank: failing | skippable | successful

    matchSinglelineBlank(): Result<null> {
        let result = new Result<null>(null);
        let preIndex = this.index;
        this.begin("singleline-blank");
        this.myMatchSinglelineBlank(result);
        this.end();
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchSinglelineBlank(result: Result<null>) {
        let comRes: Result<null>;
        let preIndex: number;
        while (true) {
            if (this.isEOF()) {
                break;
            }
            else if ((preIndex = this.index, comRes = this.matchSinglelineComment()).matched) {
                result.merge(comRes);
                break;
            }

            else if (this.is(Parser.blank)) {
                result.mergeState(ResultState.successful);
                this.move();
            }
            else if ((preIndex = this.index, comRes = this.matchMultilineComment()).matched) {
                result.merge(comRes);
            }
            else {
                break;
            }
        }
    }

    // MatchMultilineBlank: failing | skippable | successful

    matchMultilineBlank(): Result<number> {
        let result = new Result<number>(0);
        let preIndex = this.index;
        this.begin("multiline-blank");
        this.myMatchMultilineBlank(result);
        this.end();
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchMultilineBlank(result: Result<number>) {
        let comRes: Result<null>;
        let preIndex: number;
        while (true) {
            if (this.isEOF()) {
                break;
            }
            else if (this.is(Parser.blank)) {
                result.mergeState(ResultState.successful);
                this.move();
            }
            else if (this.is(Parser.newline)) {
                result.content++;
                result.mergeState(ResultState.successful);
                this.move();
            }
            else if ((preIndex = this.index, comRes = this.matchSinglelineComment()).matched) {
                result.merge(comRes);

            }
            else if ((preIndex = this.index, comRes = this.matchMultilineComment()).matched) {
                result.merge(comRes);
            }
            else {
                break;
            }
        }
    }

    isMultilineBlankGeThanOne(): boolean {
        let preIndex = this.index;
        let blnRes = this.matchMultilineBlank();
        this.index = preIndex;
        if (blnRes.matched && blnRes.content > 1) {
            return true;
        }
        return false;
    }

    isMultilineBlankLeThanOrEqOne(): boolean {
        let preIndex = this.index;
        let blnRes = this.matchMultilineBlank();
        this.index = preIndex;
        if (blnRes.matched && blnRes.content <= 1) {
            return true;
        }
        return false;
    }

    matchMultilineBlankGeThanOne(): Result<null> {
        let result = new Result<null>(null);
        let preIndex = this.index;
        this.begin("multiline-blank-ge-than-1");
        let blnRes = this.matchMultilineBlank();
        if (blnRes.matched && blnRes.content > 1) {
            result.merge(blnRes);
        }
        else {
            this.index = preIndex;
        }
        this.end();
        return result;
    }

    matchMultilineBlankLeThanOrEqOne(): Result<null> {
        let result = new Result<null>(null);
        let preIndex = this.index;
        this.begin("multiline-blank-le-than-or-eq-1");
        let blnRes = this.matchMultilineBlank();

        if (blnRes.matched && blnRes.content <= 1) {
            result.merge(blnRes);
        }
        else {
            this.index = preIndex;
        }
        this.end();
        return result;
    }

    // MatchSinglelineComment: failing | successful

    matchSinglelineComment(): Result<null> {
        let result = new Result<null>(null, []);
        let preIndex = this.index;
        this.begin("singleline-comment");
        this.myMatchSinglelineComment(result);
        this.end();
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    myMatchSinglelineComment(result: Result<null>) {
        result.merge(this.match("//"));
        if (result.shouldTerminate) {
            return;
        }

        while (true) {
            if (this.isEOF()) {
                break;
            }
            else if (this.is(Parser.newline)) {
                break;
            }
            else {
                result.mergeState(ResultState.successful);
                this.move();
            }
        }
    }

    // MatchMultilineComment: failing | skippable | successful

    matchMultilineComment(): Result<null> {
        let result = new Result<null>(null);
        let preIndex = this.index;
        this.begin("multiline-comment");
        this.myMatchMultilineComment(result);
        this.end();
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    myMatchMultilineComment(result: Result<null>) {
        result.merge(this.match("/*"));
        if (result.shouldTerminate) {
            return;
        }

        let tmpRes: Result<null>;
        while (true) {
            if (this.isEOF()) {
                result.mergeState(ResultState.failing);
                result.promoteToSkippable();
                result.messages.push(this.getMessage("Multiline comment ended abruptly.", MessageType.warning));
                return;
            }
            else if ((tmpRes = this.match("*/")).matched) {
                result.merge(tmpRes);
                break;
            }
            else if ((tmpRes = this.matchMultilineComment()).matched) {
                result.merge(tmpRes);
            }
            else {
                result.mergeState(ResultState.successful);
                this.move();
            }
        }
    }

    // SkipBlank: skippable | successful

    skipBlank(): Result<null> {
        let result = new Result<null>(null);
        this.begin("skip-blank");
        let tmpRes = this.matchSinglelineBlank();
        if (tmpRes.matched) {
            result.merge(tmpRes);
        }
        else {
            result.mergeState(ResultState.successful);
        }
        this.end();
        return result;
    }

    // SkipMutilineBlank: skippable | successful

    skipMutilineBlank(): Result<number> {
        let result = new Result<number>(0);
        this.begin("skip-multiline-blank");
        let tmpRes = this.matchMultilineBlank();
        if (tmpRes.matched) {
            result.merge(tmpRes);
        }
        else {
            result.mergeState(ResultState.successful);
        }
        this.end();
        return result;
    }

    // **************** line number & message generate ****************

    // Line and character

    generateLineRanges() {
        let range: [number, number] = [0, 0]; // [begin, end)
        for (let i = 0; i <= this.text.length; i++, this.move()) {
            if (this.isEOF() || this.is(Parser.newline)) {
                range[1] = i + 1;
                this.lineRanges.push(range);
                range = [0, 0];
                range[0] = i + 1;
            }
        }
        this.index = 0;
    }

    getLineAndCharacter(index: number = this.index): { line: number, character: number } | undefined {
        for (let i = 0; i <= this.lineRanges.length; i++) {
            if (this.lineRanges[i][0] <= index && index < this.lineRanges[i][1]) {
                return { line: i, character: index - this.lineRanges[i][0] };
            }
        }
        return undefined;
    }

    getIndex(line: number, character: number): number | undefined {
        if (0 <= line && line < this.lineRanges.length) {
            if (character >= 0 && character + this.lineRanges[line][0] < this.lineRanges[line][1]) {
                return character + this.lineRanges[line][0];
            }
        }
        return undefined;
    }

    // process

    begin(process: string) {
        this.process.push(process);
    }

    end() {
        this.process.pop();
    }

    // message

    getMessage(message: string, type: MessageType = MessageType.error, code: number = -1): Message {
        let lp = this.getLineAndCharacter() ?? { line: -1, character: -1 };
        let pro = this.process.slice();
        return new Message(message, type, code, lp.line, lp.character, pro);
    }

    // highlight

    getHighlight(type: HighlightType, node: Node): Highlight
    getHighlight(type: HighlightType, relativeBegin: number, relativeEnd: number): Highlight

    getHighlight(type: HighlightType, relativeBeginOrNode: number | Node, relativeEnd?: number): Highlight {
        if (typeof (relativeBeginOrNode) === "number") {
            return new Highlight(this.index + relativeBeginOrNode, this.index + relativeEnd!, type);
        }
        else {
            return new Highlight(relativeBeginOrNode.begin, relativeBeginOrNode.end, type);
        }
    }

    // **************** 'is' series functions ****************

    static nameChar = /[A-Za-z0-9-]/;
    static blank = /[\t \v\f]/;
    static newline = /[\r\n]/;
    static eof = 0;

    isEOF(): boolean {
        return !this.notEnd();
    }

    // must ensure not end.
    is(char: string): boolean;
    is(exp: RegExp): boolean;
    is(eof: number): boolean;
    is(condition: string | RegExp | number): boolean;
    is(condition: string | RegExp | number): boolean {
        if (this.isEOF()) {
            return false;
        }
        if (typeof (condition) === "string") {
            return this.curChar() === condition;
        }
        else if (typeof (condition) === "number") {
            return !this.notEnd();
        }
        else {
            return condition.exec(this.curChar()) !== null;
        }

    }

    isUnicode(char: string): boolean {
        return this.text.codePointAt(this.index) === char.codePointAt(0);
    }

    nextIs(char: string): boolean;
    nextIs(exp: RegExp): boolean;
    nextIs(condition: string | RegExp) {
        if (this.notEnd(1)) {
            this.move();
            var res = this.is(condition);
            this.move(-1);
            return res;
        }
        else {
            return false;
        }
    }

    // **************** index control ****************

    notEnd(offset: number = 0): boolean {
        return this.index + offset < this.text.length;
    }

    move(offset: number = 1) {
        this.index += offset;
    }

    moveUnicode() {
        let code = this.text.charCodeAt(this.index);
        let char = this.curChar();
        if (code >= 0xd800 && code <= 0xdbff && this.notEnd(1)) {
            this.move(2);
        }
        else {
            this.move();
        }
    }



    curChar(): string {
        return this.text[this.index];
    }

    curUnicodeChar(): string {
        let code = this.text.charCodeAt(this.index);
        let char = this.curChar();
        if (code >= 0xd800 && code <= 0xdbff && this.notEnd(1)) {
            return char + this.text[this.index + 1];
        }
        else {
            return char;
        }
    }
}