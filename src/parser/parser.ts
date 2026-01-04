/**
* Parser: analyise the document, generate the syntax tree
*/

import { Type } from "../syntax-tree/type";
import { Node } from "../syntax-tree/node";
import { TypeTable } from "../syntax-tree/type-table";
import { BlockTable, BlockType, BlockHandler, ArgumentType } from "./block-table";
import { Math } from "./math/math";
import { Module } from "./module";
import { Highlight, HighlightType, Reference, NodeResult, ResultState, BasicResult, Result } from "./result";
import { Message, MessageType } from "./message";
import { Core } from "./core/core";
import { Article } from "./article/article";
import { Config } from "../compiler/config";
import { InsertionHandler, InsertionTable } from "./insertion-table";
import { LixError } from "../foundation/error";
import { FileSystem, FileSystemRecord } from "../compiler/file-system";
import { parserExceptionTexts } from "./texts";
import { Compiler } from "../compiler/compiler";
import { ParserTexts } from "./texts";

export type MatchResult = NodeResult;

export class Parser {

    // **************** Environment ****************

    // Compiler
    compiler: Compiler;
    private typeTable: TypeTable;
    private config: Config;
    private fileSystem: FileSystem;
    private texts: ParserTexts;

    // Types in type table

    documentType: Type;

    settingType: Type;
    settingParameterType: Type;

    paragraphType: Type;
    textType: Type;
    wordsType: Type;
    insertionType: Type;
    escapeCharType: Type;

    blockType: Type;
    argumentsType: Type;
    argumentType: Type;
    nameType: Type;
    stringType: Type;
    numberType: Type;
    referenceType: Type;

    errorType: Type;


    // Block & insertion table
    blockTable: BlockTable;
    insertionTable: InsertionTable;

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

    // State
    state: ResultState;

    // Environment
    messages: Message[];
    highlights: Highlight[];
    references: Reference[];
    fileRecords: FileSystemRecord[];


    constructor(compiler: Compiler) {

        this.compiler = compiler;
        this.typeTable = compiler.typeTable;
        this.config = compiler.config;
        this.fileSystem = compiler.fileSystem;
        this.texts = compiler.texts.Parser;

        // **************** Types ****************

        this.documentType = this.typeTable.add("document");
        this.paragraphType = this.typeTable.add("paragraph");
        this.textType = this.typeTable.add("text");
        this.insertionType = this.typeTable.add("insertion");
        this.wordsType = this.typeTable.add("words");
        this.nameType = this.typeTable.add("name");
        this.stringType = this.typeTable.add("string");
        this.numberType = this.typeTable.add("number");
        this.escapeCharType = this.typeTable.add("escape-char");
        this.referenceType = this.typeTable.add("reference");
        this.settingType = this.typeTable.add("setting");
        this.settingParameterType = this.typeTable.add("setting-parameter");
        this.blockType = this.typeTable.add("block");
        this.errorType = this.typeTable.add("error");
        this.argumentsType = this.typeTable.add("arguments");
        this.argumentType = this.typeTable.add("argument");

        // **************** Blocks ****************

        this.blockTable = new BlockTable();

        // blocks
        this.blockTable.add("paragraph", this.paragraphBlockHandler, this, {
            type: BlockType.structural,
            argumentOptions: new Map([
                ["start", { type: ArgumentType.enumeration, options: ["titled", "default"], default: "default" }]
            ]),
            allowReference: false
        });

        // basic blocks (formula is added in math module)
        this.blockTable.add("text", this.textBlockHandler, this, {
            type: BlockType.basic,
            argumentOptions: new Map([
                ["start", { type: ArgumentType.enumeration, options: ["indent", "noindent", "auto"], default: "auto" }]
            ]),
            allowReference: false
        });

        // **************** Insertions ****************

        this.insertionTable = new InsertionTable();

        // inline formula is added in math moudle
        this.insertionTable.add("@", this.matchReference, this);
        //this.insertionHandlerTable.add("&", () => {let r = new Result<Node>(new Node(this.referenceType)); r.state = ResultState.matched ; r.highlights.push(this.getHighlight(HighlightType.operator, 0, 1)); return r });

        // **************** Modules ****************

        this.mathModule = new Math(this);
        this.coreModule = new Core(this);
        this.modules = [this.mathModule, this.coreModule, new Article(this)];

        // **************** Init ****************

        this.text = "";
        this.index = 0;
        this.lineRanges = [0, 1];
        this.process = [];

        this.syntaxTree = new Node(this.documentType);
        this.analysedTree = new Node(this.documentType);
        this.messages = [];
        this.highlights = [];
        this.references = [];
        this.fileRecords = [];
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
        this.messages = [];
        this.highlights = [];
        this.references = [];
        this.fileRecords = [];
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
        this.syntaxTree = result.node;
        this.analysedTree = result.analysedNode;
        this.state = result.state;
        this.messages = result.messages;
        this.highlights = result.highlights;
        this.references = result.references;
        this.fileRecords = result.fileRecords;
    }

    // **************** Matching, Analysing & Skipping ****************

