/**
* Parser: analyise the document, generate the sytnax tree
*/

import { Type } from "../sytnax-tree/type";
import { Node } from "../sytnax-tree/node";
import { TypeTable } from "../sytnax-tree/type-table";
import { BlockHandlerTable, BlockHandler, ArgumentType, ArgumentsSpecification } from "./block-handler-table";
import { Math } from "./math/math";
import { Module } from "./module";
import { Highlight, HighlightType, Reference, Result, ResultState } from "../foundation/result";
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
    stringType: Type;
    numberType: Type;
    escapeCharType: Type;
    referenceType: Type;
    settingType: Type;
    settingParameterType: Type;
    blockType: Type;
    errorType: Type;
    argumentsType: Type;
    argumentType: Type;

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
    analysedTree: Node;

    // Message list
    messageList: Message[];

    // Highlights
    highlights: Highlight[];

    // References
    references: Reference[];

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
        this.stringType = this.typeTable.add("string")!;
        this.numberType = this.typeTable.add("number")!;
        this.escapeCharType = this.typeTable.add("escape-char")!;
        this.referenceType = this.typeTable.add("reference")!;
        this.settingType = this.typeTable.add("setting")!;
        this.settingParameterType = this.typeTable.add("setting-parameter")!;
        this.blockType = this.typeTable.add("block")!;
        this.errorType = this.typeTable.add("error")!;
        this.argumentsType = this.typeTable.add("arguments")!;
        this.argumentType = this.typeTable.add("argument")!;

        this.blockHandlerTable = new BlockHandlerTable();

        // other blocks
        this.otherBlocks = new Set(["paragraph"]);
        const paragraphSpec: ArgumentsSpecification = { arguments: new Map([
            ["start", { type: ArgumentType.enumeration, options: ["titled", "default"], default: "default" }]
        ]), allowReference: false };
        this.blockHandlerTable.add("paragraph", this.paragraphBlockHandler, this, paragraphSpec);

        // basic blocks (formula is added in math module)
        this.basicBlocks = new Set(["text"]);
        const textSpec: ArgumentsSpecification = { arguments: new Map([
            ["start", { type: ArgumentType.enumeration, options: ["indent", "noindent", "auto"], default: "auto" }]
        ]), allowReference: false };
        this.blockHandlerTable.add("text", this.textBlockHandler, this, textSpec);

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
        this.analysedTree = new Node(this.documentType);
        this.messageList = [];
        this.highlights = [];
        this.references = [];
        this.state = ResultState.failing;
    }

    // *********** Init and Parse ***************

    private init(text: string) {
        this.text = text;
        this.index = 0;
        this.lineRanges = [];
        this.process = [];

        this.syntaxTree = new Node(this.documentType);
        this.analysedTree = new Node(this.documentType);
        this.messageList = [];
        this.highlights = [];
        this.references = [];
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
        this.analysedTree = result.analysedContent;
        this.messageList = result.messages;
        this.highlights = result.highlights;
        this.state = result.state;
        this.references = result.references;
    }

    // ************ Core Grammers *************

    // MatchDocument: failing | skippable | successful

    matchDocument(): Result<Node> {
        // analyse 在 parse 中处理了
        return this.prepareMatch(this.documentType, "document", this.myMatchDocument, this);
        // let result = new Result<Node>(new Node(this.documentType));
        // result.analysedContent = new Node(this.documentType);
        // let preIndex = this.index;
        // this.begin("document");
        // this.myMatchDocument(result);
        // this.end();
        // result.content.begin = preIndex;
        // result.content.end = this.index;
        // if (result.failed) {
        //     this.index = preIndex;
        // }
        // return result;
    }

    private myMatchDocument(result: Result<Node>) {
        let nodeRes: Result<Node>;

        result.mergeState(ResultState.successful);

        while (true) {
            if (this.isEOF()) {
                break;
            }

            else if ((nodeRes = this.matchSetting()).matched) {
                result.merge(nodeRes);
                if (result.shouldTerminate) {
                    return;
                }
                this.mergeNodeToChildren(result, nodeRes);

                // result.content.children.push(tmpRes.content);
                // if(!tmpRes.discarded) {
                //     analysedNode.children.push(tmpRes.analysedContent ?? Node.clone(tmpRes.content));
                // }
            }

            else if ((nodeRes = this.matchFreeParagraph()).matched) {
                result.merge(nodeRes);
                if (result.shouldTerminate) {
                    return;
                }
                this.mergeNodeToChildren(result, nodeRes);
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                result.merge(nodeRes);
                if (result.shouldTerminate) {
                    return;
                }
                this.mergeNodeToChildren(result, nodeRes);
            }

            else {
                // 理论上不会出现
                result.mergeState(ResultState.failing);
                this.mergeMessage(result, "[[Logical Error]] Matching paragraph, setting and block failed.");
                return;
            }
        }
    }

    // MatchSetting: failing | skippable | successful

    matchSetting(): Result<Node> {
        return this.prepareMatch(this.settingType, "setting", this.myMatchSetting, this, this.defaultAnalysis);
    }

    private myMatchSetting(result: Result<Node>) {
        let node = result.content;
        let paramNode = new Node(this.settingParameterType, "");
        node.children.push(paramNode);


        result.merge(this.match("#"));
        if (result.shouldTerminate) {
            this.mergeMessage(result, "Missing '#'.");
            return;
        }
        result.GuaranteeMatched();
        this.mergeHighlight(result, HighlightType.operator, -1, 0);

        result.merge(this.skipBlank());

        let nameRes = this.matchName();
        result.merge(nameRes);
        if (result.shouldTerminate) {
            this.mergeMessage(result, "Missing name.");

            result.promoteToSkippable();
            this.skipToEndOfLine();
            return;
        }
        this.mergeHighlight(result, HighlightType.keyword, nameRes.content);
        node.content = nameRes.content.content;

        result.merge(this.skipBlank());

        result.merge(this.match(":"));
        if (result.shouldTerminate) {
            this.mergeMessage(result, "Missing ':'.");

            result.promoteToSkippable();
            this.skipToEndOfLine();
            return;
        }
        this.mergeHighlight(result, HighlightType.operator, -1, 0);

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
        paramNode.content = command;
    }

    defaultAnalysis(result: Result<Node>) {
        // let source = result.content;
        // let dist = result.analysedContent;

        // dist.content = source.content;
        // for (let child of source.children) {
        //     dist.children.push(Node.clone(child));
        // }

        Node.copyTo(result.content, result.analysedContent);

        result.discarded = false;
    }

    isSetting(): boolean {
        return this.is("#");
    }

    // **************** Text & Paragraph ****************

    // MatchFreeParagraph: failing | skippable | successful

    matchFreeParagraph(): Result<Node> {
        return this.prepareMatch(this.paragraphType, "free-paragraph", this.myMatchFreeParagraph, this, this.cleanupParagraph);

        // let result = new Result<Node>(new Node(this.paragraphType));
        // result.analysedContent = new Node(this.paragraphType);
        // let preIndex = this.index;
        // this.begin("free-paragraph");
        // this.myMatchFreeParagraph(result);
        // this.end();
        // result.content.begin = preIndex;
        // result.content.end = this.index;
        // result.discarded = (result.analysedContent.children.length === 0);
        // if (result.failed) {
        //     this.index = preIndex;
        // }
        // return result;
    }

    private myMatchFreeParagraph(result: Result<Node>) {
        let nodeRes: Result<Node>;
        let symRes: Result<null>;

        // result.content.children.push(new Node(this.argumentsType));
        // result.analysedContent.children.push(new Node(this.argumentsType));

        while (true) {
            if (this.isEOF()) {
                break;
            }
            else if ((symRes = this.matchMultilineBlankGeThanOne()).matched) {
                result.merge(symRes);
                result.GuaranteeMatched();
                break;
            }
            else if (this.isOtherBlock()) {
                break;
            }
            else if (this.isSetting()) {
                break;
            }

            else if ((nodeRes = this.matchFreeText()).matched) {
                result.merge(nodeRes);
                result.GuaranteeMatched();
                if (result.shouldTerminate) {
                    return;
                }
                this.mergeNodeToChildren(result, nodeRes);
            }

            else if ((nodeRes = this.matchBasicBlock()).matched) {
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // match block 不会失败
                this.mergeNodeToChildren(result, nodeRes);
            }
            else {
                this.mergeMessage(result, "[[Logical Error]]Unintended 'else'. Free paragraph match failed.");
                result.mergeState(ResultState.failing);
                return;
            }
        }
    }

    cleanupParagraph(result: Result<Node>) {
        result.discarded = (result.analysedContent.children.length === 0);
    }

    cleanupText(result: Result<Node>) {
        let analNode = result.analysedContent;

        // 一定不含有一个 Arguments 节点
        // word node 的begin end 没改
        if (analNode.children.length === 0) {
            result.discarded = true;
            return;
        }

        // 将 word 连起来
        let preIsWord = false;
        for (let i = 0; i < analNode.children.length; i++) {
            let node = analNode.children[i];
            if (preIsWord && node.type === this.wordsType) {
                let preNode = analNode.children[i - 1];
                if (preNode.content.endsWith(" ") && node.content.startsWith(" ")) {
                    node.content = node.content.slice(1);
                }
                preNode.content = preNode.content.concat(node.content);
                preNode.end = node.end;
                analNode.children.splice(i, 1);
                i--;
                continue;
            }

            preIsWord = (node.type === this.wordsType);
        }

        // 前边判断了, 这里 length 一定大于等于 1
        // 去除首尾空格
        let node = analNode.children[0];
        if (node.type === this.wordsType && node.content.startsWith(" ")) {
            node.content = node.content.slice(1);
            if (node.content.length === 0) {
                analNode.children.splice(0, 1);
            }
        }
        if (analNode.children.length === 0) {
            result.discarded = true;
            return;
        }
        node = analNode.children.at(-1)!;
        if (node.type === this.wordsType && node.content.endsWith(" ")) {
            node.content = node.content.slice(0, -1);
            if (node.content.length === 0) {
                analNode.children.splice(-1, 1);
            }
        }
        result.discarded = (analNode.children.length === 0);
    }

    // MatchFreeText: failing | skippable | successful

    matchFreeText(): Result<Node> {
        return this.prepareMatch(this.textType, "free-text", this.myMatchFreeText, this, this.cleanupText);

        // let result = new Result<Node>(new Node(this.textType));
        // result.analysedContent = new Node(this.textType);
        // let preIndex = this.index;
        // this.begin("free-text");
        // this.myMatchFreeText(result);
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

    private myMatchFreeText(result: Result<Node>) {
        let node = result.content;
        let analysedNode = result.analysedContent;

        // node.children.push(new Node(this.argumentsType));
        // analysedNode.children.push(new Node(this.argumentsType));

        let text = "";
        let symRes: Result<null>;
        let nodeRes: Result<Node>;

        let preIndex = 0, curIndex: number;

        const mergeWordsNode = () => {
            if (text !== "") {
                node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                analysedNode.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        while (true) {
            curIndex = this.index;

            if (this.isEOF()) {
                mergeWordsNode();
                break;
            }

            else if (this.isMultilineBlankGeThanOne()) {
                mergeWordsNode();
                break;
            }
            else if ((symRes = this.match("\\\\")).matched) {
                mergeWordsNode();
                result.merge(symRes);
                result.GuaranteeMatched();
                this.mergeHighlight(result, HighlightType.operator, -2, 0);
                break;
            }
            else if (this.isBasicBlock()) {
                mergeWordsNode();
                break;
            }
            else if (this.isOtherBlock()) {
                mergeWordsNode();
                break;
            }
            else if (this.isSetting()) {
                mergeWordsNode();
                break;
            }


            else if ((symRes = this.matchMultilineBlankLeThanOrEqOne()).matched) { // 结束条件判断过大于一行的空行, 这里只能是一行以内的
                resetIndex();
                result.merge(symRes);
                result.GuaranteeMatched();
                text += " ";
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                text += nodeRes.content.content;
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // 不会失败
                this.mergeNodeToChildren(result, nodeRes);
            }

            else if ((nodeRes = this.matchFormatBlock()).matched) {
                // 只能是 format block  前边判断过
                mergeWordsNode();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // match block 不会失败
                this.mergeNodeToChildren(result, nodeRes);
            }

            else {
                resetIndex();
                result.mergeState(ResultState.successful);
                result.GuaranteeMatched();
                text += this.curChar();
                this.move();
            }
        }
    }

    // ParagraphBlockHandler: failing | skippable | successful

    paragraphBlockHandler(args: Node = new Node(this.argumentsType)): Result<Node> {
        return this.prepareMatch(this.paragraphType, "paragraph-block-handler", this.myParagraphBlockHandler, this, this.cleanupParagraph);

        // let result = new Result<Node>(new Node(this.paragraphType));
        // result.analysedContent = new Node(this.paragraphType);
        // let preIndex = this.index;
        // this.begin("paragraph-block-handler");
        // this.myParagraphBlockHandler(result, args);
        // this.end();
        // result.content.begin = preIndex;
        // result.content.end = this.index;
        // result.discarded = (result.analysedContent.children.length === 0);
        // if (result.failed) {
        //     this.index = preIndex;
        // }
        // return result;
    }

    paragraphLikeBlockHandler(blockName: string, type: Type, args: Node = new Node(this.argumentsType)): Result<Node> {
        let result = this.prepareMatch(this.paragraphType, `${blockName}-block-handler`, this.myParagraphBlockHandler, this, this.cleanupParagraph);
        result.content.type = type;
        result.analysedContent.type = type;
        return result;

        // let result = new Result<Node>(new Node(this.paragraphType));
        // result.analysedContent = new Node(this.paragraphType);
        // let preIndex = this.index;
        // this.begin(`${blockName}-block-handler`);
        // this.myParagraphBlockHandler(result, args);
        // this.end();
        // result.content.begin = preIndex;
        // result.content.end = this.index;
        // if (result.failed) {
        //     this.index = preIndex;
        // }
        // return result;
    }

    private myParagraphBlockHandler(result: Result<Node>, args: Node = new Node(this.argumentsType), blockName: string = "paragraph") {
        //let node = result.content;

        let nodeRes: Result<Node>;

        //node.children.push(args);

        result.mergeState(ResultState.successful);

        // for (let arg of args.children) {
        //     if (arg.content === "titled") {
        //         node.content = "titled";
        //     }
        // }

        while (true) {
            if (this.isEOF()) {
                this.mergeMessage(result, "Paragraph block ended abruptly.");
                result.mergeState(ResultState.skippable);
                return;
            }
            if (this.isMultilineBlankGeThanOne()) {
                this.mergeMessage(result, "Paragraph block ended abruptly.");
                result.mergeState(ResultState.skippable);
                return;
            }
            else if (this.is("]")) {
                break;
            }
            else if (this.isOtherBlock()) {
                this.mergeMessage(result, "Paragraph block should not have other block.");
                result.mergeState(ResultState.skippable);
                this.skipByBrackets();
                continue;
            }

            else if ((nodeRes = this.matchParFreeText()).matched) {
                result.merge(nodeRes);
                // match par free text 不会失败
                this.mergeNodeToChildren(result, nodeRes);
            }

            else if ((nodeRes = this.matchBasicBlock()).matched) { // par free text 中检测过 format block
                result.merge(nodeRes);
                // match block 不会失败
                this.mergeNodeToChildren(result, nodeRes);
            }
            else {
                this.mergeMessage(result, "[[Logical Error]]Unintended 'else'. Matching paragraph block failed.");
                result.mergeState(ResultState.failing);
                return;
            }
        }
    }

    // MatchParFreeText: failing | skippable | successful

    matchParFreeText(): Result<Node> {
        return this.prepareMatch(this.textType, "par-free-text", this.myMatchParFreeText, this, this.cleanupText);

        // let result = new Result<Node>(new Node(this.textType));
        // result.analysedContent = new Node(this.textType);
        // let preIndex = this.index;
        // this.begin("par-free-text");
        // this.myMatchParFreeText(result);
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

    private myMatchParFreeText(result: Result<Node>) {
        let node = result.content;
        let analysedNode = result.analysedContent;

        // node.children.push(new Node(this.argumentsType));
        // analysedNode.children.push(new Node(this.argumentsType));

        let text = "";
        let symRes: Result<null>;
        let blkRes: Result<number>;
        let nodeRes: Result<Node>;

        let preIndex = 0, curIndex: number;

        const mergeWordsNode = () => {
            if (text !== "") {
                node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                analysedNode.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        while (true) {
            curIndex = this.index;

            if (this.isEOF()) {
                mergeWordsNode();
                break;
            }

            else if (this.isMultilineBlankGeThanOne()) {
                mergeWordsNode();
                break;
            }

            else if (this.is("]")) {
                mergeWordsNode();
                break;
            }
            else if ((symRes = this.match("\\\\")).matched) {
                mergeWordsNode();
                result.merge(symRes);
                result.GuaranteeMatched();
                this.mergeHighlight(result, HighlightType.operator, -2, 0);
                break;
            }
            else if (this.isBasicBlock()) {
                mergeWordsNode();
                break;
            }
            else if (this.isOtherBlock()) {
                mergeWordsNode();
                break;
            }

            else if ((blkRes = this.matchMultilineBlank()).matched) {
                resetIndex();
                result.merge(blkRes);
                result.GuaranteeMatched();
                text += " ";

                if (blkRes.content > 1) {
                    this.mergeMessage(result, "Text in paragraph block cannot contain linebreaks more than 1.", MessageType.warning);
                    //result.mergeState(ResultState.skippable);
                }
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                text += nodeRes.content.content;
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // 不会失败
                this.mergeNodeToChildren(result, nodeRes);
            }

            else if ((nodeRes = this.matchFormatBlock()).matched) {
                // 只能是 format block 前边判断过
                mergeWordsNode();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // match block 不会失败
                this.mergeNodeToChildren(result, nodeRes);
            }

            else {
                resetIndex();
                result.mergeState(ResultState.successful);
                result.GuaranteeMatched();
                text += this.curChar();
                this.move();
            }
        }
    }

    // TextBlockHandler: failing | skippable | successful

    textBlockHandler(args: Node = new Node(this.argumentsType)): Result<Node> {
        return this.prepareMatch(this.textType, "text-block-handler", this.myTextBlockHandler, this, this.cleanupText);

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

    textLikeBlockHandler(blockName: string, type: Type, args: Node = new Node(this.argumentsType)): Result<Node> {
        let result = this.prepareMatch(this.textType, `${blockName}-block-handler`, this.myTextBlockHandler, this, this.cleanupText);
        result.content.type = type;
        result.analysedContent.type = type;
        return result;
    }

    // myTextLikeBlockHandler(blockName: string, result: Result<Node>, args: Node = new Node(this.argumentsType)) {
    //     result.analysedContent = Node.clone(result.content);
    //     this.myTextBlockHandler(result, args);
    // }

    private myTextBlockHandler(result: Result<Node>, args: Node = new Node(this.argumentsType)) {
        let node = result.content;
        let analysedNode = result.analysedContent;

        let text = "";
        let symRes: Result<null>;
        let blkRes: Result<number>;
        let nodeRes: Result<Node>;

        let preIndex = 0, curIndex: number;

        // node.children.push(args);

        const mergeWordsNode = () => {
            if (text !== "") {
                node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                analysedNode.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
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
            curIndex = this.index;

            if (this.isEOF()) {
                mergeWordsNode();
                this.mergeMessage(result, "Text block ended abruptly.");
                result.mergeState(ResultState.skippable);
                break;
            }
            else if (this.is("]")) {
                mergeWordsNode();
                break;
            }
            else if (this.isMultilineBlankGeThanOne()) {
                mergeWordsNode();
                this.mergeMessage(result, "Text block ended abruptly.");
                result.mergeState(ResultState.skippable);
                return;
            }

            else if ((blkRes = this.matchMultilineBlank()).matched) {
                resetIndex();
                result.merge(blkRes);
                text += " ";

                if (blkRes.content > 1) {
                    this.mergeMessage(result, "Text block cannot contain linebreaks more than 1.", MessageType.warning);
                    //result.mergeState(ResultState.skippable);
                }
            }

            else if ((symRes = this.match("\\\\")).matched) {
                resetIndex();
                this.mergeMessage(result, "Text block should not have \\\\.", MessageType.warning);
                text += "\\\\";
                //result.mergeState(ResultState.skippable);
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes);
                text += nodeRes.content.content;
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes);
                // 不会失败
                this.mergeNodeToChildren(result, nodeRes);
            }

            else if (this.isBasicBlock()) {
                mergeWordsNode();

                this.mergeMessage(result, "Text block should not have basic block");
                result.mergeState(ResultState.skippable);
                this.skipByBrackets();
            }

            else if (this.isOtherBlock()) {
                mergeWordsNode();
                this.mergeMessage(result, "Text block should not have other block");
                result.mergeState(ResultState.skippable);
                this.skipByBrackets();
            }

            else if ((nodeRes = this.matchFormatBlock()).matched) {
                // 只能是 format block 前边判断过
                mergeWordsNode();
                result.merge(nodeRes);
                // match block 不会失败
                this.mergeNodeToChildren(result, nodeRes);
            }

            else {
                resetIndex();
                result.mergeState(ResultState.successful);
                text += this.curChar();
                this.move();
            }
        }
    }

    // FormatLikeBlockHandler: failing | skippable | successful

    formatLikeBlockHandler(blockName: string, type: Type, args: Node = new Node(this.argumentsType)): Result<Node> {
        let result = this.prepareMatch(this.textType, `${blockName}-block-handler`, this.myFormatLikeBlockHandler.bind(this, blockName), this, this.cleanupText);
        result.content.type = type;
        result.analysedContent.type = type;
        return result;
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

    private myFormatLikeBlockHandler(blockName: string, result: Result<Node>, args: Node = new Node(this.argumentsType)) {
        let node = result.content;
        let analysedNode = result.analysedContent;


        let text = "";
        let symRes: Result<null>;
        let blkRes: Result<number>;
        let nodeRes: Result<Node>;

        let preIndex = 0, curIndex: number;

        // node.children.push(args);

        const mergeWordsNode = () => {
            if (text !== "") {
                node.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                analysedNode.children.push(new Node(this.wordsType, text, [], preIndex, curIndex));
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        result.mergeState(ResultState.successful);

        while (true) {
            curIndex = this.index;

            if (this.isEOF()) {
                mergeWordsNode();
                this.mergeMessage(result, "Format block ended abruptly.");
                result.mergeState(ResultState.skippable);
                break;
            }

            else if (this.is("]")) {
                mergeWordsNode();
                return;
            }

            else if (this.isMultilineBlankGeThanOne()) {
                mergeWordsNode();
                this.mergeMessage(result, "Format block ended abruptly.");
                result.mergeState(ResultState.skippable);
                return;
            }

            else if ((blkRes = this.matchMultilineBlank()).matched) { // 结束条件判断过大于一行的空行, 这里只能是一行以内的
                resetIndex();
                result.merge(blkRes);
                text += " ";
                if (blkRes.content > 1) {
                    this.mergeMessage(result, "Format block cannot contain linebreaks more than 1.", MessageType.warning);
                    //result.mergeState(ResultState.skippable);
                }
            }

            else if ((symRes = this.match("\\\\")).matched) {
                resetIndex();
                this.mergeMessage(result, "Format block should not have \\\\.", MessageType.warning);
                text += "\\\\";
                //result.mergeState(ResultState.skippable);
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes);
                text += nodeRes.content.content;
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes);
                // 不会失败
                this.mergeNodeToChildren(result, nodeRes);
            }

            else if (this.isBlock()) {
                mergeWordsNode();
                this.mergeMessage(result, "Format block should not have block.");
                result.mergeState(ResultState.skippable);
                this.skipByBrackets();
            }

            else {
                resetIndex();
                result.mergeState(ResultState.successful);
                text += this.curChar();
                this.move();
            }
        }
    }

    // MatchEscapeChar: failing | successful

    matchEscapeChar(): Result<Node> {
        return this.prepareMatch(this.escapeCharType, "escape-char", this.myMatchEscapeChar, this, this.defaultAnalysis);

        // let result = new Result<Node>(new Node(this.escapeCharType));
        // let preIndex = this.index;
        // this.begin("escape-char");
        // this.myMatchEscapeChar(result);
        // this.end();
        // result.content.begin = preIndex;
        // result.content.end = this.index;
        // if (result.failed) {
        //     this.index = preIndex;
        // }
        // return result;
    }

    private myMatchEscapeChar(result: Result<Node>) {
        let node = result.content;

        result.merge(this.match("\\"));
        if (result.shouldTerminate) {
            this.mergeMessage(result, "Missing '\\'.");
            return;
        }
        result.GuaranteeMatched();

        if (!this.isEOF()) {
            switch (this.curChar()) {
                case "(": case ")":
                case "[": case "]": case "/": case "#": case "@":
                    node.content += this.curChar();
                    this.mergeHighlight(result, HighlightType.operator, -1, 1);
                    break;
                default:
                    node.content += "\\";
                    node.content += this.curChar();
                    this.mergeMessage(result, `\\${this.curChar()} is not an escape char.`, MessageType.warning);
            }
            this.move();
            result.mergeState(ResultState.successful);
        }
        else {
            node.content = "\\";
            this.mergeMessage(result, `Escape char ended abruptly.`, MessageType.warning);
        }
    }

    // MatchReference: failing | skippable | successful

    matchReference(): Result<Node> {
        return this.prepareMatch(this.referenceType, "reference", this.myMatchReference, this, this.defaultAnalysis);

        // let result = new Result<Node>(new Node(this.referenceType));
        // let preIndex = this.index;
        // this.begin("reference");
        // this.myMatchReference(result);
        // this.end();
        // result.content.begin = preIndex;
        // result.content.end = this.index;
        // if (result.failed) {
        //     this.index = preIndex;
        // }
        // return result;
    }

    private myMatchReference(result: Result<Node>) {
        let node = result.content;

        result.merge(this.match("@"));
        if (result.shouldTerminate) {
            this.mergeMessage(result, "Missing '@'.");
            return;
        }
        this.mergeHighlight(result, HighlightType.operator, -1, 0);
        result.GuaranteeMatched();

        result.merge(this.skipBlank());

        let name = this.matchName();
        result.merge(name);
        if (result.shouldTerminate) {
            this.mergeMessage(result, "Missing reference name.");
            result.promoteToSkippable();
            return;
        }
        node.content = name.content.content;
        this.mergeHighlight(result, HighlightType.keyword, name.content);

        if(this.is(";")) {
            result.merge(this.match(";"));
            this.mergeHighlight(result, HighlightType.operator, -1, 0);
        }
        else {
            result.merge(this.skipBlank());
        }
    }

    // MatchInsertion: failing | skippable | successful

    isInsertion(): boolean {
        if (this.isEOF()) {
            return false;
        }
        if (this.insertionHandlerTable.has(this.curChar())) {
            return true;
        }
        return false;
    }

    matchInsertion(): Result<Node> {
        // analyse 在 parse 中一起处理了
        return this.prepareMatch(this.insertionType, "insertion", this.myMatchInsertion, this);

        // let result = new Result<Node>(new Node(this.insertionType));
        // let preIndex = this.index;
        // this.begin("insertion");
        // this.myMatchInsertion(result);
        // this.end();
        // result.content.begin = preIndex;
        // result.content.end = this.index;
        // if (result.failed) {
        //     this.index = preIndex;
        // }
        // return result;
    }

    myMatchInsertion(result: Result<Node>) {
        let node = result.content;
        let analysedNode = result.analysedContent;

        if (this.isEOF()) {
            return;
        }
        let handler = this.insertionHandlerTable.getHandler(this.curChar());
        if (handler === undefined) {
            return;
        }
        result.content.content = this.curChar();
        result.GuaranteeMatched();

        let hdlRes = handler();
        result.merge(hdlRes);
        if (result.shouldTerminate) {
            result.promoteToSkippable();
            this.move();
            return;
        }

        node.children.push(hdlRes.content);
        // 此处相当于令 analyseNode = hdlRes.analysedContent 浅拷贝
        Node.moveTo(hdlRes.analysedContent, analysedNode);
    }

    // **************** Block ****************

    // MatchBlock: failing | skippable | successful

    matchBlock(): Result<Node> {
        // analyse 在 parse 中一起处理了
        return this.prepareMatch(this.blockType, "block", this.myMatchBlock, this);

        // let result = new Result<Node>(new Node(this.blockType));
        // result.analysedContent = new Node(this.blockType);
        // let preIndex = this.index;
        // this.begin("block");
        // this.myMatchBlock(result);
        // this.end();
        // result.content.begin = preIndex;
        // result.content.end = this.index;
        // if (result.failed) {
        //     this.index = preIndex;
        // }
        // return result;
    }

    private myMatchBlock(result: Result<Node>) {
        let node = result.content;
        let analysedNode = result.analysedContent;

        result.merge(this.match("["));
        if (result.shouldTerminate) {
            this.mergeMessage(result, "Missing '['.");
            return;
        }
        this.mergeHighlight(result, HighlightType.operator, -1, 0);

        result.merge(this.skipBlank());

        let nameRes = this.matchName();
        result.merge(nameRes);
        if (result.shouldTerminate) {
            this.mergeMessage(result, "Missing name.");
            // Do not skip because it may not be a block.
            return;
        }
        node.content = nameRes.content.content;

        let handle: BlockHandler | undefined;
        handle = this.blockHandlerTable.getHandler(nameRes.content.content);
        if (handle === undefined) {
            this.mergeMessage(result, `Block name '${nameRes.content.content}' not found.`);
            result.mergeState(ResultState.failing);
            return;
        }
        result.GuaranteeMatched();
        this.mergeHighlight(result, HighlightType.keyword, nameRes.content);

        let argRes = this.matchArguments(nameRes.content.content);
        result.merge(argRes);
        // matchArguments will not be failing
        node.children.push(argRes.content);
        analysedNode.children.push(argRes.analysedContent);
        result.references.forEach(value => {
            value.node = result.analysedContent;
        });

        let hdlRes = handle!(argRes.content);
        result.merge(hdlRes);
        if (result.shouldTerminate) {
            result.promoteToSkippable();
            this.skipByBrackets(1);
            return;
        }
        node.children.push(hdlRes.content);
        // 此处相当于令 analyseNode = hdlRes.analysedContent 浅拷贝
        Node.moveTo(hdlRes.analysedContent, analysedNode);
        result.discarded = hdlRes.discarded;

        result.merge(this.match("]"));
        if (result.shouldTerminate) {
            this.mergeMessage(result, "Missing ']'.");
            result.promoteToSkippable();
            return;
        }
        this.mergeHighlight(result, HighlightType.operator, -1, 0);
    }


    // MatchArguments: skippable | successful

    checkAndStandardizeArguments(blockName: string, result: Result<Node>) {
        let stdArguments = result.analysedContent;
        let argumentsSpec = this.blockHandlerTable.getSpecification(blockName)!;

        const argumentTypeToType: Map<ArgumentType, Type> = new Map([[ArgumentType.string, this.stringType], [ArgumentType.number, this.numberType], [ArgumentType.enumeration, this.nameType]]);

        for (let [name, spec] of argumentsSpec.arguments) {
            let stdArgument = new Node(this.argumentType, name);
            stdArgument.children.push(new Node(argumentTypeToType.get(spec.type)!, spec.default));
            stdArguments.children.push(stdArgument);
        }

        // 可以避免重复输入参数或者少输入参数带来的问题

        let references: Set<string> = new Set();

        for (let argument of result.content.children) {
            let name = argument.content;
            if (argument.children.length === 0) {
                // 不可能的情况
                this.mergeMessage(result, `Argument '${name}' has no value.`);
                result.mergeState(ResultState.skippable);
                continue;
            }

            let argumentValue = argument.children[0];

            if (argumentValue.type === this.referenceType) {
                if(!argumentsSpec.allowReference) {
                    this.mergeMessage(result, `References is not allowed in block '${blockName}'.`);
                    result.mergeState(ResultState.skippable);
                    continue;
                }
                if (references.has(argumentValue.content)) {
                    this.mergeMessage(result, `Reference '${argumentValue.content}' is repeated.`);
                    result.mergeState(ResultState.skippable);
                }
                references.add(argumentValue.content);
                continue;
            }

            if (argument.content === "") {
                let notUnique = false;
                argumentsSpec.arguments.forEach((value, key) => {
                    if (value.options.indexOf(argumentValue.content) !== -1) {
                        if (name !== "") {
                            notUnique = true;
                            return;
                        }
                        name = key;
                    }
                })
                if (notUnique) {
                    this.mergeMessage(result, `Implicit argument '${argumentValue.content}' is not unique.`);
                    result.mergeState(ResultState.skippable);
                }
                if (name === "") {
                    this.mergeMessage(result, `Implicit argument '${argumentValue.content}' is not correct.`);
                    result.mergeState(ResultState.skippable);
                    continue;
                }
            }

            let spec = argumentsSpec.arguments.get(name);
            if (!spec) {
                this.mergeMessage(result, `Argument '${name}' not identified.`);
                result.mergeState(ResultState.skippable);
                continue;
            }

            if (argumentTypeToType.get(spec.type) !== argumentValue.type) {
                this.mergeMessage(result, `Type of argument '${name}' is not correct.`);
                result.mergeState(ResultState.skippable);
                continue;
            }

            if (spec.type === ArgumentType.enumeration && spec.options.indexOf(argumentValue.content) === -1) {
                this.mergeMessage(result, `Value of enumeration argument '${name}' is not correct.`);
                result.mergeState(ResultState.skippable);
                continue;
            }

            stdArguments.children.find(node => node.content === name)!.children[0].content = argumentValue.content;
        }

        references.forEach(value => {
            stdArguments.children.push(new Node(this.referenceType, value));
            result.references.push(new Reference(value, result.analysedContent));
        });
    }

    matchArguments(blockName: string): Result<Node> {
        return this.prepareMatch(this.argumentsType, "arguments", this.myMatchArguments, this, this.checkAndStandardizeArguments.bind(this, blockName));

        // let result = new Result<Node>(new Node(this.argumentsType));
        // let preIndex = this.index;
        // this.begin("arguments");
        // this.myMatchArguments(result);
        // this.end();
        // result.content.begin = preIndex;
        // result.content.end = this.index;
        // if (result.failed) {
        //     this.index = preIndex;
        // }
        // return result;
    }

    private myMatchArguments(result: Result<Node>) {
        let node = result.content;

        let symRes: Result<null>;
        let nodeRes: Result<Node>;

        // This is an 'is' function
        let preIndex = this.index;
        let skip = false;
        this.skipBlank();
        if (this.is("(") || this.is(":")) {
            skip = true;
        }
        this.index = preIndex;

        if (skip) {
            result.merge(this.skipBlank());
        }

        if ((symRes = this.match("(")).matched) {
            result.merge(symRes);
            this.mergeHighlight(result, HighlightType.operator, -1, 0);

            result.merge(this.skipBlank());

            if (this.isEOF()) {
                this.mergeMessage(result, `Argument ended abruptly.`);
                result.mergeState(ResultState.skippable);
                return;
            }
            else if ((symRes = this.match(")")).matched) {
                result.merge(symRes);
                this.mergeHighlight(result, HighlightType.operator, -1, 0);
            }
            else if ((nodeRes = this.matchArgument()).matched) {
                result.merge(nodeRes);
                node.children.push(nodeRes.content);

                result.merge(this.skipBlank());

                while (true) {
                    if (this.isEOF()) {
                        this.mergeMessage(result, `Argument ended abruptly.`);
                        result.mergeState(ResultState.skippable);
                        break;
                    }
                    else if ((symRes = this.match(")")).matched) {
                        result.merge(symRes);
                        this.mergeHighlight(result, HighlightType.operator, -1, 0);
                        break;
                    }

                    result.merge(this.match(","));
                    if (result.shouldTerminate) {
                        this.mergeMessage(result, `Missing ','.`);
                        result.promoteToSkippable();
                        this.skipToAfter(")");
                        return;
                    }
                    this.mergeHighlight(result, HighlightType.operator, -1, 0);

                    result.merge(this.skipBlank());

                    nodeRes = this.matchArgument();
                    result.merge(nodeRes);
                    if (result.shouldTerminate) {
                        this.mergeMessage(result, `Matching argument name failed.`);
                        result.promoteToSkippable();
                        this.skipToAfter(")");
                        return;
                    }
                    node.children.push(nodeRes.content);

                    result.merge(this.skipBlank());
                }
            }
            else {
                this.mergeMessage(result, `Unrecognized argument.`);
                result.mergeState(ResultState.skippable);
                this.skipToAfter(")");
                return;
            }
        }
        else if ((symRes = this.match(":")).matched) {
            result.merge(symRes);
        }
        else {
            result.mergeState(ResultState.successful);
        }
    }

    // MatchArgument: failed | skippable | successful

    matchArgument(): Result<Node> {
        // 无需 analyse 复制一份
        return this.prepareMatch(this.argumentType, "argument", this.myMatchArgument, this);

        // let result = new Result<Node>(new Node(this.argumentType));
        // let preIndex = this.index;
        // this.begin("argument");
        // this.myMatchArgument(result);
        // this.end();
        // result.content.begin = preIndex;
        // result.content.end = this.index;
        // if (result.failed) {
        //     this.index = preIndex;
        // }
        // return result;
    }

    private myMatchArgument(result: Result<Node>) {
        let node = result.content;

        let symRes: Result<null>;
        let nodeRes: Result<Node>;
        let nameRes: Result<Node>;

        if ((symRes = this.match("@")).matched) {
            result.merge(symRes);
            this.mergeHighlight(result, HighlightType.operator, -1, 0);
            let refNode = new Node(this.referenceType, "");
            node.children.push(refNode);

            result.merge(this.skipBlank());

            let nameRes = this.matchName();
            result.merge(nameRes);
            if (result.shouldTerminate) {
                this.mergeMessage(result, "Missing reference name.");
                result.promoteToSkippable();
                return;
            }
            refNode.content = nameRes.content.content;
            this.mergeHighlight(result, HighlightType.keyword, nameRes.content);
        }

        else if ((nameRes = this.matchName()).matched) {
            result.merge(nameRes);
            this.mergeHighlight(result, HighlightType.keyword, nameRes.content);

            // This is an 'is' function
            let preIndex = this.index;
            this.skipBlank();
            let hasValue = this.is(":");
            this.index = preIndex;

            if (hasValue) {
                node.content = nameRes.content.content;

                result.merge(this.skipBlank());

                result.merge(this.match(":"));
                this.mergeHighlight(result, HighlightType.operator, -1, 0);

                result.merge(this.skipBlank());

                if ((nodeRes = this.matchNumber()).matched) {
                    result.merge(nodeRes);
                    this.mergeHighlight(result, HighlightType.number, nodeRes.content);
                    node.children.push(nodeRes.content);

                }
                else if ((nodeRes = this.matchString()).matched) {
                    result.merge(nodeRes);
                    this.mergeHighlight(result, HighlightType.string, nodeRes.content);
                    node.children.push(nodeRes.content);

                }
                else if ((nodeRes = this.matchName()).matched) {
                    result.merge(nodeRes);
                    this.mergeHighlight(result, HighlightType.keyword, nodeRes.content);
                    node.children.push(nodeRes.content);
                }
                else {
                    result.mergeState(ResultState.skippable);
                    this.mergeMessage(result, "Missing argument value.", MessageType.warning);
                    node.children.push(new Node(this.nameType));
                }

            }
            else {
                node.children.push(nameRes.content);
            }
        }

    }

    // Assistant: GetBlockName: failing | successful

    private getBlockName(): Result<string> {
        let result = new Result<string>("", "");
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
        return this.prepareMatch(this.blockType, "basic-block", result => {
            if (this.isBasicBlock()) {
                this.myMatchBlock(result);
            }
            else {
                this.mergeMessage(result, "Not basic block.");
            }
        }, this);

        // let result = new Result<Node>(new Node(this.blockType), new Node(this.blockType));

        // let preIndex = this.index;
        // this.begin("basic-block");
        // if (this.isBasicBlock()) {
        //     this.myMatchBlock(result);
        // }
        // else {
        //     this.mergeMessage(result, "Not basic block."));
        // }
        // this.end();
        // result.content.begin = preIndex;
        // result.content.end = this.index;
        // if (result.failed) {
        //     this.index = preIndex;
        // }
        // return result;
    }

    matchFormatBlock(): Result<Node> {
        return this.prepareMatch(this.blockType, "format-block", result => {
            if (this.isFormatBlock()) {
                this.myMatchBlock(result);
            }
            else {
                this.mergeMessage(result, "Not format block.");
            }
        }, this);

        // let result = new Result<Node>(new Node(this.blockType));
        // result.analysedContent = new Node(this.blockType);

        // let preIndex = this.index;
        // this.begin("format-block");
        // if (this.isFormatBlock()) {
        //     this.myMatchBlock(result);
        // }
        // else {
        //     this.mergeMessage(result, "Not format block."));
        // }
        // this.end();
        // result.content.begin = preIndex;
        // result.content.end = this.index;
        // if (result.failed) {
        //     this.index = preIndex;
        // }
        // return result;
    }

    matchOtherBlock(): Result<Node> {
        return this.prepareMatch(this.blockType, "other-block", result => {
            if (this.isOtherBlock()) {
                this.myMatchBlock(result);
            }
            else {
                this.mergeMessage(result, "Not other block.");
            }
        }, this);

        // let result = new Result<Node>(new Node(this.blockType));
        // result.analysedContent = new Node(this.blockType);

        // let preIndex = this.index;
        // this.begin("other-block");
        // if (this.isOtherBlock()) {
        //     this.myMatchBlock(result);
        // }
        // else {
        //     this.mergeMessage(result, "Not other block."));
        // }
        // this.end();
        // result.content.begin = preIndex;
        // result.content.end = this.index;
        // if (result.failed) {
        //     this.index = preIndex;
        // }
        // return result;
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

    skipToAfter(char: string): boolean {
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

    prepareMatchForFoundation(type: Type, name: string, myMatch: (result: Result<Node>) => void, thisArg?: unknown) {
        let result = new Result<Node>(new Node(type), new Node(type));
        let preIndex = this.index;
        this.begin(name);
        myMatch.bind(thisArg)(result);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        result.analysedContent.content = result.content.content;
        result.analysedContent.begin = preIndex;
        result.analysedContent.end = this.index;
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    // MatchName: failing | successful

    matchName(): Result<Node> {
        return this.prepareMatchForFoundation(this.nameType, "name", this.myMatchName, this);
        // let result = new Result<Node>(new Node(this.nameType), new Node(this.nameType));
        // result.content.begin = this.index;
        // this.begin("name");
        // this.myMatchName(result);
        // this.end();
        // result.content.end = this.index;
        // result.analysedContent = result.content;
        // return result;
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

    // MatchString: failing | skippable | successful

    matchString(): Result<Node> {
        return this.prepareMatchForFoundation(this.stringType, "string", this.myMatchString, this);

        // let result = new Result<Node>(new Node(this.stringType), new Node(this.stringType));
        // result.content.begin = this.index;
        // this.begin("string");
        // this.myMatchString(result);
        // this.end();
        // result.content.end = this.index;
        // return result;
    }

    private myMatchString(result: Result<Node>) {
        let symRes: Result<null>;

        if ((symRes = this.match('`')).matched) {
            result.merge(symRes);
            while (true) {
                if ((symRes = this.match('`')).matched) {
                    result.merge(symRes);
                    break;
                }
                else if (this.is(Parser.newline)) {
                    result.mergeState(ResultState.skippable);
                    this.mergeMessage(result, "String should not have new line.");
                    break;
                }
                if (this.isEOF()) {
                    result.mergeState(ResultState.skippable);
                    this.mergeMessage(result, "String abruptly end.");
                    break;
                }
                else {
                    result.content.content += this.curChar();
                    this.move();
                }
            }
        }
        else if ((symRes = this.match("'")).matched) {
            result.merge(symRes);
            while (true) {
                if ((symRes = this.match("'")).matched) {
                    result.merge(symRes);
                    break;
                }
                else if (this.is(Parser.newline)) {
                    result.mergeState(ResultState.skippable);
                    this.mergeMessage(result, "String should not have new line.");
                    break;
                }
                if (this.isEOF()) {
                    result.mergeState(ResultState.skippable);
                    this.mergeMessage(result, "String abruptly end.");
                    break;
                }
                else {
                    result.content.content += this.curChar();
                    this.move();
                }
            }
        }
        else if ((symRes = this.match('"')).matched) {
            result.merge(symRes);
            while (true) {
                if ((symRes = this.match('"')).matched) {
                    result.merge(symRes);
                    break;
                }
                else if (this.is(Parser.newline)) {
                    result.mergeState(ResultState.skippable);
                    this.mergeMessage(result, "String should not have new line.");
                    break;
                }
                if (this.isEOF()) {
                    result.mergeState(ResultState.skippable);
                    this.mergeMessage(result, "String abruptly end.");
                    break;
                }
                else {
                    result.content.content += this.curChar();
                    this.move();
                }
            }
        }
    }

    // MatchNumber: failing | skippable | successful

    matchNumber(): Result<Node> {
        return this.prepareMatchForFoundation(this.numberType, "number", this.myMatchNumber, this);

        // let result = new Result<Node>(new Node(this.numberType));
        // result.content.begin = this.index;
        // this.begin("number");
        // this.myMatchNumber(result);
        // this.end();
        // result.content.end = this.index;
        // return result;
    }

    private myMatchNumber(result: Result<Node>) {
        let msg = result.messages;
        let node = result.content;

        let symRes: Result<null>;

        if ((symRes = this.match('+')).matched) {
            result.merge(symRes);
            node.content += '';
        }
        else if ((symRes = this.match('-')).matched) {
            result.merge(symRes);
            node.content += '-';
        }
        else {
            node.content += '';
        }

        if (!this.is(Parser.number)) {
            result.mergeState(ResultState.failing);
            return;
        }
        node.content += this.curChar();
        this.move();
        result.mergeState(ResultState.successful);

        result.GuaranteeMatched();

        while (true) {
            if (this.is(Parser.number)) {
                node.content += this.curChar();
                this.move();
                result.mergeState(ResultState.successful);
            }
            else {
                break;
            }
        }

        if ((symRes = this.match(".")).matched) {
            result.merge(symRes);
            node.content += ".";

            while (true) {
                if (this.is(Parser.number)) {
                    node.content += this.curChar();
                    this.move();
                    result.mergeState(ResultState.successful);
                }
                else {
                    break;
                }
            }
        }
    }

    // MatchSinglelineBlank: failing | skippable | successful

    matchSinglelineBlank(): Result<null> {
        let result = new Result<null>(null, null);
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
        let result = new Result<number>(0, 0);
        let preIndex = this.index;
        this.begin("multiline-blank");
        this.myMatchMultilineBlank(result);
        this.end();
        result.analysedContent = result.content;
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
        let result = new Result<null>(null, null);
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
        let result = new Result<null>(null, null);
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
        let result = new Result<null>(null, null);
        let preIndex = this.index;
        this.begin("singleline-comment");
        this.myMatchSinglelineComment(result);
        this.end();
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchSinglelineComment(result: Result<null>) {
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
        let result = new Result<null>(null, null);
        let preIndex = this.index;
        this.begin("multiline-comment");
        this.myMatchMultilineComment(result);
        this.end();
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchMultilineComment(result: Result<null>) {
        result.merge(this.match("/*"));
        if (result.shouldTerminate) {
            return;
        }

        let tmpRes: Result<null>;
        while (true) {
            if (this.isEOF()) {
                result.mergeState(ResultState.skippable);
                this.mergeMessage(result, "Multiline comment ended abruptly.", MessageType.warning);
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
        let result = new Result<null>(null, null);
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
        let result = new Result<number>(0, 0);
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
        let result = new Result<null>(null, null);
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
    static number = /[0-9]/;
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

    // prepare for matching

    prepareMatch(type: Type, name: string, myMatch: (result: Result<Node>) => void, thisArg?: unknown, myAnalyse?: (result: Result<Node>) => void, secondThisArg?: unknown) {
        let result = new Result<Node>(new Node(type), new Node(type));
        let preIndex = this.index;
        this.begin(name);
        myMatch.bind(thisArg)(result);
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;

        if (myAnalyse) {
            this.begin('analyse-' + name);
            myAnalyse.bind(secondThisArg ?? thisArg)(result);
            this.end();
        }
        result.analysedContent.begin = preIndex;
        result.analysedContent.end = this.index;

        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    // message

    getMessage(message: string, type: MessageType = MessageType.error, code: number = -1): Message {
        //let lp = this.getLineAndCharacter() ?? { line: -1, character: -1 };
        //let pro = this.process.slice();
        return new Message(message, type, code, this.index, this.index + 1, []);
    }

    mergeMessage<T>(result: Result<T>, message: string, type: MessageType = MessageType.error, code: number = -1) {
        result.messages.push(this.getMessage(message, type, code));
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

    mergeHighlight<T>(result: Result<T>, type: HighlightType, node: Node): void
    mergeHighlight<T>(result: Result<T>, type: HighlightType, relativeBegin: number, relativeEnd: number): void
    mergeHighlight<T>(result: Result<T>, type: HighlightType, relativeBeginOrNode: number | Node, relativeEnd?: number): void {
        if (typeof (relativeBeginOrNode) === "number") {
            result.highlights.push(this.getHighlight(type, relativeBeginOrNode, relativeEnd!));
        }
        else {
            result.highlights.push(this.getHighlight(type, relativeBeginOrNode));
        }

    }

    // node

    mergeNodeToChildren(result: Result<Node>, intermediateResult: Result<Node>) {
        result.content.children.push(intermediateResult.content);
        if (!intermediateResult.discarded) {
            result.analysedContent.children.push(intermediateResult.analysedContent);
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