import { Node } from "../../syntax-tree/node";
import { Type } from "../../syntax-tree/type";
import { Module } from "../module";
import { Parser } from "../parser";
import { BasicResult, HighlightType, NodeResult, Result, ResultState } from "../result";
import { MessageType } from "../message";
import { BlockOption, ArgumentType, BlockType } from "../block-table";
import { error } from "../../foundation/error";
import { parserExceptionTexts } from "../texts";

export class Core extends Module {

    // types of syntax tree node

    private figureType: Type;
    private imageType: Type;

    private codeType: Type;

    private listType: Type;
    private itemType: Type;

    private tableType: Type;
    private cellType: Type;

    private captionType: Type;

    private emphType: Type;
    private boldType: Type;
    private italicType: Type;

    constructor(parser: Parser) {
        super(parser);

        // **************** Types ****************

        // Init syntax tree node type
        this.figureType = this.typeTable.add("figure");
        this.imageType = this.typeTable.add("image");
        this.codeType = this.typeTable.add("code");
        this.listType = this.typeTable.add("list");
        this.itemType = this.typeTable.add("item");
        this.tableType = this.typeTable.add("table");
        this.cellType = this.typeTable.add("cell");
        this.captionType = this.typeTable.add("caption");

        this.emphType = this.typeTable.add("emph");
        this.boldType = this.typeTable.add("bold");
        this.italicType = this.typeTable.add("italic");

        // **************** Basic Blocks ****************

        // figure
        this.parser.blockTable.add("figure", this.figureBlockHandler, this, {
            type: BlockType.basic,
            argumentOptions: new Map([
            ]),
            allowReference: true
        });

        // image
        this.parser.blockTable.add("image", this.imageBlockHandler, this, {
            type: BlockType.subblock,
            argumentOptions: new Map([
                ["path", { type: ArgumentType.string, options: [], default: "" }],
                ["size", { type: ArgumentType.number, options: [], default: "" }],
            ]),
            allowReference: false
        });

        // code
        this.parser.blockTable.add("code", this.codeBlockHandler, this, {
            type: BlockType.basic,
            argumentOptions: new Map(),
            allowReference: true
        });

        // table
        this.parser.blockTable.add("table", this.tableBlockHandler, this, {
            type: BlockType.basic,
            argumentOptions: new Map(),
            allowReference: true
        });

        // table cell
        this.parser.blockTable.add("cell", this.cellBlockHandler, this, {
            type: BlockType.subblock,
            argumentOptions: new Map([
                ["width", { type: ArgumentType.number, options: [], default: "1" }],
                ["height", { type: ArgumentType.number, options: [], default: "1" }],
            ]),
            allowReference: false
        });

        // list
        this.parser.blockTable.add("list", this.listBlockHandler, this, {
            type: BlockType.basic,
            argumentOptions: new Map([
                ["style", { type: ArgumentType.enumeration, options: ["numbered", "unnumbered"], default: "numbered" }],
            ]),
            allowReference: false
        });

        // list item
        this.parser.blockTable.add("item", this.itemBlockHandler, this, {
            type: BlockType.subblock,
            argumentOptions: new Map([
                ["level", { type: ArgumentType.enumeration, options: ["first", "second", "third", "fourth"], default: "first" }],
            ]),
            allowReference: true
        });

        // caption
        this.parser.blockTable.add("caption", this.captionBlockHandler, this, {
            type: BlockType.subblock,
            argumentOptions: new Map([]),
            allowReference: false
        });

        // **************** Format Blocks ****************

        // emph
        this.parser.blockTable.add("emph", this.emphBlockHandler, this, {
            type: BlockType.format,
            argumentOptions: new Map(),
            allowReference: false
        });

        // bold
        this.parser.blockTable.add("bold", this.boldBlockHandler, this, {
            type: BlockType.format,
            argumentOptions: new Map(),
            allowReference: false
        });

        // italic
        this.parser.blockTable.add("italic", this.italicBlockHandler, this, {
            type: BlockType.format,
            argumentOptions: new Map(),
            allowReference: false
        });

        // **************** Insertions ****************

        this.parser.insertionTable.add("`", this.codeInsertionHandler, this);
        // 有问题暂时不用
        // this.parser.insertionHandlerTable.add("*", this.inlineBoldHandler, this);
        // this.parser.insertionHandlerTable.add("~", this.inlineEmphHandler, this);

    }