    // 如果在 match 过程中已经分析 (配合 mergeNodeToChildren), 则 analyse 置空; 如果 match 没有处理, 用 defaultAnalyse; 如果需要自定义, 请自行指定 analyse.
    prepareMatch(type: Type, name: string, myMatch: (result: NodeResult) => void, thisArg?: unknown, myAnalyse?: (result: NodeResult) => void, secondThisArg?: unknown) {
        let result = new NodeResult(new Node(type), new Node(type));
        let preIndex = this.index;
        this.begin(name);
        myMatch.bind(thisArg)(result);
        this.end();
        result.node.begin = preIndex;
        result.node.end = this.index;

        if (myAnalyse) {
            this.begin('analyse-' + name);
            myAnalyse.bind(secondThisArg ?? thisArg)(result);
            this.end();
        }
        result.analysedNode.begin = preIndex;
        result.analysedNode.end = this.index;

        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    defaultAnalysis(result: NodeResult) {
        result.node.copyTo(result.analysedNode);
        result.discarded = false;
    }

    skipByBrackets(bracketsCount: number = 0, multiline: boolean = false): number {
        let preIndex = this.index;
        while (true) {
            if (this.isEOF()) {
                return this.index - preIndex;
            }
            else if (this.is("[")) {
                bracketsCount++;
                this.move();
            }
            else if (this.is("]")) {
                bracketsCount--;
                this.move();
                if (bracketsCount <= 0) {
                    return this.index - preIndex;
                }
            }
            else if (!multiline && this.isMultilineBlankGtOne()) {
                return this.index - preIndex;
            }
            else {
                this.move();
            }
        }
    }

    skipToEndOfLine() {
        while (true) {
            if (this.isEOF()) {
                return;
            }
            else if (this.is(Parser.newline)) {
                return;
            }

            else {
                this.move();
            }

        }
    }

    skipToAfter(char: string, singleline: boolean = true) {
        while (true) {
            if (this.isEOF()) {
                return;
            }
            else if (singleline && this.is(Parser.newline)) {
                return;
            }
            else if (this.is(char)) {
                this.move();
                return;
            }

            else {
                this.move();
            }
        }
    }

    // ************ Core Grammers *************

    // MatchDocument: failing | skippable | successful

    private matchDocument(): NodeResult {
        return this.prepareMatch(this.documentType, "document", this.myMatchDocument, this);
    }

    private myMatchDocument(result: NodeResult) {
        let nodeRes: NodeResult;

        while (true) {
            if (this.isEOF()) {
                result.mergeState(ResultState.successful);
                break;
            }

            else if (this.isNonSomeBlock(BlockType.structural, BlockType.basic, BlockType.format)) {
                result.mergeState(ResultState.skippable);
                let length = this.skipByBrackets();
                result.addMessage(this.texts.DocumentRequiresStructuralBlocks, MessageType.error, this.index, -length, 0);
            }

            else if ((nodeRes = this.matchSetting()).matched) {
                result.merge(nodeRes);
                if (result.shouldTerminate) {
                    return;
                }
                result.mergeNodeToChildren(nodeRes);
            }

            else if ((nodeRes = this.matchFreeParagraph()).matched) {
                result.merge(nodeRes);
                if (result.shouldTerminate) {
                    return;
                }
                result.mergeNodeToChildren(nodeRes);
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                result.merge(nodeRes);
                if (result.shouldTerminate) {
                    return;
                }
                result.mergeNodeToChildren(nodeRes);
            }

            else {
                // 理论上不会出现
                throw new LixError(parserExceptionTexts.LogicalMatchDocumentFailed);
            }
        }
    }

    // **************** Setting ****************

    isSetting(): boolean {
        return this.is("#");
    }

    // MatchSetting: failing | skippable | successful
    // 必须或运算中用

    matchSetting(): NodeResult {
        return this.prepareMatch(this.settingType, "setting", this.myMatchSetting, this, this.defaultAnalysis);
    }

    private myMatchSetting(result: NodeResult) {
        let hashIndex = this.index;
        result.merge(this.match("#"));
        if (result.shouldTerminate) {
            return;
        }
        result.GuaranteeMatched();
        result.addHighlight(HighlightType.operator, hashIndex, 0, 1);

        result.merge(this.skipBlank());

        let nameIndex = this.index;
        let nameRes = this.matchName();
        result.merge(nameRes);
        if (result.shouldTerminate) {
            result.addMessage(this.texts.SettingNameMissing, MessageType.error, hashIndex, 0, 1);

            result.promoteToSkippable();
            this.skipToEndOfLine();
            result.addNode(this.settingParameterType, "", [], nameIndex, 0, 0);
            return;
        }
        result.addHighlight(HighlightType.keyword, nameIndex, 0, nameRes.value.length);
        result.node.content = nameRes.value;

        result.merge(this.skipBlank());

        let colonIndex = this.index;
        result.merge(this.match(":"));
        if (result.shouldTerminate) {
            result.addMessage(this.texts.SettingColonMissing, MessageType.error, nameIndex, 0, nameRes.value.length);

            result.promoteToSkippable();
            this.skipToEndOfLine();
            result.addNode(this.settingParameterType, "", [], colonIndex, 0, 0);
            return;
        }
        result.addHighlight(HighlightType.operator, colonIndex, 0, 1);

        let commandIndex = this.index;
        let command = "";
        while (true) {
            if (this.isEOF()) {
                break;
            }
            else if (this.is(Parser.newline)) {
                break;
            }

            else {
                let valRes = this.matchChar();
                result.merge(valRes);
                command += valRes.value;
            }

        }
        result.addNode(this.settingParameterType, command, [], commandIndex, 0, command.length);
    }

    // **************** Text & Paragraph ****************

    // MatchFreeParagraph: failing | skippable | successful

    matchFreeParagraph(): NodeResult {
        return this.prepareMatch(this.paragraphType, "free-paragraph", this.myMatchFreeParagraph, this, this.cleanupParagraph);
    }

    private myMatchFreeParagraph(result: NodeResult) {
        let nodeRes: NodeResult;
        let res: BasicResult;

        // result.content.children.push(new Node(this.argumentsType));
        // result.analysedContent.children.push(new Node(this.argumentsType));

        while (true) {
            if (this.isEOF()) {
                break;
            }
            else if ((res = this.matchMultilineBlankGtOne()).matched) {
                result.merge(res);
                result.GuaranteeMatched();
                break;
            }
            else if (this.isNonSomeBlock(BlockType.basic, BlockType.format)) {
                break;
            }
            else if (this.isSetting()) {
                break;
            }

            else if ((nodeRes = this.matchFreeText()).matched) {
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 basic block, format block 在 free text 中处理了
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // match block 不会失败
                result.mergeNodeToChildren(nodeRes);
            }
            else {
                throw new LixError(parserExceptionTexts.LogicalFreeParagraphBranch);
            }
        }
    }

    cleanupParagraph(result: NodeResult) {
        result.discarded = (result.analysedNode.children.length === 0);
    }

    cleanupText(result: NodeResult) {
        let analNode = result.analysedNode;

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

    matchFreeText(): NodeResult {
        return this.prepareMatch(this.textType, "free-text", this.myMatchFreeText, this, this.cleanupText);
    }

    private myMatchFreeText(result: NodeResult) {
        let node = result.node;
        let analysedNode = result.analysedNode;

        // node.children.push(new Node(this.argumentsType));
        // analysedNode.children.push(new Node(this.argumentsType));

        let text = "";
        let res: BasicResult;
        let valRes: Result<string>;
        let nodeRes: NodeResult;

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

            else if (this.isMultilineBlankGtOne()) {
                mergeWordsNode();
                break;
            }
            else if ((res = this.match("\\\\")).matched) {
                mergeWordsNode();
                result.merge(res);
                result.GuaranteeMatched();
                result.addHighlight(HighlightType.operator, this.index, -2, 0);
                break;
            }
            else if (this.isNonSomeBlock(BlockType.format)) {
                mergeWordsNode();
                break;
            }
            else if (this.isSetting()) {
                mergeWordsNode();
                break;
            }


            else if ((res = this.matchMultilineBlankLeqOne()).matched) {
                resetIndex();
                result.merge(res);
                result.GuaranteeMatched();
                text += " ";
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                text += nodeRes.node.content;
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 format block
                mergeWordsNode();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // match block 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else {
                resetIndex();
                result.GuaranteeMatched();
                valRes = this.matchChar();
                result.merge(valRes);
                // 不会失败
                text += valRes.value;
            }
        }
    }

    // ParagraphBlockHandler: failing | skippable | successful

    paragraphBlockHandler(args: Node): NodeResult {
        return this.prepareMatch(this.paragraphType, "paragraph-block-handler", this.myParagraphBlockHandler.bind(this, args, "paragraph"), this, this.cleanupParagraph);
    }

    paragraphLikeBlockHandler(blockName: string, type: Type, args: Node): NodeResult {
        let result = this.prepareMatch(this.paragraphType, `${blockName}-block-handler`, this.myParagraphBlockHandler.bind(this, args, blockName), this, this.cleanupParagraph);
        result.node.type = type;
        result.analysedNode.type = type;
        return result;
    }

    private myParagraphBlockHandler(args: Node, blockName: string, result: NodeResult) {

        let nodeRes: NodeResult;
        let preIndex: number;

        result.mergeState(ResultState.successful);

        while (true) {
            preIndex = this.index;

            if (this.isEOF()) {
                break;
            }
            if (this.isMultilineBlankGtOne()) {
                break;
            }
            else if (this.is("]")) {
                break;
            }
            else if (this.isNonSomeBlock(BlockType.basic, BlockType.format)) {
                result.mergeState(ResultState.skippable);
                let length = this.skipByBrackets();
                result.addMessage(this.texts.ParagraphDisallowsOtherBlocks, MessageType.error, preIndex, 0, length);
                continue;
            }

            else if ((nodeRes = this.matchParFreeText()).matched) {
                result.merge(nodeRes);
                // 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 basic block, format block 在 par free text 中处理了
                result.merge(nodeRes);
                // match block 不会失败
                result.mergeNodeToChildren(nodeRes);
            }
            else {
                throw new LixError(parserExceptionTexts.LogicalParagraphBlockBranch);
            }
        }
    }

    // MatchParFreeText: failing | skippable | successful

    matchParFreeText(): NodeResult {
        return this.prepareMatch(this.textType, "par-free-text", this.myMatchParFreeText, this, this.cleanupText);
    }

    private myMatchParFreeText(result: NodeResult) {
        let node = result.node;
        let analysedNode = result.analysedNode;

        // node.children.push(new Node(this.argumentsType));
        // analysedNode.children.push(new Node(this.argumentsType));

        let text = "";
        let symRes: BasicResult;
        let blkRes: Result<number>;
        let valRes: Result<string>;
        let nodeRes: NodeResult;

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
            else if (this.isMultilineBlankGtOne()) {
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
                result.addHighlight(HighlightType.operator, this.index, -2, 0);
                break;
            }
            else if (this.isNonSomeBlock(BlockType.format)) {
                mergeWordsNode();
                break;
            }

            else if ((blkRes = this.matchMultilineBlank()).matched) {
                resetIndex();
                result.merge(blkRes);
                result.GuaranteeMatched();
                text += " ";
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                text += nodeRes.node.content;
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 format block
                mergeWordsNode();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // match block 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else {
                resetIndex();
                result.GuaranteeMatched();
                valRes = this.matchChar();
                result.merge(valRes);
                // 不会失败
                text += valRes.value;
            }
        }
    }

