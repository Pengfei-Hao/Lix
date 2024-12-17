/**
* Parser: analyise the document, generate the sytnax tree
*/

import { Type } from "../sytnax-tree/type";
import { Node } from "../sytnax-tree/node";
import { TypeTable } from "../sytnax-tree/type-table";
import { BlockHandlerTable, BlockHandler } from "./block-handler-table";
import { Math } from "./math/math";
import { Module } from "./module";
import { Highlight, HighlightType, Result, ResultState } from "../foundation/result";
import { Message, MessageType } from "../foundation/message";
import { Core } from "./core/core";
import { Article } from "./article/article";
import { Config } from "../compiler/config";
import { InsertionHandlerTable } from "./insertion-handler-table";

export type MatchResult = Result<Node>;

export class Parser {

    // **************** Environment ****************

    // Configs
    configs: Config;

    // Types in type table
    typeTable: TypeTable;

    documentType: Type;
    paragraphType: Type;
    textType: Type;
    insertionType: Type;
    wordsType: Type;
    nameType: Type;
    escapeCharType: Type;
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

    // insertion table
    insertionHandlerTable: InsertionHandlerTable;

    // Modules
    modules: Module[];
    mathModule: Math;
    coreModule: Core;

    // **************** Parsing ****************

    // Text and index of the source text.
    private text: string;
    index: number;

    // Ranges of every line
    lineRanges: number[];

    // Stack of 'match' function
    process: string[];

    // Generated syntax tree will be storaged here, type table holds all the type of node.
    syntaxTree: Node;

    // Message list
    messageList: Message[];

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
        this.insertionType = this.typeTable.add("insertion")!;
        this.wordsType = this.typeTable.add("words")!;
        this.nameType = this.typeTable.add("name")!;
        this.escapeCharType = this.typeTable.add("escape-char")!;
        this.referenceType = this.typeTable.add("reference")!;
        this.settingType = this.typeTable.add("setting")!;
        this.settingParameterType = this.typeTable.add("setting-parameter")!;
        this.blockType = this.typeTable.add("block")!;
        this.errorType = this.typeTable.add("error")!;
        this.argumentsType = this.typeTable.add("arguments")!;
        this.argumentItemType = this.typeTable.add("argument-item")!;

        this.blockHandlerTable = new BlockHandlerTable();

        // other blocks
        this.otherBlocks = new Set(["paragraph"]);
        this.blockHandlerTable.add("paragraph", this.paragraphBlockHandler, this);

        // basic blocks (formula is added in math module)
        this.basicBlocks = new Set(["text"]);
        this.blockHandlerTable.add("text", this.textBlockHandler, this);

        this.formatBlocks = new Set();

        this.insertionHandlerTable = new InsertionHandlerTable();
        this.insertionHandlerTable.add("@", this.matchReference, this);
        //this.insertionHandlerTable.add("&", () => {let r = new Result<Node>(new Node(this.referenceType)); r.state = ResultState.matched ; r.highlights.push(this.getHighlight(HighlightType.operator, 0, 1)); return r });
        // inline formula is added in math moudle

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
        // if(this.isEOF()) {
        //     result.mergeState(ResultState.successful);
        //     return;
        // }
        result.mergeState(ResultState.successful);
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
                result.messages.push(this.getMessage("[[Logical Error]] Matching paragraph, setting and block failed."));
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

    isSetting(): boolean {
        return this.is("#");
    }

    // **************** Text & Paragraph ****************

    // MatchFreeParagraph: failing | skippable | successful

    matchFreeParagraph(): Result<Node> {
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
                result.GuaranteeMatched();
                break;
            }
            else if (this.isOtherBlock()) {
                break;
            }
            else if (this.isSetting()) {
                break;
            }

            else if ((ndRes = this.matchFreeText()).matched) {
                result.merge(ndRes);
                result.GuaranteeMatched();
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
                
            }