    init() {
    }

    // **************** Format Blocks ****************

    private emphBlockHandler(args: Node): NodeResult {
        return this.parser.inlineModule.formatLikeBlockHandler("emph", this.emphType, args);
    }

    private boldBlockHandler(args: Node): NodeResult {
        return this.parser.inlineModule.formatLikeBlockHandler("bold", this.boldType, args);
    }

    private italicBlockHandler(args: Node): NodeResult {
        return this.parser.inlineModule.formatLikeBlockHandler("italic", this.italicType, args);
    }

    // **************** Insertions ****************

    private codeInsertionHandler(): NodeResult {
        return this.parser.prepareMatch(this.codeType, "inline-code-handler", this.myCodeInsertionHandler, this, this.parser.defaultAnalysis);
    }

    private myCodeInsertionHandler(result: NodeResult) {

        let res: BasicResult;
        let valRes: Result<string>;

        let beginIndex = this.sourceText.getIndex();

        res = result.merge(this.parser.match("`"));
        if (res.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }

        if (this.sourceText.isText("^")) {
            let pattern = "`";
            while (true) {
                if ((res = this.parser.match("^")).matched) {
                    result.merge(res);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    pattern += "^";
                }
                else if (this.parser.sourceText.isText("`")) {
                    break;
                }
                else {
                    result.mergeFailedState();
                    return;
                }
            }

            result.merge(this.parser.match("`"));
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            pattern += "`";
            result.addHighlight(HighlightType.operator, beginIndex, 0, pattern.length);

            while (true) {
                if (this.sourceText.isEOF()) {
                    break;
                }
                else if (this.parser.isMultilineBlankGtOne()) {
                    break;
                }

                else if (this.sourceText.isText(pattern)) {
                    break;
                }
                else if ((valRes = this.parser.matchChar()).matched) {
                    result.merge(valRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.appendNodeContent(valRes.value);
                }
            }

            result.merge(this.parser.match(pattern));
            if (result.shouldStop) {
                result.recoverToSkippable();
                result.addMessage(this.texts.InlineCodeEndedUnexpectedly, MessageType.error, beginIndex, 0, this.sourceText.getIndex() - beginIndex);
                return;
            }
            result.addHighlight(HighlightType.operator, this.sourceText.getIndex(), -pattern.length, 0);
        }
        else {
            result.addHighlight(HighlightType.operator, beginIndex, 0, 1);

            while (true) {
                if (this.sourceText.isEOF()) {
                    break;
                }
                else if (this.parser.isMultilineBlankGtOne()) {
                    break;
                }

                else if (this.sourceText.isText("`")) {
                    break;
                }
                else if ((valRes = this.parser.matchChar()).matched) {
                    result.merge(valRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.appendNodeContent(valRes.value);
                }
            }

            result.merge(this.parser.match("`"));
            if (result.shouldStop) {
                result.recoverToSkippable();
                result.addMessage(this.texts.InlineCodeEndedUnexpectedly, MessageType.error, beginIndex, 0, this.sourceText.getIndex() - beginIndex);
                return;
            }
            result.addHighlight(HighlightType.operator, this.sourceText.getIndex(), -1, 0);
        }
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
            if (this.parser.sourceText.isEOF()) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, this.parser.index));
                }
                result.addMessage("Inline format ended abruptly."), MessageType.error, this.parser.index);
                result.mergeState(ResultState.skippable);
                return;
            }

            else if (this.parser.sourceText.isText(endWith)) {
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

    // **************** Basic Blocks ****************

    // **************** Figure ****************

    private checkAndStandardizeFigure(result: NodeResult) {
        result.setDiscarded(false);
    }

    // FigureBlockHandler: failing | skippable | successful

    private figureBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.figureType, "figure-block-handler", this.myFigureBlockHandler.bind(this, args), this, this.checkAndStandardizeFigure);
    }

    private myFigureBlockHandler(args: Node, result: NodeResult) {

        let res: BasicResult
        let nodeRes: NodeResult;

        let preIndex: number;
        while (true) {
            preIndex = this.sourceText.getIndex();

            if ((res = this.parser.matchMultilineBlankLeqOne()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if (this.parser.inlineModule.isNoneOfBlocks("image", "caption")) {
                result.mergeFailedState();

                result.recoverToSkippable();
                let length = this.parser.skipByBrackets();
                result.addMessage(this.texts.FigureDisallowsOtherBlocks, MessageType.error, preIndex, 0, length);
            }

            else if ((nodeRes = this.parser.inlineModule.matchBlock()).matched) {
                // 只能是 image 或 caption
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeBothNodesWithChild(nodeRes);
            }

            else {
                break;
            }
        }
    }

    // ImageBlockHandler: failing | skippable | successful

    private imageBlockHandler(args: Node): NodeResult {
        let result = this.parser.inlineModule.formatLikeBlockHandler("image", this.imageType, args);
        result.setDiscarded(false);
        let path = this.parser.inlineModule.getArgument(args, "path");
        let sourceUri = this.fileSystem.pathToUri(path);
        let targetUri = this.fileSystem.cacheDirectoryUri.joinPath(sourceUri.basename);
        if (this.fileSystem.path.extname(path) === ".tikz") {
            result.addFileRecord({ kind: 'readFile', uri: sourceUri });
        }
        else {
            result.addFileRecord({ kind: 'copy', source: sourceUri, target: targetUri });
        }
        return result;
    }

    // CaptionHandler: failing | skippable | successful

    private captionBlockHandler(args: Node): NodeResult {
        return this.parser.inlineModule.formatLikeBlockHandler("caption", this.captionType, args);
    }

    // **************** Code ****************
    //

    private codeBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.codeType, "code-block-handler", this.myCodeBlockHandler.bind(this, args), this, this.parser.defaultAnalysis);
    }

    private myCodeBlockHandler(args: Node, result: NodeResult) {

        let res: BasicResult;
        let valRes: Result<string>;

        // This is an 'is' function
        let hasMarker = false;
        let preIndex = this.sourceText.getIndex();
        this.parser.skipMutilineBlank();
        if (this.sourceText.isText("`")) {
            hasMarker = true;
        }
        this.sourceText.setIndex(preIndex);

        if (!hasMarker) {
            while (true) {
                if (this.sourceText.isEOF()) {
                    break;
                }
                else if (this.sourceText.isText("]")) {
                    break;
                }
                else if ((valRes = this.parser.matchChar()).matched) {
                    result.merge(valRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.appendNodeContent(valRes.value);
                }
            }
        }
        else {
            result.merge(this.parser.skipMutilineBlank());

            let beginIndex = this.sourceText.getIndex();
            res = result.merge(this.parser.match("`"));
            if (res.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }

            if (this.sourceText.isText("^")) {
                let pattern = "`";
                while (true) {
                    if ((res = this.parser.match("^")).matched) {
                        result.merge(res);
                        if (result.shouldStop) {
                            error(parserExceptionTexts.LogicalUnexpectedStop);
                        }
                        pattern += "^";
                    }
                    else if (this.parser.sourceText.isText("`")) {
                        break;
                    }
                    else {
                        result.mergeFailedState();
                        return;
                    }
                }

                result.merge(this.parser.match("`"));
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                pattern += "`";
                result.addHighlight(HighlightType.operator, beginIndex, 0, pattern.length);

                while (true) {
                    if (this.sourceText.isEOF()) {
                        break;
                    }
                    else if (this.sourceText.isText(pattern)) {
                        break;
                    }
                    else if ((valRes = this.parser.matchChar()).matched) {
                        result.merge(valRes);
                        if (result.shouldStop) {
                            error(parserExceptionTexts.LogicalUnexpectedStop);
                        }
                        result.appendNodeContent(valRes.value);
                    }
                }

                result.merge(this.parser.match(pattern));
                if (result.shouldStop) {
                    result.recoverToSkippable();
                    result.addMessage(this.texts.InlineCodeEndedUnexpectedly, MessageType.error, beginIndex, 0, this.sourceText.getIndex() - beginIndex);
                    return;
                }
                result.addHighlight(HighlightType.operator, this.sourceText.getIndex(), -pattern.length, 0);
            }
            else {
                result.addHighlight(HighlightType.operator, beginIndex, 0, 1);

                while (true) {
                    if (this.sourceText.isEOF()) {
                        break;
                    }
                    else if (this.sourceText.isText("`")) {
                        break;
                    }
                    else if ((valRes = this.parser.matchChar()).matched) {
                        result.merge(valRes);
                        if (result.shouldStop) {
                            error(parserExceptionTexts.LogicalUnexpectedStop);
                        }
                        result.appendNodeContent(valRes.value);
                    }
                }

                result.merge(this.parser.match("`"));
                if (result.shouldStop) {
                    result.recoverToSkippable();
                    result.addMessage(this.texts.InlineCodeEndedUnexpectedly, MessageType.error, beginIndex, 0, this.sourceText.getIndex() - beginIndex);
                    return;
                }
                result.addHighlight(HighlightType.operator, this.sourceText.getIndex(), -1, 0);
            }

            result.merge(this.parser.skipMutilineBlank());
        }
    }

    // **************** List ****************

    private listBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.listType, "list-block-handler", this.myListBlockHandler.bind(this, args), this);
    }

    private myListBlockHandler(args: Node, result: NodeResult) {

        let nodeRes: NodeResult;

        let preIndex: number;
        while (true) {
            preIndex = this.sourceText.getIndex();

            if (this.parser.inlineModule.isNoneOfBlocks(BlockType.basic, BlockType.format, "item")) {
                result.mergeFailedState();

                result.recoverToSkippable();
                let length = this.parser.skipByBrackets();
                result.addMessage(this.texts.ListDisallowsOtherBlocks, MessageType.error, preIndex, 0, length);
            }

            else if ((nodeRes = this.matchFreeItem()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeBothNodesWithChild(nodeRes);
            }

            else if ((nodeRes = this.parser.inlineModule.matchBlock()).matched) {
                // 只能是 item block, format 和 basic 前面处理了
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeBothNodesWithChild(nodeRes);
            }

            else {
                break;
            }
        }
    }

    // MatchFreeItem: failing | skippable | successful

    private cleanupItem(result: NodeResult) {
        result.setDiscarded(result.analysedNode.content === "" && result.analysedNode.children.length === 0);
    }

    private matchFreeItem(): NodeResult {
        let result = this.parser.prepareMatch(this.itemType, "free-item", this.myMatchFreeItem, this, this.cleanupItem);
        return result;
    }

    private myMatchFreeItem(result: NodeResult) {

        let res: BasicResult;
        let nodeRes: NodeResult;

        let count = 0;
        while (true) {
            if ((res = this.parser.match("*")).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
                result.appendNodeContent("*");
                result.appendAnalysedNodeContent("*");
                count++;
            }
            else {
                break;
            }
        }

        if (count > 0) {
            result.addHighlight(HighlightType.operator, this.sourceText.getIndex(), -count, 0);
        }

        if ((nodeRes = this.matchListFreeText()).matched) {
            result.merge(nodeRes);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();
            result.mergeBothNodesWithChild(nodeRes);
        }
        else if (this.parser.inlineModule.isOneOfBlocks(BlockType.basic) && (nodeRes = this.parser.inlineModule.matchBlock()).matched) {
            result.merge(nodeRes);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();
            result.mergeBothNodesWithChild(nodeRes);
        }
        else {
            if (count > 0) {
                result.mergeSuccessfulState();
            }
            else {
                result.mergeFailedState();
                return;
            }
        }

        while (true) {
            if ((nodeRes = this.matchListFreeText()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
                result.mergeBothNodesWithChild(nodeRes);
            }
            else if (this.parser.inlineModule.isOneOfBlocks(BlockType.basic) && (nodeRes = this.parser.inlineModule.matchBlock()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
                result.mergeBothNodesWithChild(nodeRes);
            }
            else {
                break;
            }
        }
    }

    // MatchListFreeText: failing | skippable | successful

    private matchListFreeText(): NodeResult {
        return this.parser.prepareMatch(this.parser.inlineModule.textType, "list-free-text", this.myMatchListFreeText, this, this.parser.inlineModule.cleanupText, this.parser);
    }

    private myMatchListFreeText(result: NodeResult) {

        let text = "";
        let res: BasicResult;
        let valRes: Result<string>;
        let nodeRes: NodeResult;

        let preIndex = 0, curIndex: number;

        const mergeWordsNode = () => {
            if (text !== "") {
                result.addChild(this.parser.inlineModule.wordsType, text, [], preIndex, 0, curIndex - preIndex);
                result.addAnalysedChild(this.parser.inlineModule.wordsType, text, [], preIndex, 0, curIndex - preIndex);
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        if ((res = this.parser.match("\\\\")).matched) {
            mergeWordsNode();
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();
            result.addHighlight(HighlightType.operator, this.sourceText.getIndex(), -2, 0);
        }
        else {
            if (this.sourceText.isEOF()) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }
            else if (this.parser.isMultilineBlankGtOne()) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }
            if (this.sourceText.isText("\\\\")) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }
            else if (this.parser.inlineModule.isNoneOfBlocks(BlockType.format)) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }
            else if (this.parser.sourceText.isText("*")) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }
            else if (this.sourceText.isText("]")) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }

            while (true) {
                curIndex = this.sourceText.getIndex();

                if (this.parser.sourceText.isEOF()) {
                    mergeWordsNode();
                    break;
                }
                else if (this.parser.isMultilineBlankGtOne()) {
                    mergeWordsNode();
                    break;
                }
                else if (this.sourceText.isText("\\\\")) {
                    mergeWordsNode();
                    break;
                }
                else if (this.parser.inlineModule.isNoneOfBlocks(BlockType.format)) {
                    mergeWordsNode();
                    break;
                }
                else if (this.parser.sourceText.isText("*")) {
                    mergeWordsNode();
                    break;
                }
                else if (this.parser.sourceText.isText("]")) {
                    mergeWordsNode();
                    break;
                }

                else if ((res = this.parser.matchMultilineBlankLeqOne()).matched) {
                    resetIndex();
                    result.merge(res);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.ensureMatched();
                    text += " ";
                }

                else if ((nodeRes = this.parser.inlineModule.matchEscapeChar()).matched) {
                    resetIndex();
                    result.merge(nodeRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.ensureMatched();
                    text += nodeRes.node.content;
                }

                else if ((nodeRes = this.parser.inlineModule.matchInsertion()).matched) {
                    mergeWordsNode();
                    result.merge(nodeRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.ensureMatched();
                    result.mergeBothNodesWithChild(nodeRes);
                }

                else if ((nodeRes = this.parser.inlineModule.matchBlock()).matched) {
                    // 只能是 format block
                    mergeWordsNode();
                    result.merge(nodeRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.ensureMatched();
                    result.mergeBothNodesWithChild(nodeRes);
                }

                else {
                    resetIndex();
                    result.ensureMatched();
                    valRes = result.merge(this.parser.matchChar());
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    text += valRes.value;
                }
            }

            if ((res = this.parser.match("\\\\")).matched) {
                mergeWordsNode();
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
                result.addHighlight(HighlightType.operator, this.sourceText.getIndex(), -2, 0);
            }
            else {
                result.mergeSuccessfulState();
            }
        }
    }

    // ItemBlockHandler: failing | skippable | successful

    private itemBlockHandler(args: Node): NodeResult {
        let result = this.parser.inlineModule.paragraphLikeBlockHandler("item", this.itemType, args);
        result.setDiscarded(false);
        return result;
    }

    // **************** Table ****************

    // TextBlockHandler: failing | skippable | successful

    private tableBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.tableType, "table-block-handler", this.myTableBlockHandler.bind(this, args), this);
    }

    private myTableBlockHandler(args: Node, result: NodeResult) {

        let res: BasicResult;
        let nodeRes: NodeResult;

        let preIndex: number;

        let row = result.addChild(this.cellType, "", [], this.sourceText.getIndex(), 0, 0);
        let analysedRow = result.addAnalysedChild(this.cellType, "", [], this.sourceText.getIndex(), 0, 0);

        while (true) {
            preIndex = this.sourceText.getIndex();

            if (this.parser.inlineModule.isNoneOfBlocks(BlockType.basic, BlockType.format, "cell")) {
                result.mergeFailedState();

                result.recoverToSkippable(); let length = this.parser.skipByBrackets();
                result.addMessage(this.texts.TableDisallowsOtherBlocks, MessageType.error, preIndex, 0, length);
            }

            else if ((res = this.parser.match("&")).matched) {
                result.merge(res);
                result.addHighlight(HighlightType.operator, preIndex, 0, 1);
            }
            else if ((res = this.parser.match(";")).matched) {
                result.merge(res);
                result.addHighlight(HighlightType.operator, preIndex, 0, 1);
                row.begin = (row.children.at(0)?.begin) ?? row.begin;
                row.end = (row.children.at(-1)?.end) ?? row.end;
                analysedRow.begin = (analysedRow.children.at(0)?.begin) ?? analysedRow.begin;
                analysedRow.end = (analysedRow.children.at(-1)?.end) ?? analysedRow.end;

                row = result.addChild(this.cellType, "", [], this.sourceText.getIndex(), 0, 0);
                analysedRow = result.addAnalysedChild(this.cellType, "", [], this.sourceText.getIndex(), 0, 0);
            }

            else if ((nodeRes = this.matchFreeCell()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                row.children.push(nodeRes.node);
                if (!nodeRes.discarded) {
                    analysedRow.children.push(nodeRes.analysedNode);
                }
            }

            else if ((nodeRes = this.parser.inlineModule.matchBlock()).matched) {
                // 只能是 cell block, format 和 basic 前面处理了
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                row.children.push(nodeRes.node);
                if (!nodeRes.discarded) {
                    analysedRow.children.push(nodeRes.analysedNode);
                }
            }

            else {
                break;
            }
        }
    }

    // MatchFreeCell: failing | skippable | successful

    private cleanupCell(result: NodeResult) {
        result.setDiscarded(result.analysedNode.children.length === 0);
    }

    private matchFreeCell(): NodeResult {
        let result = this.parser.prepareMatch(this.cellType, "free-cell", this.myMatchFreeCell, this, this.cleanupCell);
        return result;
    }

    private myMatchFreeCell(result: NodeResult) {

        let nodeRes: NodeResult;

        if ((nodeRes = this.matchTableFreeText()).matched) {
            result.merge(nodeRes);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();
            result.mergeBothNodesWithChild(nodeRes);
        }
        else if (this.parser.inlineModule.isOneOfBlocks(BlockType.basic) && (nodeRes = this.parser.inlineModule.matchBlock()).matched) {
            result.merge(nodeRes);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();
            result.mergeBothNodesWithChild(nodeRes);
        }
        else {
            result.mergeFailedState();
            return;
        }

        while (true) {
            if ((nodeRes = this.matchTableFreeText()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
                result.mergeBothNodesWithChild(nodeRes);
            }
            else if (this.parser.inlineModule.isOneOfBlocks(BlockType.basic) && (nodeRes = this.parser.inlineModule.matchBlock()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
                result.mergeBothNodesWithChild(nodeRes);
            }
            else {
                break;
            }
        }
    }

    // MatchTableFreeText: failing | skippable | successful

    private matchTableFreeText(): NodeResult {
        return this.parser.prepareMatch(this.parser.inlineModule.textType, "table-free-text", this.myMatchTableFreeText, this, this.parser.inlineModule.cleanupText, this.parser);
    }

    private myMatchTableFreeText(result: NodeResult) {

        let text = "";
        let res: BasicResult;
        let valRes: Result<string>;
        let nodeRes: NodeResult;

        let preIndex = 0, curIndex: number;

        const mergeWordsNode = () => {
            if (text !== "") {
                result.addChild(this.parser.inlineModule.wordsType, text, [], preIndex, 0, curIndex - preIndex);
                result.addAnalysedChild(this.parser.inlineModule.wordsType, text, [], preIndex, 0, curIndex - preIndex);
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        if ((res = this.parser.match("\\\\")).matched) {
            mergeWordsNode();
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();
            result.addHighlight(HighlightType.operator, this.sourceText.getIndex(), -2, 0);
        }
        else {
            if (this.sourceText.isEOF()) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }
            else if (this.parser.isMultilineBlankGtOne()) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }
            if (this.sourceText.isText("\\\\")) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }
            else if (this.parser.inlineModule.isNoneOfBlocks(BlockType.format)) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }
            else if (this.parser.sourceText.isText("&")) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }
            else if (this.parser.sourceText.isText(";")) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }
            else if (this.sourceText.isText("]")) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }

            while (true) {
                curIndex = this.sourceText.getIndex();

                if (this.parser.sourceText.isEOF()) {
                    mergeWordsNode();
                    break;
                }
                else if (this.parser.isMultilineBlankGtOne()) {
                    mergeWordsNode();
                    break;
                }
                else if (this.sourceText.isText("\\\\")) {
                    mergeWordsNode();
                    break;
                }
                else if (this.parser.inlineModule.isNoneOfBlocks(BlockType.format)) {
                    mergeWordsNode();
                    break;
                }
                else if (this.parser.sourceText.isText("&")) {
                    mergeWordsNode();
                    break;
                }
                else if (this.parser.sourceText.isText(";")) {
                    mergeWordsNode();
                    break;
                }
                else if (this.parser.sourceText.isText("]")) {
                    mergeWordsNode();
                    break;
                }

                else if ((res = this.parser.matchMultilineBlankLeqOne()).matched) {
                    resetIndex();
                    result.merge(res);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.ensureMatched();
                    text += " ";
                }

                else if ((nodeRes = this.parser.inlineModule.matchEscapeChar()).matched) {
                    resetIndex();
                    result.merge(nodeRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.ensureMatched();
                    text += nodeRes.node.content;
                }

                else if ((nodeRes = this.parser.inlineModule.matchInsertion()).matched) {
                    mergeWordsNode();
                    result.merge(nodeRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.ensureMatched();
                    result.mergeBothNodesWithChild(nodeRes);
                }

                else if ((nodeRes = this.parser.inlineModule.matchBlock()).matched) {
                    // 只能是 format block
                    mergeWordsNode();
                    result.merge(nodeRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.ensureMatched();
                    result.mergeBothNodesWithChild(nodeRes);
                }

                else {
                    resetIndex();
                    result.ensureMatched();
                    valRes = result.merge(this.parser.matchChar());
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    text += valRes.value;
                }
            }

            if ((res = this.parser.match("\\\\")).matched) {
                mergeWordsNode();
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
                result.addHighlight(HighlightType.operator, this.sourceText.getIndex(), -2, 0);
            }
            else {
                result.mergeSuccessfulState();
            }
        }
    }

    // CellBlockHandler: failing | skippable | successful

    private cellBlockHandler(args: Node): NodeResult {
        let result = this.parser.inlineModule.paragraphLikeBlockHandler("cell", this.cellType, args);
        result.setDiscarded(false);
        return result;
    }
}