    // TextBlockHandler: failing | skippable | successful

    textBlockHandler(args: Node): NodeResult {
        return this.prepareMatch(this.textType, "text-block-handler", this.myTextBlockHandler.bind(this, args), this, this.cleanupText);
    }

    textLikeBlockHandler(blockName: string, type: Type, args: Node): NodeResult {
        let result = this.prepareMatch(this.textType, `${blockName}-block-handler`, this.myTextBlockHandler.bind(this, args), this, this.cleanupText);
        result.node.type = type;
        result.analysedNode.type = type;
        return result;
    }

    private myTextBlockHandler(args: Node, result: NodeResult) {
        let node = result.node;
        let analysedNode = result.analysedNode;

        let text = "";
        let symRes: BasicResult;
        let blkRes: Result<number>;
        let valRes: Result<string>;
        let nodeRes: NodeResult;

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

        result.mergeState(ResultState.successful);

        while (true) {
            curIndex = this.index;

            if (this.isEOF()) {
                mergeWordsNode();
                break;
            }
            else if (this.isMultilineBlankGtOne()) {
                mergeWordsNode();
                break;
            }
            else if (this.is("]")) {
                mergeWordsNode();
                break;
            }
            else if ((symRes = this.match("\\\\")).matched) {
                resetIndex();
                result.addMessage(this.texts.TextDisallowsLineBreakEscape, MessageType.warning, curIndex, 0, 2);
                text += "\\\\";
                // result.mergeState(ResultState.skippable);
            }
            else if (this.isNonSomeBlock(BlockType.format)) {
                mergeWordsNode();
                result.mergeState(ResultState.skippable);
                let length = this.skipByBrackets();
                result.addMessage(this.texts.TextDisallowsNonFormatBlocks, MessageType.error, curIndex, 0, length);
            }

            else if ((blkRes = this.matchMultilineBlank()).matched) {
                resetIndex();
                result.merge(blkRes);
                text += " ";
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes);
                text += nodeRes.node.content;
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes);
                // 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 format block 前边判断过
                mergeWordsNode();
                result.merge(nodeRes);
                // match block 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else {
                resetIndex();
                valRes = this.matchChar();
                result.merge(valRes);
                // 不会失败
                text += valRes.value;
            }
        }
    }

    // FormatLikeBlockHandler: failing | skippable | successful

    formatLikeBlockHandler(blockName: string, type: Type, args: Node): NodeResult {
        let result = this.prepareMatch(this.textType, `${blockName}-block-handler`, this.myFormatLikeBlockHandler.bind(this, blockName, args), this, this.cleanupText);
        result.node.type = type;
        result.analysedNode.type = type;
        return result;
    }

    private myFormatLikeBlockHandler(blockName: string, args: Node, result: NodeResult) {
        let node = result.node;
        let analysedNode = result.analysedNode;


        let text = "";
        let symRes: BasicResult;
        let blkRes: Result<number>;
        let valRes: Result<string>;
        let nodeRes: NodeResult;

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

        result.mergeState(ResultState.successful);

        while (true) {
            curIndex = this.index;

            if (this.isEOF()) {
                mergeWordsNode();
                break;
            }
            else if (this.isMultilineBlankGtOne()) {
                mergeWordsNode();
                break;
            }

            else if (this.is("]")) {
                mergeWordsNode();
                break;
            }
            else if ((symRes = this.match("\\\\")).matched) {
                resetIndex();
                result.addMessage(this.texts.FormatDisallowsLineBreakEscape, MessageType.warning, curIndex, 0, 2);
                text += "\\\\";
                // result.mergeState(ResultState.skippable);
            }
            else if (this.isNonSomeBlock()) {
                mergeWordsNode();
                result.mergeState(ResultState.skippable);
                let length = this.skipByBrackets();
                result.addMessage(this.texts.FormatDisallowsNestedBlocks, MessageType.error, curIndex, 0, length);
            }

            else if ((blkRes = this.matchMultilineBlank()).matched) {
                resetIndex();
                result.merge(blkRes);
                text += " ";
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes);
                text += nodeRes.node.content;
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes);
                // 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else {
                resetIndex();
                valRes = this.matchChar();
                result.merge(valRes);
                // 不会失败
                text += valRes.value;
            }
        }
    }

    // MatchEscapeChar: failing | successful

    matchEscapeChar(): NodeResult {
        return this.prepareMatch(this.escapeCharType, "escape-char", this.myMatchEscapeChar, this, this.defaultAnalysis);
    }

    private myMatchEscapeChar(result: NodeResult) {
        let node = result.node;

        let beginIndex = this.index;
        result.merge(this.match("\\"));
        if (result.shouldTerminate) {
            return;
        }
        result.GuaranteeMatched();

        let valRes = this.matchChar();
        result.merge(valRes);
        if (result.shouldTerminate) { // EOF
            node.content = "\\";
            result.promoteToSkippable();
            result.addMessage(this.texts.EscapeSequenceIncomplete, MessageType.warning, beginIndex, 0, 1);
            return;
        }
        switch (valRes.value) {
            case "(": case ")":
            case "[": case "]": case "/": case "#": case "@":
                node.content += valRes.value;
                result.addHighlight(HighlightType.operator, beginIndex, 0, 2);
                break;
            default:
                node.content += "\\";
                node.content += valRes.value;
                result.addMessage(this.texts.InvalidEscapeSequence.format(valRes.value), MessageType.warning, beginIndex, 0, 2);
                break;
        }

    }

    // MatchReference: failing | skippable | successful

    matchReference(): NodeResult {
        return this.prepareMatch(this.referenceType, "reference", this.myMatchReference, this, this.defaultAnalysis);
    }

    private myMatchReference(result: NodeResult) {
        let node = result.node;

        let beginIndex = this.index;
        result.merge(this.match("@"));
        if (result.shouldTerminate) {
            return;
        }
        result.GuaranteeMatched();
        result.addHighlight(HighlightType.operator, beginIndex, 0, 1);

        result.merge(this.skipBlank());

        let nameIndex = this.index;
        let nameRes = this.matchName();
        result.merge(nameRes);
        if (result.shouldTerminate) {
            result.addMessage(this.texts.ReferenceNameMissing, MessageType.error, beginIndex, 0, 1);
            result.promoteToSkippable();
            return;
        }
        node.content = nameRes.value;
        result.addHighlight(HighlightType.keyword, nameIndex, 0, nameRes.value.length);

        if (this.is(";")) {
            let endIndex = this.index;
            result.merge(this.match(";"));
            result.addHighlight(HighlightType.operator, endIndex, 0, 1);
        }
        else {
            result.merge(this.skipBlank());
        }
    }

    // MatchInsertion: failing | skippable | successful

    // isInsertion(): boolean {
    //     if (this.isEOF()) {
    //         return false;
    //     }
    //     if (this.insertionHandlerTable.has(this.curChar())) {
    //         return true;
    //     }
    //     return false;
    // }

    matchInsertion(): NodeResult {
        // analyse 在 parse 中一起处理了
        return this.prepareMatch(this.insertionType, "insertion", this.myMatchInsertion, this);
    }

    myMatchInsertion(result: NodeResult) {
        let node = result.node;
        let analysedNode = result.analysedNode;

        let handler: InsertionHandler | undefined = undefined;
        let length = 0;
        for (let insertion of this.insertionTable.insertionHandlers) {
            if (insertion[0].length > length && this.is(insertion[0])) {
                handler = insertion[1];
                length = insertion[0].length;
                node.content = insertion[0];
            }
        }
        if (handler === undefined) {
            return;
        }
        result.GuaranteeMatched();

        let hdlRes = handler();
        result.merge(hdlRes);
        if (result.shouldTerminate) {
            result.promoteToSkippable();
            this.move(length);
            return;
        }

        node.children.push(hdlRes.node);
        // 此处相当于令 analyseNode = hdlRes.analysedContent 浅拷贝
        hdlRes.analysedNode.moveTo(analysedNode);
    }

    // **************** Block ****************

    // MatchBlock: failing | skippable | successful
    // 必须或运算中用

    matchBlock(): NodeResult {
        // analyse 在 parse 中一起处理了
        return this.prepareMatch(this.blockType, "block", this.myMatchBlock, this);
    }

    private myMatchBlock(result: NodeResult) {
        let node = result.node;
        let analysedNode = result.analysedNode;

        let beginIndex = this.index;
        result.merge(this.match("["));
        if (result.shouldTerminate) {
            return;
        }

        result.merge(this.skipBlank());

        let nameIndex = this.index;
        let nameRes = this.matchName();
        result.merge(nameRes);
        if (result.shouldTerminate) {
            return;
        }
        node.content = nameRes.value;

        let handler: BlockHandler | undefined;
        handler = this.blockTable.getHandler(nameRes.value);
        if (handler === undefined) {
            result.mergeState(ResultState.failing);
            return;
        }
        result.GuaranteeMatched();
        result.addHighlight(HighlightType.operator, beginIndex, 0, 1);
        result.addHighlight(HighlightType.keyword, nameIndex, 0, nameRes.value.length);

        let argRes = this.matchArguments(nameRes.value);
        result.merge(argRes);
        // matchArguments will not be failing
        result.mergeNodeToChildren(argRes);
        result.references.forEach(value => {
            value.node = result.analysedNode;
        });

        let hdlRes = handler!(argRes.analysedNode);
        result.merge(hdlRes);
        if (result.shouldTerminate) {
            result.promoteToSkippable();
            this.skipByBrackets(1);
            return;
        }
        node.children.push(hdlRes.node);
        // 此处相当于令 analyseNode = hdlRes.analysedContent 浅拷贝
        hdlRes.analysedNode.moveTo(analysedNode);
        result.discarded = hdlRes.discarded;

        let endIndex = this.index;
        result.merge(this.match("]"));
        if (result.shouldTerminate) {
            result.addMessage(this.texts.BlockClosingBracketMissing, MessageType.error, beginIndex, 0, endIndex - beginIndex);
            result.promoteToSkippable();
            return;
        }
        result.addHighlight(HighlightType.operator, endIndex, 0, 1);
    }

    // MatchArguments: skippable | successful

    checkAndStandardizeArguments(blockName: string, result: NodeResult) {
        let stdArguments = result.analysedNode;
        let argumentsSpec = this.blockTable.getOption(blockName)!;

        const argumentTypeToType: Map<ArgumentType, Type> = new Map([[ArgumentType.string, this.stringType], [ArgumentType.number, this.numberType], [ArgumentType.enumeration, this.nameType]]);

        for (let [name, spec] of argumentsSpec.argumentOptions) {
            let stdArgument = new Node(this.argumentType, name);
            stdArgument.children.push(new Node(argumentTypeToType.get(spec.type)!, spec.default));
            stdArguments.children.push(stdArgument);
        }

        // 可以避免重复输入参数或者少输入参数带来的问题

        let references: Set<string> = new Set();

        for (let argument of result.node.children) {
            let name = argument.content;
            if (argument.children.length === 0) {
                // 不可能的情况
                throw new LixError(parserExceptionTexts.ArgumentHasNoValue.format(name));
            }

            let argumentValue = argument.children[0];

            if (argumentValue.type === this.referenceType) {
                if (!argumentsSpec.allowReference) {
                    result.addMessage(this.texts.ReferencesNotAllowedInBlock.format(blockName), MessageType.error, argumentValue);
                    result.mergeState(ResultState.skippable);
                    continue;
                }
                if (references.has(argumentValue.content)) {
                    result.addMessage(this.texts.ReferenceDuplicated.format(argumentValue.content), MessageType.error, argumentValue);
                    result.mergeState(ResultState.skippable);
                }
                references.add(argumentValue.content);
                continue;
            }

            if (argument.content === "") {
                let notUnique = false;
                argumentsSpec.argumentOptions.forEach((value, key) => {
                    if (value.options.indexOf(argumentValue.content) !== -1) {
                        if (name !== "") {
                            notUnique = true;
                            return;
                        }
                        name = key;
                    }
                })
                if (notUnique) {
                    result.addMessage(this.texts.UnknownArgumentImplicitValueNotUnique.format(argumentValue.content), MessageType.error, argumentValue);
                    result.mergeState(ResultState.skippable);
                }
                if (name === "") {
                    result.addMessage(this.texts.UnknownArgumentImplicitValue.format(argumentValue.content), MessageType.error, argumentValue);
                    result.mergeState(ResultState.skippable);
                    continue;
                }
            }

            let spec = argumentsSpec.argumentOptions.get(name);
            if (!spec) {
                result.addMessage(this.texts.ArgumentUnknown.format(name), MessageType.error, argument);
                result.mergeState(ResultState.skippable);
                continue;
            }

            if (argumentTypeToType.get(spec.type) !== argumentValue.type) {
                result.addMessage(this.texts.ArgumentTypeMismatch.format(name), MessageType.error, argument);
                result.mergeState(ResultState.skippable);
                continue;
            }

            if (spec.type === ArgumentType.enumeration && spec.options.indexOf(argumentValue.content) === -1) {
                result.addMessage(this.texts.ArgumentEnumerationValueInvalid.format(name), MessageType.error, argument);
                result.mergeState(ResultState.skippable);
                continue;
            }

            stdArguments.children.find(node => node.content === name)!.children[0].content = argumentValue.content;
        }

        references.forEach(value => {
            stdArguments.children.push(new Node(this.referenceType, value));
            result.references.push(new Reference(value, result.analysedNode));
        });
    }

    matchArguments(blockName: string): NodeResult {
        return this.prepareMatch(this.argumentsType, "arguments", this.myMatchArguments, this, this.checkAndStandardizeArguments.bind(this, blockName));
    }

    private myMatchArguments(result: NodeResult) {

        let res: BasicResult;
        let nodeRes: NodeResult;

        result.merge(this.skipBlank());

        let beginIndex = this.index;
        if ((res = this.match("(")).matched) {
            result.merge(res);
            result.addHighlight(HighlightType.operator, beginIndex, 0, 1);

            result.merge(this.skipBlank());

            let preIndex = this.index;
            if (this.isEOF()) {
                result.addMessage(this.texts.ArgumentsEndedUnexpectedly, MessageType.error, beginIndex, 0, preIndex - beginIndex);
                result.mergeState(ResultState.skippable);
                return;
            }
            else if ((res = this.match(")")).matched) {
                result.merge(res);
                result.addHighlight(HighlightType.operator, preIndex, 0, 1);
            }
            else if ((nodeRes = this.matchArgument()).matched) {
                result.merge(nodeRes);
                result.node.children.push(nodeRes.node);

                result.merge(this.skipBlank());

                while (true) {
                    preIndex = this.index;
                    if (this.isEOF()) {
                        result.addMessage(this.texts.ArgumentsEndedUnexpectedly, MessageType.error, beginIndex, 0, preIndex - beginIndex);
                        result.mergeState(ResultState.skippable);
                        break;
                    }
                    else if ((res = this.match(")")).matched) {
                        result.merge(res);
                        result.addHighlight(HighlightType.operator, preIndex, 0, 1);
                        break;
                    }

                    result.merge(this.match(","));
                    if (result.shouldTerminate) {
                        result.addMessage(this.texts.ArgumentCommaMissing, MessageType.error, beginIndex, 0, preIndex - beginIndex);
                        result.promoteToSkippable();
                        this.skipToAfter(")");
                        return;
                    }
                    result.addHighlight(HighlightType.operator, preIndex, 0, 1);

                    result.merge(this.skipBlank());

                    nodeRes = this.matchArgument();
                    result.merge(nodeRes);
                    if (result.shouldTerminate) {
                        result.promoteToSkippable();
                        this.skipToAfter(")");
                        return;
                    }
                    result.node.children.push(nodeRes.node);

                    result.merge(this.skipBlank());
                }
            }
            else {
                result.addMessage(this.texts.ArgumentUnrecognized, MessageType.error, beginIndex, 0, preIndex - beginIndex);
                result.mergeState(ResultState.skippable);
                this.skipToAfter(")");
                return;
            }
        }
        else if ((res = this.match(":")).matched) {
            result.merge(res);
        }
        else {
            result.mergeState(ResultState.successful);
        }
    }

    // MatchArgument: failed | skippable | successful

    matchArgument(): NodeResult {
        // 无需 analyse 复制一份
        return this.prepareMatch(this.argumentType, "argument", this.myMatchArgument, this);
    }

    private myMatchArgument(result: NodeResult) {

        let res: BasicResult;
        let valRes: Result<string>;
        let nameRes: Result<string>;

        let beginIndex = this.index;
        if ((res = this.match("@")).matched) {
            result.merge(res);
            result.addHighlight(HighlightType.operator, beginIndex, 0, 1);

            result.merge(this.skipBlank());

            let nameIndex = this.index;
            let nameRes = this.matchName();
            result.merge(nameRes);
            if (result.shouldTerminate) {
                result.addMessage(this.texts.ReferenceNameMissing, MessageType.error, beginIndex, 0, 1);
                result.promoteToSkippable();
                result.addNode(this.referenceType, nameRes.value, [], beginIndex, 0, 1);
                return;
            }
            result.addNode(this.referenceType, nameRes.value, [], beginIndex, 0, this.index - beginIndex);
            result.addHighlight(HighlightType.keyword, nameIndex, 0, nameRes.value.length);
        }

        else if ((nameRes = this.matchName()).matched) {
            result.merge(nameRes);
            result.addHighlight(HighlightType.keyword, beginIndex, 0, nameRes.value.length);

            // This is an 'is' function
            let preIndex = this.index;
            this.skipBlank();
            let hasValue = this.is(":");
            this.index = preIndex;

            if (hasValue) {
                result.node.content = nameRes.value;

                result.merge(this.skipBlank());

                let colonIndex = this.index;
                result.merge(this.match(":"));
                result.addHighlight(HighlightType.operator, colonIndex, 0, 1);

                result.merge(this.skipBlank());

                preIndex = this.index;
                if ((valRes = this.matchNumber()).matched) {
                    result.merge(valRes);
                    result.addHighlight(HighlightType.number, preIndex, 0, this.index - preIndex);
                    result.addNode(this.numberType, valRes.value, [], preIndex, 0, this.index - preIndex);
                }
                else if ((valRes = this.matchString()).matched) {
                    result.merge(valRes);
                    result.addHighlight(HighlightType.string, preIndex, 0, this.index - preIndex);
                    result.addNode(this.stringType, valRes.value, [], preIndex, 0, this.index - preIndex);
                }
                else if ((valRes = this.matchName()).matched) {
                    result.merge(valRes);
                    result.addHighlight(HighlightType.keyword, preIndex, 0, this.index - preIndex);
                    result.addNode(this.nameType, valRes.value, [], preIndex, 0, this.index - preIndex);
                }
                else {
                    result.mergeState(ResultState.skippable);
                    result.addMessage(this.texts.ArgumentValueMissing, MessageType.error, colonIndex, 0, 1);
                    result.addNode(this.nameType, "", [], preIndex, 0, 0);
                }

            }
            else {
                result.addNode(this.nameType, nameRes.value, [], beginIndex, 0, nameRes.value.length);
            }
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
        result.value = nameRes.value;
        return result;
    }

    isSomeBlock(...filters: (string | BlockType)[]): boolean {
        let preIndex = this.index;
        let blcRes = this.getBlockName();
        this.index = preIndex;
        if (blcRes.matched) {
            let type = this.blockTable.getType(blcRes.value);
            if (type === undefined) {
                return false;
            }

            for (let filter of filters) {
                if (typeof (filter) === "string") {
                    if (filter === blcRes.value) {
                        return true;
                    }
                }
                else {
                    if (type === filter) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    isNonSomeBlock(...filters: (string | BlockType)[]): boolean {
        let preIndex = this.index;
        let blcRes = this.getBlockName();
        this.index = preIndex;
        if (blcRes.matched) {
            let type = this.blockTable.getType(blcRes.value);
            if (type === undefined) {
                return false;
            }

            for (let filter of filters) {
                if (typeof (filter) === "string") {
                    if (filter === blcRes.value) {
                        return false;
                    }
                }
                else {
                    if (type === filter) {
                        return false;
                    }
                }
            }
            return true;
        }
        return false;
    }

    getArgument(args: Node, name: string): string {
        let found: string | undefined;
        args.children.forEach(argNode => {
            if (argNode.type === this.argumentType && argNode.content === name) {
                found = argNode.children[0].content;
            }
        });
        if (found === undefined) {
            throw new LixError(parserExceptionTexts.ArgumentNotFound);
        }
        return found;
    }

    getReferences(args: Node): string[] {
        let refs: string[] = [];
        args.children.forEach(argNode => {
            if (argNode.type === this.referenceType) {
                refs.push(argNode.content);
            }
        });
        return refs;
    }

    // **************** Foundation ****************

    prepareMatchingForFoundation<R extends BasicResult>(result: R, name: string, myMatch: (result: R) => void, thisArg?: unknown): R {
        let preIndex = this.index;
        this.begin(name);
        myMatch.bind(thisArg)(result);
        this.end();
        if (result.failed) {
            this.index = preIndex;
        }
        return result;
    }

    // **************** Name & Constants ****************

    // MatchName: failing | successful

    matchName(): Result<string> {
        return this.prepareMatchingForFoundation(new Result<string>(""), `name`, this.myMatchName, this);
    }

    private myMatchName(result: Result<string>) {
        while (true) {
            if (this.is(Parser.nameChar)) {
                let valRes = this.matchChar();
                result.merge(valRes);
                result.value += valRes.value;
            }
            else {
                break;
            }
        }
    }

    // MatchString: failing | skippable | successful

    matchString(): Result<string> {
        return this.prepareMatchingForFoundation(new Result<string>(""), `string`, this.myMatchString, this);
    }

    private myMatchString(result: Result<string>) {
        let res: BasicResult;

        let beginIndex = this.index;
        if ((res = this.match('`')).matched) {
            result.merge(res);
            while (true) {
                if ((res = this.match('`')).matched) {
                    result.merge(res);
                    break;
                }
                else if (this.is(Parser.newline)) {
                    result.mergeState(ResultState.skippable);
                    result.addMessage(this.texts.StringNewlineForbidden, MessageType.error, beginIndex, 0, this.index - beginIndex);
                    break;
                }
                else {
                    let valRes = this.matchChar();
                    result.merge(valRes);
                    if (result.shouldTerminate) {
                        result.promoteToSkippable();
                        result.addMessage(this.texts.StringEndedUnexpectedly, MessageType.error, beginIndex, 0, this.index - beginIndex);
                        break;
                    }
                    result.value += valRes.value;
                }
            }
        }
        else if ((res = this.match("'")).matched) {
            result.merge(res);
            while (true) {
                if ((res = this.match("'")).matched) {
                    result.merge(res);
                    break;
                }
                else if (this.is(Parser.newline)) {
                    result.mergeState(ResultState.skippable);
                    result.addMessage(this.texts.StringNewlineForbidden, MessageType.error, beginIndex, 0, this.index - beginIndex);
                    break;
                }
                else {
                    let valRes = this.matchChar();
                    result.merge(valRes);
                    if (result.shouldTerminate) {
                        result.promoteToSkippable();
                        result.addMessage(this.texts.StringEndedUnexpectedly, MessageType.error, beginIndex, 0, this.index - beginIndex);
                        break;
                    }
                    result.value += valRes.value;
                }
            }
        }
        else if ((res = this.match('"')).matched) {
            result.merge(res);
            while (true) {
                if ((res = this.match('"')).matched) {
                    result.merge(res);
                    break;
                }
                else if (this.is(Parser.newline)) {
                    result.mergeState(ResultState.skippable);
                    result.addMessage(this.texts.StringNewlineForbidden, MessageType.warning, beginIndex, 0, this.index - beginIndex);
                    break;
                }
                else {
                    let valRes = this.matchChar();
                    result.merge(valRes);
                    if (result.shouldTerminate) {
                        result.promoteToSkippable();
                        result.addMessage(this.texts.StringEndedUnexpectedly, MessageType.error, beginIndex, 0, this.index - beginIndex);
                        break;
                    }
                    result.value += valRes.value;
                }
            }
        }
    }

    // MatchNumber: failing | skippable | successful

    matchNumber(): Result<string> {
        return this.prepareMatchingForFoundation(new Result<string>(""), `number`, this.myMatchNumber, this);
    }

    private myMatchNumber(result: Result<string>) {
        let res: BasicResult;
        let valRes: Result<string>;

        if ((res = this.match('+')).matched) {
            result.merge(res);
            //result.value += '+';
        }
        else if ((res = this.match('-')).matched) {
            result.merge(res);
            result.value += '-';
        }
        else {
            //result.value += '+';
        }

        if (!this.is(Parser.number)) {
            result.mergeState(ResultState.failing);
            return;
        }

        result.GuaranteeMatched();

        while (true) {
            if (this.is(Parser.number)) {
                valRes = this.matchChar();
                result.merge(valRes);
                result.value += valRes.value;
            }
            else {
                break;
            }
        }

        if ((res = this.match(".")).matched) {
            result.merge(res);
            result.value += ".";

            while (true) {
                if (this.is(Parser.number)) {
                    valRes = this.matchChar();
                    result.merge(valRes);
                    result.value += valRes.value;
                }
                else {
                    break;
                }
            }
        }

        if ((res = this.match("%")).matched) {
            result.merge(res);
            result.value += "%";
        }
        else if ((res = this.match("px")).matched) {
            result.merge(res);
            result.value += "px";
        }
        else if ((res = this.match("em")).matched) {
            result.merge(res);
            result.value += "em";
        }
        else if ((res = this.match("cm")).matched) {
            result.merge(res);
            result.value += "cm";
        }
    }

    // **************** Blank & Comments ****************

    // MatchSinglelineBlank: failing | skippable | successful

    matchSinglelineBlank(): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `singleline-blank`, this.myMatchSinglelineBlank, this);
    }

    private myMatchSinglelineBlank(result: BasicResult) {
        let res: BasicResult;
        while (true) {
            if ((res = this.matchSinglelineComment()).matched) {
                result.merge(res);
                break;
            }

            else if (this.is(Parser.blank)) {
                result.merge(this.matchChar());
            }
            else if ((res = this.matchMultilineComment()).matched) {
                result.merge(res);
            }
            else {
                break;
            }
        }
    }

    // MatchMultilineBlank: failing | skippable | successful

    matchMultilineBlank(): Result<number> {
        return this.prepareMatchingForFoundation(new Result<number>(0), `multiline-blank`, this.myMatchMultilineBlank, this);
    }

    private myMatchMultilineBlank(result: Result<number>) {
        let res: BasicResult;
        while (true) {
            if (this.is(Parser.blank)) {
                result.merge(this.matchChar());
            }
            else if (this.is(Parser.newline)) {
                result.value++;
                result.merge(this.matchChar());
            }
            else if ((res = this.matchSinglelineComment()).matched) {
                result.merge(res);
            }
            else if ((res = this.matchMultilineComment()).matched) {
                result.merge(res);
            }
            else {
                break;
            }
        }
    }

    // Arguments of MatchMultilineBlank

    isMultilineBlankGtOne(): boolean {
        let preIndex = this.index;
        let valRes = this.matchMultilineBlank();
        this.index = preIndex;
        if (valRes.matched && valRes.value > 1) {
            return true;
        }
        return false;
    }

    isMultilineBlankLeqOne(): boolean {
        let preIndex = this.index;
        let valRes = this.matchMultilineBlank();
        this.index = preIndex;
        if (valRes.matched && valRes.value <= 1) {
            return true;
        }
        return false;
    }

    // MatchMultilineBlankGtOne: failing | skippable | successful

    matchMultilineBlankGtOne(): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `multiline-blank-gt-1`, (result: BasicResult) => {
            let valRes = this.matchMultilineBlank();
            if (valRes.matched && valRes.value > 1) {
                result.merge(valRes);
            }
        }, this);
    }

    // MatchMultilineBlankLeqOne: failing | skippable | successful

    matchMultilineBlankLeqOne(): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `multiline-blank-leq-1`, (result: BasicResult) => {
            let valRes = this.matchMultilineBlank();
            if (valRes.matched && valRes.value <= 1) {
                result.merge(valRes);
            }
        }, this);
    }

    // MatchSinglelineComment: failing | successful

    matchSinglelineComment(): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `singleline-comment`, this.myMatchSinglelineComment, this);
    }

    private myMatchSinglelineComment(result: BasicResult) {
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
                result.merge(this.matchChar());
            }
        }
    }

    // MatchMultilineComment: failing | skippable | successful

    matchMultilineComment(): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `multiline-comment`, this.myMatchMultilineComment, this);
    }

    private myMatchMultilineComment(result: BasicResult) {
        let beginIndex = this.index;
        result.merge(this.match("/*"));
        if (result.shouldTerminate) {
            return;
        }

        let res: BasicResult;
        while (true) {
            if ((res = this.match("*/")).matched) {
                result.merge(res);
                break;
            }
            else if ((res = this.matchMultilineComment()).matched) {
                result.merge(res);
            }
            else {
                result.merge(this.matchChar());
                if (result.shouldTerminate) {
                    // EOF
                    result.promoteToSkippable();
                    result.addMessage(this.texts.MultilineCommentEndedUnexpectedly, MessageType.warning, beginIndex, 0, this.index - beginIndex);
                    return;
                }
            }
        }
    }

    // SkipBlank: skippable | successful

    skipBlank(): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `skip-blank`, (result: BasicResult) => {
            let res = this.matchSinglelineBlank();
            if (res.matched) {
                result.merge(res);
            }
            else {
                result.mergeState(ResultState.successful);
            }
        }, this);
    }

    // SkipMutilineBlank: skippable | successful

    skipMutilineBlank(): Result<number> {
        return this.prepareMatchingForFoundation(new Result<number>(0), `skip-multiline-blank`, (result: Result<number>) => {
            let valRes = this.matchMultilineBlank();
            if (valRes.matched) {
                result.merge(valRes);
                result.value = valRes.value;
            }
            else {
                result.mergeState(ResultState.successful);
            }
        }, this);
    }

    // **************** Terminal Token ****************

    // Match: failing | successful

    match(text: string): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `match'${text}'`, this.myMatch.bind(this, text));
    }

    private myMatch(text: string, result: BasicResult) {
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

    // MatchChar: failing | successful

    matchChar(): Result<string> {
        return this.prepareMatchingForFoundation(new Result<string>(""), `matchChar`, this.myMatchChar, this);
    }

    private myMatchChar(result: Result<string>) {
        if (this.isEOF()) {
            return;
        }
        result.mergeState(ResultState.successful);
        result.value = this.curChar();
        this.move();
    }

    // MatchUnicodeChar: failing | successful

    matchUnicodeChar(): Result<string> {
        return this.prepareMatchingForFoundation(new Result<string>(""), `matchUnicodeChar`, this.myMatchUnicodeChar, this);
    }

    private myMatchUnicodeChar(result: Result<string>) {
        if (this.isEOF()) {
            return;
        }
        result.mergeState(ResultState.successful);
        result.value = this.curUnicodeChar();
        this.moveUnicode();
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

    // **************** index control ****************
    // 以下函数均需手动保证 index 不越界 (0 <= index <= length, 注意可以等于 length)

    private checkIndex() {
        if (this.index < 0 || this.index > this.text.length) {
            throw new LixError(parserExceptionTexts.IndexOutOfBoundsInclusive);
        }
    }

    private checkIndexStrict() {
        if (this.index < 0 || this.index >= this.text.length) {
            throw new LixError(parserExceptionTexts.IndexOutOfBoundsExclusive);
        }
    }

    private notEnd(offset: number = 0): boolean {
        return this.index + offset < this.text.length;
    }

    curIsUnicode(): boolean {
        this.checkIndexStrict();
        let code = this.text.charCodeAt(this.index);
        return code >= 0xd800 && code <= 0xdbff;
    }

    move(offset: number = 1) {
        this.index += offset;
        this.checkIndex();
    }

    moveUnicode(offset: number = 1) {
        while (offset > 0) {
            let length = (this.curIsUnicode() && this.notEnd(1)) ? 2 : 1;
            this.move(length);
            offset--;
        }
    }

    curChar(): string {
        this.checkIndexStrict();
        return this.text[this.index];
    }

    curUnicodeChar(): string {
        let char = this.curChar();
        if (this.curIsUnicode() && this.notEnd(1)) {
            return char + this.text[this.index + 1];
        }
        else {
            return char;
        }
    }

    // **************** line number & message generate ****************

    // Line and character

    // Example: `abc\nde\EOF`, length = 6, lineRanges = [0, 4, 7] = [0, ..., length + 1], lines are [0, 4), [4, 7)
    generateLineRanges() {
        this.lineRanges.push(0);
        let i = 0;
        for (; i < this.text.length; i++, this.move()) {
            if (this.is(Parser.newline)) {
                this.lineRanges.push(i + 1);
            }
        }
        this.lineRanges.push(i + 1);
        this.index = 0;
    }

    // index should be in [0, length], if 'truncate' is true, the index will be truncated to [0, length]
    getLineAndCharacter(index: number = this.index, truncate: boolean = true): { line: number, character: number } {
        // Use binary search to accerlate
        // this.lineRanges starts with 0 and ends with length+1
        if (truncate && index < 0) {
            index = 0;
        }
        else if (truncate && index >= this.text.length + 1) {
            index = this.text.length;
        }
        for (let i = 0; i < this.lineRanges.length - 1; i++) {
            if (this.lineRanges[i] <= index && index < this.lineRanges[i + 1]) {
                return { line: i, character: index - this.lineRanges[i] };
            }
        }

        throw new LixError(parserExceptionTexts.GetLineAndCharacterOutOfBounds);
    }

    getIndex(line: number, character: number, truncate: boolean = true): number {
        line = (truncate && line < 0) ? 0 : line;
        line = (truncate && line >= this.lineRanges.length - 1) ? this.lineRanges.length - 2 : line;
        if (0 <= line && line < this.lineRanges.length - 1) {
            character = (truncate && character < 0) ? 0 : character;
            character = (truncate && character >= this.lineRanges[line + 1] - this.lineRanges[line]) ? this.lineRanges[line + 1] - this.lineRanges[line] - 1 : character;
            if (character >= 0 && character + this.lineRanges[line] < this.lineRanges[line + 1]) {
                return character + this.lineRanges[line];
            }
        }

        throw new LixError(parserExceptionTexts.GetIndexOutOfBounds);
    }

    // process

    begin(process: string) {
        this.process.push(process);
    }

    end() {
        this.process.pop();
    }
}