            else if ((ndRes = this.matchBasicBlock()).matched) {
                result.merge(ndRes);
                result.GuaranteeMatched();
                // match block 不会失败
                node.children.push(ndRes.content);
                
            }
            else {
                msg.push(this.getMessage("[[Logical Error]]Unintended 'else'. Free paragraph match failed."));
                result.mergeState(ResultState.failing);
                return;
            }
        }
    }

    cleanupText(node: Node) {
        
        // word node 的begin end 没改
        if(node.children.length === 0) {
            return;
        }

        // 将 word 连起来
        let preIsWord = false;
        for(let i = 0; i < node.children.length; i++) {
            let ch = node.children[i];
            if(preIsWord && ch.type === this.wordsType) {
                let pre = node.children[i-1];
                if(pre.content.endsWith(" ") && ch.content.startsWith(" ")) {
                    ch.content = ch.content.slice(1);
                }
                pre.content = pre.content.concat(ch.content);
                pre.end = ch.end;
                node.children.splice(i, 1);
                i--;
                continue;
            }

            if(ch.type === this.wordsType) {
                preIsWord = true;
            }
            else {
                preIsWord = false;
            }
        }

        // 去除首尾空格
        let i = 0;
        let ch = node.children[0];
        if(ch.type === this.argumentsType) {
            if(node.children.length <= 1) {
                return;
            }
            i = 1;
            ch = node.children[1];
        }
        if(ch.type === this.wordsType && ch.content.startsWith(" ")) {
            ch.content = ch.content.slice(1);
            if(ch.content.length === 0) {
                node.children.splice(i, 1);
            }
        }
        if(node.children.length === 0) {
            return;
        }
        ch = node.children.at(-1)!;
        if(ch.type === this.wordsType && ch.content.endsWith(" ")) {
            ch.content = ch.content.slice(0, -1);
            if(ch.content.length === 0) {
                node.children.splice(-1, 1);
            }
        }
    }

    // MatchFreeText: failing | skippable | successful

    matchFreeText(): Result<Node> {
        let result = new Result<Node>(new Node(this.textType));
        let preIndex = this.index;
        this.begin("free-text");
        this.myMatchFreeText(result);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        this.cleanupText(result.content);
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
        //let blnRes: Result<number>;
        let ndRes: Result<Node>;

        let preIndex = 0, curIndex;

        while (true) {
            curIndex = this.index;

            if (this.isEOF()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                }
                break;
            }

            else if (this.isMultilineBlankGeThanOne()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                break;
            }
            else if ((symRes = this.match("\\\\")).matched) {
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
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                break;
            }
            else if (this.isOtherBlock()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                break;
            }
            else if (this.isSetting()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                break;
            }


            else if ((symRes = this.matchMultilineBlankLeThanOrEqOne()).matched) { // 结束条件判断过大于一行的空行, 这里只能是一行以内的
                if (text === "") {
                    preIndex = curIndex;
                }
                result.merge(symRes);
                result.GuaranteeMatched();
                text += " ";
            }

            else if((ndRes = this.matchEscapeChar()).matched) {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.merge(ndRes);
                result.GuaranteeMatched();
                text += ndRes.content.content;
            }

            else if ((ndRes = this.matchInsertion()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(ndRes);
                result.GuaranteeMatched();
                // 不会失败
                node.children.push(ndRes.content);
            }

            else if ((ndRes = this.matchFormatBlock()).matched) {
                // 只能是 format block  前边判断过
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(ndRes);
                result.GuaranteeMatched();
                // match block 不会失败
                node.children.push(ndRes.content);
            }

            else {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.mergeState(ResultState.successful);
                result.GuaranteeMatched();
                text += this.curChar();
                this.move();
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

        result.mergeState(ResultState.successful);

        while (true) {
            if (this.isEOF()) {
                msg.push(this.getMessage("Paragraph block ended abruptly."));
                result.mergeState(ResultState.skippable);
                return;
            }
            if (this.isMultilineBlankGeThanOne()) {
                msg.push(this.getMessage("Paragraph block ended abruptly."));
                result.mergeState(ResultState.skippable);
                return;
            }
            else if (this.is("]")) {
                break;
            }
            // else if ((nullRes = this.match("]")).matched) {
            //     result.merge(nullRes);
            //     result.highlights.push(this.getHighlight(HighlightType.operator, -1, 0));
            //     break;
            // }
            else if (this.isOtherBlock()) {
                msg.push(this.getMessage("Paragraph block should not have other block."));
                result.mergeState(ResultState.skippable);
                this.skipByBrackets();
                continue;
            }

            else if ((ndRes = this.matchParFreeText()).matched) {
                result.merge(ndRes);
                // match par free text 不会失败
                node.children.push(ndRes.content);
            }

            else if ((ndRes = this.matchBasicBlock()).matched) { // par free text 中检测过 format block
                result.merge(ndRes);
                // match block 不会失败
                node.children.push(ndRes.content);
            }
            else {
                msg.push(this.getMessage("[[Logical Error]]Unintended 'else'. Matching paragraph block failed."));
                result.mergeState(ResultState.failing);
                return;
            }
        }
    }

    // MatchParFreeText: failing | skippable | successful

    matchParFreeText(): Result<Node> {
        let result = new Result<Node>(new Node(this.textType));
        let preIndex = this.index;
        this.begin("par-free-text");
        this.myMatchParFreeText(result);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        this.cleanupText(result.content);
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
            curIndex = this.index;

            if (this.isEOF()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                }
                break;
            }

            else if(this.isMultilineBlankGeThanOne()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                }
                break;
            }

            else if (this.is("]")) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                break;
            }
            else if ((symRes = this.match("\\\\")).matched) {
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
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                break;
            }
            else if (this.isOtherBlock()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                break;
            }

            else if ((blnRes = this.matchMultilineBlank()).matched) {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.merge(blnRes);
                result.GuaranteeMatched();
                text += " ";

                if (blnRes.content > 1) {
                    msg.push(this.getMessage("Text in paragraph block cannot contain linebreaks more than 1.", MessageType.warning));
                    //result.mergeState(ResultState.skippable);
                }
            }

            else if((ndRes = this.matchEscapeChar()).matched) {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.merge(ndRes);
                result.GuaranteeMatched();
                text += ndRes.content.content;
            }

            else if ((ndRes = this.matchInsertion()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(ndRes);
                result.GuaranteeMatched();
                // 不会失败
                node.children.push(ndRes.content);
            }

            else if ((ndRes = this.matchFormatBlock()).matched) {
                // 只能是 format block 前边判断过
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(ndRes);
                result.GuaranteeMatched();
                // match block 不会失败
                node.children.push(ndRes.content);
            }

            else {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.mergeState(ResultState.successful);
                result.GuaranteeMatched();
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
        this.cleanupText(result.content);
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

        result.mergeState(ResultState.successful);

        while (true) {
            curIndex = this.index;

            if (this.isEOF()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                }
                msg.push(this.getMessage("Text block ended abruptly."));
                result.mergeState(ResultState.skippable);
                return;
            }

            else if(this.is("]")) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                return;
            }

            // else if ((symRes = this.match("]")).matched) {
            //     if (text !== "") {
            //         node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
            //         text = "";
            //     }
            //     result.merge(symRes);
            //     result.highlights.push(this.getHighlight(HighlightType.operator, -1, 0));
            //     return;
            // }

            else if(this.isMultilineBlankGeThanOne()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                msg.push(this.getMessage("Text block ended abruptly."));
                result.mergeState(ResultState.skippable);
                return;
            }

            else if ((blnRes = this.matchMultilineBlank()).matched) {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.merge(blnRes);
                text += " ";

                if (blnRes.content > 1) {
                    msg.push(this.getMessage("Text block cannot contain linebreaks more than 1.", MessageType.warning));
                    //result.mergeState(ResultState.skippable);
                }
            }

            else if ((symRes = this.match("\\\\")).matched) {
                if (text === "") {
                    preIndex = curIndex;
                }
                msg.push(this.getMessage("Text block should not have \\\\.", MessageType.warning));
                text += "\\\\";
                //result.mergeState(ResultState.skippable);
            }

            else if((ndRes = this.matchEscapeChar()).matched) {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.merge(ndRes);
                text += ndRes.content.content;
            }

            else if ((ndRes = this.matchInsertion()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(ndRes);
                // 不会失败
                node.children.push(ndRes.content);
            }

            else if (this.isBasicBlock()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }

                msg.push(this.getMessage("Text block should not have basic block"));
                result.mergeState(ResultState.skippable);
                this.skipByBrackets();
            }

            else if (this.isOtherBlock()) {
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                msg.push(this.getMessage("Text block should not have other block"));
                result.mergeState(ResultState.skippable);
                this.skipByBrackets();
            }

            else if ((ndRes = this.matchFormatBlock()).matched) {
                // 只能是 format block 前边判断过
                if (text !== "") {
                    node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(ndRes);
                // match block 不会失败
                node.children.push(ndRes.content);
            }

            else {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.mergeState(ResultState.successful);
                text += this.curChar();
                this.move();
            }
        }
    }

    // MatchEscapeChar: failing | successful

    matchEscapeChar(): Result<Node> {
        let result = new Result<Node>(new Node(this.escapeCharType));
        let preIndex = this.index;
        this.begin("escape-char");
        this.myMatchEscapeChar(result);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchEscapeChar(result: Result<Node>) {
        let node = result.content;
        let msg = result.messages;

        result.merge(this.match("\\"));
        if (result.shouldTerminate) {
            msg.push(this.getMessage("Missing '\\'."));
            return;
        }
        result.GuaranteeMatched();

        if (!this.isEOF()) {
            switch (this.curChar()) {
                case "(": case ")":
                case "[": case "]": case "/": case "#": case "@":
                    node.content += this.curChar();
                    result.highlights.push(this.getHighlight(HighlightType.operator, -1, 1));
                    break;
                default:
                    node.content += "\\";
                    node.content += this.curChar();
                    msg.push(this.getMessage(`\\${this.curChar()} is not an escape char.`, MessageType.warning));
            }
            this.move();
            result.mergeState(ResultState.successful);
        }
        else {
            node.content = "\\";
            msg.push(this.getMessage(`Escape char ended abruptly.`, MessageType.warning));
        }
    }

    // MatchReference: failing | skippable | successful

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
            msg.push(this.getMessage("Missing reference name."));
            result.promoteToSkippable();
            return;
        }
        node.content = name.content.content;
        result.highlights.push(this.getHighlight(HighlightType.keyword, name.content));

        result.merge(this.skipBlank());
    }

    // MatchInsertion: failing | skippable | successful

    isInsertion(): boolean {
        if(this.isEOF()) {
            return false;
        }
        if(this.insertionHandlerTable.has(this.curChar())) {
            return true;
        }
        return false;
    }

    matchInsertion(): Result<Node> {
        let result = new Result<Node>(new Node(this.insertionType));
        let preIndex = this.index;
        this.begin("insertion");
        this.myMatchInsertion(result);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    myMatchInsertion(result: Result<Node>) {
        if(this.isEOF()) {
            return;
        }
        let handler = this.insertionHandlerTable.getHandler(this.curChar());
        if(handler === undefined) {
            return;
        }
        result.content.content = this.curChar();
        result.GuaranteeMatched();

        let ndRes = handler();
        result.merge(ndRes);
        if (result.shouldTerminate) {
            result.promoteToSkippable();
            this.move();
            return;
        }
        result.content = ndRes.content;
    }

    // **************** Block ****************

    // MatchBlock: failing | skippable | successful

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

        let nameRes = this.matchName();
        result.merge(nameRes);
        if (result.shouldTerminate) {
            msg.push(this.getMessage("Missing name."));
            // Do not skip because it may not be a block.
            return;
        }
        node.content = nameRes.content.content;

        let handle: BlockHandler | undefined;
        handle = this.blockHandlerTable.getHandler(nameRes.content.content);
        if (handle === undefined) {
            msg.push(this.getMessage(`Block name '${nameRes.content.content}' not found.`));
            result.mergeState(ResultState.failing);
            return;
        }
        result.GuaranteeMatched();
        result.highlights.push(this.getHighlight(HighlightType.keyword, nameRes.content));

        result.merge(this.skipBlank());

        let argRes = this.matchArguments();
        result.merge(argRes);
        // matchArguments will not be failing
        result.content.children.push(argRes.content);

        let nResult = handle!(argRes.content);
        result.merge(nResult);
        if (result.shouldTerminate) {
            result.promoteToSkippable();
            this.skipByBrackets(1);
            return;
        }
        //result.content.children.push(nResult.content);
        result.content = nResult.content;

        if (this.isEOF()) {
            return;
        }
        result.merge(this.match("]"));
        if (result.shouldTerminate) {
            msg.push(this.getMessage("Missing ']'."));
            result.promoteToSkippable();
            return;
        }
        result.highlights.push(this.getHighlight(HighlightType.operator, -1, 0));
    }

    // MatchArguments: skippable | successful

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
                msg.push(this.getMessage(`Argument ended abruptly.`));
                result.mergeState(ResultState.skippable);
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

                result.merge(this.skipBlank());

                while (true) {
                    if (this.isEOF()) {
                        msg.push(this.getMessage(`Argument ended abruptly.`));
                        result.mergeState(ResultState.skippable);
                        break;
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
                        this.skipToBehind(")");
                        return;
                    }
                    result.highlights.push(this.getHighlight(HighlightType.operator, -1, 0));

                    result.merge(this.skipBlank());

                    nmRes = this.matchName();
                    result.merge(nmRes);
                    if (result.shouldTerminate) {
                        msg.push(this.getMessage(`Matching argument name failed.`));
                        result.promoteToSkippable();
                        this.skipToBehind(")");
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
                result.mergeState(ResultState.skippable);
                this.skipToBehind(")");
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

    // Assistant: GetBlockName: failing | successful

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

    // **************** Skipping ****************

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

    skipToBehind(char: string): boolean {
        while (true) {
            if (this.isEOF()) {
                return true;
            }
            else if (this.is(char)) {
                this.move();
                return true;
            }

            else {
                this.move();
            }

        }
    }

    // **************** Foundation ****************

    // MatchName: failing | successful

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
        while (true) {
            if ((comRes = this.matchSinglelineComment()).matched) {
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
        while (true) {
            if (this.is(Parser.blank)) {
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

    // Arguments

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
                result.mergeState(ResultState.skippable);
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

    // **************** Terminal Token ****************

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

    static nameChar = /[A-Za-z0-9-]/;
    static blank = /[\t \v\f]/;
    static newline = /[\r\n]/;

    isEOF(): boolean {
        return !this.notEnd();
    }

    is(text: string): boolean;
    is(exp: RegExp): boolean;
    is(condition: string | RegExp): boolean;
    is(condition: string | RegExp): boolean {
        if (typeof (condition) === "string") {
            let length = condition.length;
            if (!this.notEnd(length - 1)) {
                return false;
            }
            for (let i = 0; i < length; i++, this.move()) {
                if (this.curChar() !== condition[i]) {
                    this.move(-i);
                    return false;
                }
            }
            this.move(-length);
            return true;
        }
        else {
            if (this.isEOF()) {
                return false;
            }
            return condition.exec(this.curChar()) !== null;
        }
    }

    // Deprecated
    // isUnicode(char: string): boolean {
    //     return this.text.codePointAt(this.index) === char.codePointAt(0);
    // }

    // nextIs(char: string): boolean;
    // nextIs(exp: RegExp): boolean;
    // nextIs(condition: string | RegExp) {
    //     if (this.notEnd(1)) {
    //         this.move();
    //         var res = this.is(condition);
    //         this.move(-1);
    //         return res;
    //     }
    //     else {
    //         return false;
    //     }
    // }

    // **************** line number & message generate ****************

    // Line and character

    generateLineRanges() {
        this.lineRanges.push(0);
        for (let i = 0; i <= this.text.length; i++, this.move()) {
            if (this.isEOF() || this.is(Parser.newline)) {
                this.lineRanges.push(i + 1);
            }
        }
        this.index = 0;
    }

    getLineAndCharacter(index: number = this.index): { line: number, character: number } | undefined {
        // Use binary search to accerlate
        // this.lineRanges starts with 0 and ends with length+1
        for (let i = 0; i < this.lineRanges.length - 1; i++) {
            if (this.lineRanges[i] <= index && index < this.lineRanges[i + 1]) {
                return { line: i, character: index - this.lineRanges[i] };
            }
        }
        return undefined;
    }

    getIndex(line: number, character: number): number | undefined {
        if (0 <= line && line < this.lineRanges.length - 1) {
            if (character >= 0 && character + this.lineRanges[line] < this.lineRanges[line + 1]) {
                return character + this.lineRanges[line];
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
        //let lp = this.getLineAndCharacter() ?? { line: -1, character: -1 };
        //let pro = this.process.slice();
        return new Message(message, type, code, this.index, this.index + 1, []);
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


    // **************** index control ****************

    // Deprecated
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