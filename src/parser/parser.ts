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
import { HighlightType, Result, ResultState } from "../foundation/result";
import { off, send } from "process";
import { Message, MessageType } from "../foundation/message";
import { notebooks } from "vscode";
import { format } from "path";
import { Core } from "./core/core";
import { BlobOptions } from "buffer";

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
    referenceType: Type;
    settingType: Type;
    settingParameterType: Type;
    blockType: Type;
    errorType: Type;
    argumentsType: Type;
    argumentItemType: Type;

    // This table holds all the labels that lix contains with its handle function.
    blockHandlerTable: BlockHandlerTable;

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
    highlights: HighlightType[];

    // Successful
    success: boolean;
    state: ResultState;

    constructor(configs: Config) {

        this.configs = configs;

        this.typeTable = new TypeTable(this);
        this.documentType = this.typeTable.add("document")!;
        this.paragraphType = this.typeTable.add("paragraph")!;
        this.textType = this.typeTable.add("text")!;
        this.wordsType = this.typeTable.add("words")!;
        this.referenceType = this.typeTable.add("reference")!;
        this.settingType = this.typeTable.add("setting")!;
        this.settingParameterType = this.typeTable.add("setting-parameter")!;
        this.blockType = this.typeTable.add("label")!;
        this.errorType = this.typeTable.add("error")!;
        this.argumentsType = this.typeTable.add("arguments")!;
        this.argumentItemType = this.typeTable.add("argument-item")!;

        this.blockHandlerTable = new BlockHandlerTable(this);

        // other blocks
        this.blockHandlerTable.add("paragraph", this.paragraphBlockHandler, this);

        // basic blocks (formula is added in math module)
        this.blockHandlerTable.add("text", this.textBlockHandler, this);

        /*this.labelHandlerTable.add("title", this.defaultBlockHandler.bind(this, 1), this);
        this.labelHandlerTable.add("author", this.defaultBlockHandler.bind(this, 2), this);
        this.labelHandlerTable.add("section", this.defaultBlockHandler.bind(this, 3), this);
        this.labelHandlerTable.add("subsection", this.defaultBlockHandler.bind(this, 4), this);
        this.labelHandlerTable.add("_1", this.defaultBlockHandler.bind(this, 5), this);
        */

        this.modules = [];
        this.mathModule = new Math(this);
        this.coreModule = new Core(this);

        this.text = "";
        this.index = 0;
        this.lineRanges = [];
        this.process = [];

        this.syntaxTree = new Node(this.documentType);
        this.messageList = [];
        this.highlights = [];
        this.success = false;
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
        this.success = false;
        this.state = ResultState.failing;

        // 统一行尾
        this.text = this.text.replace(/\r\n/g, "\n");
        this.text = this.text.replace(/\r/g, "\n");

        this.generateLineRanges();
    }

    parse(text: string) {
        this.init(text);
        this.mathModule.init();
        this.coreModule.init();

        // parse
        let result = this.matchDocument();
        this.syntaxTree = result.content;
        this.messageList = result.messages;
        this.highlights = result.highlights;
        this.success = (result.state === ResultState.successful);
        this.state = result.state;
    }

    // ************ Core Grammers *************

    // MatchDocument

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

    // MatchSetting

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

        result.merge(this.skipBlank());

        let nameRes = this.matchName();
        result.merge(nameRes);
        if (result.shouldTerminate) {
            msg.push(this.getMessage("Missing name."));
            result.mergeState(ResultState.skippable);
        }
        else {
            node.content = nameRes.content;
        }

        result.merge(this.skipBlank());

        result.merge(this.match(":"));
        if (result.shouldTerminate) {
            msg.push(this.getMessage("Missing ':'."));
            result.mergeState(ResultState.skippable);
        }

        let command = "";
        while (true) {
            if (this.isEOF()) {
                break;
            }
            else if (this.is(Parser.newline)) {
                break;
            }
            else {
                command += this.curChar();
                this.move();
            }

        }
        node.children.push(new Node(this.settingParameterType, command));
    }

    // MatchParagraph

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

        while (true) {
            if (this.isEOF()) {
                break;
            }
            else if (this.isMultilineBlankGeThanOne()) {
                result.merge(this.matchMultilineBlank());
                break;
            }
            else if (this.isBlock(Parser.otherBlocks)) {
                break;
            }
            else if (this.is("#")) {
                break;
            }

            else if ((ndRes = this.matchFreeText()).matched) {
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if (this.isBlock(Parser.basicBlocks)) { // match par free text 中检测过
                ndRes = this.matchBlock();
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }
            else {
                msg.push(this.getMessage("[logic error].Unintended branch. Free paragraph match failed."));
                result.mergeState(ResultState.matched);
                break;
            }
        }
    }

    paragraphBlockHandler(args: Node = new Node(this.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.paragraphType));
        let preIndex = this.index;
        this.begin("paragraph-handler");
        this.myParagraphBlockHandler(result, args);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myParagraphBlockHandler(result: Result<Node>, args: Node) {
        let node = result.content;
        let msg = result.messages;

        let ndRes: Result<Node>;

        node.children.push(args);

        while (true) {
            if (this.isEOF()) {
                //msg.push(this.getMessage("Unexpected end.", MessageType.warning));
                //result.mergeState(ResultState.skippable);
                break;
            }

            else if (this.is("]")) {
                this.move();
                result.mergeState(ResultState.successful);
                break;
            }

            else if ((ndRes = this.matchParFreeText()).matched) {
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if (this.isBlock(Parser.basicBlocks)) { // match par free text 中检测过
                ndRes = this.matchBlock();
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }
            
            else {
                msg.push(this.getMessage("[logic error].Unintended branch. Free paragraph match failed."));
                result.mergeState(ResultState.matched);
                break;
            }
        }
    }

    static basicBlocks = new Set(["text", "formula", "figure", "list", "table", "code"]);

    static formatBlocks = new Set(["emph", "bold", "italic"]);

    static otherBlocks = new Set(["paragraph"]);

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
                result.merge(symRes);
                break;
            }

            else if ((curIndex = this.index, this.isBlock(Parser.basicBlocks))) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                break;
            }

            else if ((curIndex = this.index, this.isBlock(Parser.otherBlocks))) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
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
                if(text === "") {
                    preIndex = curIndex;
                }
                result.merge(blnRes);
                text += " ";
            }

            else if ((curIndex = this.index, symRes = this.match("\\")).matched) {
                if(text === "") {
                    preIndex = curIndex;
                }
                result.merge(symRes);
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

            else if ((curIndex = this.index, ndRes = this.mathModule.matchEmbededFormula()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
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

            else if ((curIndex = this.index, ndRes = this.matchBlock()).matched) {
                // 只能是 format block | error block 前边判断过
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
                if(text === "") {
                    preIndex = this.index;
                }
                result.mergeState(ResultState.successful);
                text += this.curChar();
                this.move();
            }
        }
    }

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

                msg.push(this.getMessage("In paragraph text ends abruptly.", MessageType.warning));
                result.mergeState(ResultState.skippable);

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
                break;
            }

            else if ((curIndex = this.index, this.isBlock(Parser.basicBlocks))) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                break;
            }

            else if ((curIndex = this.index, blnRes = this.matchMultilineBlank()).matched) { // 结束条件判断过大于一行的空行, 这里只能是一行以内的
                if(text === "") {
                    preIndex = curIndex;
                }
                result.merge(blnRes);
                text += " ";
                if (blnRes.content > 1) {
                    msg.push(this.getMessage("Inpar paragraph text cannot contain linebreak."));
                    result.mergeState(ResultState.skippable);
                }
            }

            

            else if ((curIndex = this.index, symRes = this.match("\\")).matched) {
                if(text === "") {
                    preIndex = curIndex;
                }
                result.merge(symRes);
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
                    msg.push(this.getMessage("In paragraph text ends abruptly.", MessageType.warning));
                    result.mergeState(ResultState.skippable);
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

            else if ((curIndex = this.index, ndRes = this.mathModule.matchEmbededFormula()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
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

            else if (this.isBlock(Parser.otherBlocks)) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                    text = "";
                }

                msg.push(this.getMessage("Inpar text should not have other block."));
                result.mergeState(ResultState.skippable);
                this.skipByBrackets();
                
            }

            else if ((curIndex = this.index, ndRes = this.matchBlock()).matched) {
                // 只能是 format block | error block 前边判断过
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
                if(text === "") {
                    preIndex = this.index;
                }
                result.mergeState(ResultState.successful);
                text += this.curChar();
                this.move();
            }
        }
    }

    textBlockHandler(args: Node = new Node(this.argumentsType)): Result<Node> {
        let result = new Result<Node>(new Node(this.textType));
        let preIndex = this.index;
        this.begin("text-handler");
        this.myTextBlockHandler(result, args);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
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
                result.mergeState(ResultState.skippable);

                break;
            }

            else if (this.is("]")) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                    text = "";
                }
                result.mergeState(ResultState.successful);
                this.move();
                return;
            }

            else if ((blnRes = this.matchMultilineBlank()).matched) { // 结束条件判断过大于一行的空行, 这里只能是一行以内的
                if(text === "") {
                    preIndex = this.index;
                }
                result.merge(blnRes);
                text += " ";
                if (blnRes.content > 1) {
                    msg.push(this.getMessage("Inner text should not have multiline breaks."));
                    result.mergeState(ResultState.skippable);
                }
            }

            else if ((curIndex = this.index, symRes = this.match("\\\\")).matched) {
                if(text === "") {
                    preIndex = curIndex;
                }
                msg.push(this.getMessage("Inner text should not have \\\\."));
                text += "\\\\";
                result.mergeState(ResultState.skippable);
            }

            else if ((curIndex = this.index, symRes = this.match("\\")).matched) {
                if(text === "") {
                    preIndex = curIndex;
                }
                result.merge(symRes);
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
                    msg.push(this.getMessage("Inner text ends abruptly.", MessageType.warning));
                    result.mergeState(ResultState.skippable);
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

            else if ((curIndex = this.index, ndRes = this.mathModule.matchEmbededFormula()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
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

            else if (this.isBlock(Parser.basicBlocks)) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                    text = "";
                }

                msg.push(this.getMessage("Inner text should not have basic block."));
                result.mergeState(ResultState.skippable);
                this.skipByBrackets();
                
            }

            else if (this.isBlock(Parser.otherBlocks)) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, this.index));
                    text = "";
                }
                msg.push(this.getMessage("Inner text should not have other block."));
                result.mergeState(ResultState.skippable);
                this.skipByBrackets();
            }

            else if ((curIndex = this.index, ndRes = this.matchBlock()).matched) {
                // 只能是 format block | error block 前边判断过
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
                if(text === "") {
                    preIndex = this.index;
                }
                result.mergeState(ResultState.successful);
                text += this.curChar();
                this.move();
            }
        }
    }

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

            else if ((ndRes = this.mathModule.matchEmbededFormula()).matched) {
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
            */
            else {
                result.mergeState(ResultState.successful);
                text += this.curChar();
                this.move();
            }
        }
    }

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

        result.merge(this.skipBlank());

        let name = this.matchName();
        result.merge(name);
        if (result.shouldTerminate) {
            msg.push(this.getMessage("Missing name."));
            return;
        }

        node.content = name.content;

        result.merge(this.skipBlank());
    }

    // MatchBlock

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

        result.merge(this.skipBlank());

        let name = this.matchName();
        result.merge(name);
        let handle: HandlerFunction | undefined;

        if (result.shouldTerminate) {
            msg.push(this.getMessage("Missing name."));
            result.mergeState(ResultState.skippable);
        }
        else {
            node.content = name.content;
            handle = this.blockHandlerTable.getHandler(name.content);
            if (handle === undefined) {
                msg.push(this.getMessage(`Block name '${name.content}' not found.`));
                //result.success = false;
                result.mergeState(ResultState.skippable);
            }

        }

        result.merge(this.skipBlank());

        let argRes = this.matchArguments();
        result.merge(argRes);

        if (result.state === ResultState.skippable) {
            this.skipByBrackets(1);
            return;
        }

        //console.log(args);

        let nResult = handle!(argRes.content);
        result.merge(nResult);
        if (result.shouldTerminate) {
            //msg.push(this.getMessage(`'${name.content}' label failed.`));
            //result.success = false;
            return;
        }

        result.content = nResult.content;
    }

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
        //msg.push(this.getMessage("Abruptly ended."));
    }

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

        if (this.is("(")) {
            result.mergeState(ResultState.successful);
            this.move();

            result.merge(this.skipBlank());

            let nmRes: Result<string>;
            let preIndex: number;

            if(this.isEOF()) {
                msg.push(this.getMessage(`Argument ended unexpectedly.`));
                result.mergeState(ResultState.skippable);
            }
            else if (this.is(")")) {
                this.move();
                result.mergeState(ResultState.successful);
            }
            else if((preIndex = this.index, nmRes = this.matchName()).matched) {
                node.children.push(new Node(this.argumentItemType, nmRes.content, [], preIndex, this.index));

                while (true) {
                    if (this.isEOF()) {
                        msg.push(this.getMessage(`Argument ended unexpectedly.`));
                        result.mergeState(ResultState.skippable);
                        break;
                    }
                    if (this.is(")")) {
                        this.move();
                        result.mergeState(ResultState.successful);
                        break;
                    }
                    
                    result.merge(this.match(","));
                    if (result.shouldTerminate) {
                        msg.push(this.getMessage(`Missing ','.`));
                        result.mergeState(ResultState.matched);
                        break;
                    }
                    

                    result.merge(this.skipBlank());

                    preIndex = this.index
                    nmRes = this.matchName();
                    result.merge(nmRes);
                    if (result.shouldTerminate) {
                        msg.push(this.getMessage(`Matching argument name failed.`));
                        //result.mergeState(ResultState.skippable);
                        break;
                    }

                    node.children.push(new Node(this.argumentItemType, nmRes.content, [], preIndex, this.index));

                    result.merge(this.skipBlank());

                }
            }
            else {
                msg.push(this.getMessage(`Unrecognized argument.`));
                result.mergeState(ResultState.matched);
            }
        }
        else if (this.is(":")) {
            this.move();
            result.mergeState(ResultState.successful);
        }
        else {
            result.mergeState(ResultState.successful);
        }
    }

    private matchBlockName(): Result<string> {
        let result = new Result<string>("");
        let preIndex = this.index;
        this.begin("block-name");
        this.myMatchBlockName(result);
        this.end();
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchBlockName(result: Result<string>) {
        result.merge(this.match("["));
        if (result.shouldTerminate) {
            //result.success = false;
            return;
        }

        result.merge(this.skipBlank());

        let name = this.matchName();
        result.merge(name);
        if (result.shouldTerminate) {
            result.messages.push(this.getMessage("Missing name."));
            //result.success = false;
            //result.state = ResultState.matched;
            return;
        }

        result.content = name.content;
    }

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


    // **************** Foundation ****************

    // MatchName

    matchName(): Result<string> {
        let result = new Result<string>("");
        this.begin("name");
        this.myMatchName(result);
        this.end();
        return result;
    }

    myMatchName(result: Result<string>) {
        let name = "";
        while (true) {
            if (this.isEOF()) {
                break;
            }
            else if (this.is(Parser.nameChar)) {
                name += this.curChar();
                this.move();
                result.mergeState(ResultState.successful);
            }
            else {
                result.content = name;
                break;
            }
        }
    }

    // Match

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

    myMatch(text: string, result: Result<null>) {
        let length = text.length;
        if (!this.notEnd(length - 1)) {
            return;
        }
        result.state = ResultState.successful;
        for (let i = 0; i < length; i++, this.move()) {
            if (this.curChar() != text[i]) {
                result.state = ResultState.failing;
                break;
            }
        }
    }

    // MatchBlank

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

    myMatchSinglelineBlank(result: Result<null>) {
        let comRes: Result<null>;

        while (true) {
            if (this.isEOF()) {
                break;
            }
            else if ((comRes = this.matchSinglelineComment()).matched) {
                result.merge(comRes);
                break;
            }

            else if (this.is(Parser.blank)) {
                result.mergeState(ResultState.successful);
                this.move();
            }
            else if ((comRes = this.matchMultilineComment()).matched) {
                result.merge(comRes);
            }
            else {
                break;
            }
        }
    }

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

    myMatchMultilineBlank(result: Result<number>) {
        let comRes: Result<null>;
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
            else if ((comRes = this.matchSinglelineComment()).matched) {
                result.merge(comRes);
            }
            else if ((comRes = this.matchMultilineComment()).matched) {
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

    // MatchComment

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

    matchMultilineComment(): Result<null> {
        let result = new Result<null>(null);
        this.begin("multiline-comment");
        this.myMatchMultilineComment(result);
        this.end();
        return result;
    }

    myMatchMultilineComment(result: Result<null>) {
        result.merge(this.match("/*"));
        if (result.shouldTerminate) {
            return;
        }
        let tmpRes: Result<null>;
        //console.log(this.index);
        while (true) {
            if (this.isEOF()) {
                result.mergeState(ResultState.skippable);
                break;
            }
            else if ((tmpRes = this.match("*/")).matched) {
                result.merge(tmpRes);
                break;
            }
            else if ((tmpRes = this.matchMultilineComment()).matched) {
                //console.log(this.index);
                result.merge(tmpRes);
            }
            else {
                result.mergeState(ResultState.successful);
                this.move();
            }
        }
    }

    // SkipBlank

    skipBlank(): Result<null> {
        let result = new Result<null>(null);
        this.begin("skip-blank");
        //console.log(this.index);
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

    // not-used
    // discard<T>(result: Result<T>) {
    //     this.index = preIndex;
    // }

    // **************** line number & message generate ****************

    // Line and position

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

    getLineAndPosition(index: number = this.index): { line: number, position: number } | undefined {
        for (let i = 0; i <= this.lineRanges.length; i++) {
            if (this.lineRanges[i][0] <= index && index < this.lineRanges[i][1]) {
                return { line: i, position: index - this.lineRanges[i][0] };
            }
        }
        return undefined;
    }

    getIndex(line: number, position: number): number | undefined {
        if (0 <= line && line < this.lineRanges.length) {
            if (position >= 0 && position + this.lineRanges[line][0] < this.lineRanges[line][1]) {
                return position + this.lineRanges[line][0];
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
        let lp = this.getLineAndPosition() ?? { line: -1, position: -1 };
        let pro = this.process.slice();
        return new Message(message, type, code, lp.line, lp.position, pro);
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
        if(this.isEOF()) {
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
        if(code >= 0xd800 && code <= 0xdbff && this.notEnd(1)) {
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
        if(code >= 0xd800 && code <= 0xdbff && this.notEnd(1)) {
            return char + this.text[this.index + 1];
        }
        else {
            return char;
        }
    }
}