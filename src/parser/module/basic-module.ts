import { Config } from "../../common/config";
import { Path } from "../../common/file-system/path";
import { HighlightType } from "../../common/result/highlight";
import { MessageType } from "../../common/result/message";
import { MatchResult, NodeResult } from "../../common/result/parsing-result";
import { SourceText } from "../../common/source-text";
import { Node } from "../../common/syntax-tree/node";
import { Type, TypeTable } from "../../common/syntax-tree/type-table";
import { error } from "../../foundation/error";
import { ArgumentType, BlockType } from "../table/block-table";
import { parserExceptionTexts, ParserTexts } from "../texts";
import { CoreModule } from "./core-module";
import { Module } from "./module";
import { ParserModule } from "./parser-module";

export class BasicModule extends Module {

    protected parserModule: ParserModule;
    protected coreModule: CoreModule;

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

    constructor(config: Config, path: Path, texts: ParserTexts, typeTable: TypeTable, sourceText: SourceText, parserModule: ParserModule, coreModule: CoreModule) {
        super(config, path, texts, typeTable, sourceText);
        this.parserModule = parserModule;
        this.coreModule = coreModule;

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
        this.parserModule.blockTable.add("figure", this.figureBlockHandler, this, {
            type: BlockType.basic,
            argumentOptions: new Map([
            ]),
            allowReference: true
        });

        // image
        this.parserModule.blockTable.add("image", this.imageBlockHandler, this, {
            type: BlockType.subblock,
            argumentOptions: new Map([
                ["path", { type: ArgumentType.string, options: [], default: "" }],
                ["size", { type: ArgumentType.number, options: [], default: "" }],
            ]),
            allowReference: false
        });

        // code
        this.parserModule.blockTable.add("code", this.codeBlockHandler, this, {
            type: BlockType.basic,
            argumentOptions: new Map(),
            allowReference: true
        });

        // table
        this.parserModule.blockTable.add("table", this.tableBlockHandler, this, {
            type: BlockType.basic,
            argumentOptions: new Map(),
            allowReference: true
        });

        // table cell
        this.parserModule.blockTable.add("cell", this.cellBlockHandler, this, {
            type: BlockType.subblock,
            argumentOptions: new Map([
                ["width", { type: ArgumentType.number, options: [], default: "1" }],
                ["height", { type: ArgumentType.number, options: [], default: "1" }],
            ]),
            allowReference: false
        });

        // list
        this.parserModule.blockTable.add("list", this.listBlockHandler, this, {
            type: BlockType.basic,
            argumentOptions: new Map([
                ["style", { type: ArgumentType.enumeration, options: ["numbered", "unnumbered"], default: "numbered" }],
            ]),
            allowReference: false
        });

        // list item
        this.parserModule.blockTable.add("item", this.itemBlockHandler, this, {
            type: BlockType.subblock,
            argumentOptions: new Map([
                ["level", { type: ArgumentType.enumeration, options: ["first", "second", "third", "fourth"], default: "first" }],
            ]),
            allowReference: true
        });

        // caption
        this.parserModule.blockTable.add("caption", this.captionBlockHandler, this, {
            type: BlockType.subblock,
            argumentOptions: new Map([]),
            allowReference: false
        });

        // **************** Format Blocks ****************

        // emph
        this.parserModule.blockTable.add("emph", this.emphBlockHandler, this, {
            type: BlockType.format,
            argumentOptions: new Map(),
            allowReference: false
        });

        // bold
        this.parserModule.blockTable.add("bold", this.boldBlockHandler, this, {
            type: BlockType.format,
            argumentOptions: new Map(),
            allowReference: false
        });

        // italic
        this.parserModule.blockTable.add("italic", this.italicBlockHandler, this, {
            type: BlockType.format,
            argumentOptions: new Map(),
            allowReference: false
        });

        // **************** Insertions ****************

        this.parserModule.insertionTable.add("`", this.codeInsertionHandler, this, {
            onlyInText: true
        });
        // 有问题暂时不用
        // this.parserModule.insertionHandlerTable.add("*", this.inlineBoldHandler, this);
        // this.parserModule.insertionHandlerTable.add("~", this.inlineEmphHandler, this);

    }

    init() {
    }

    // **************** Format Blocks ****************

    private emphBlockHandler(args: Node): NodeResult {
        return this.coreModule.formatLikeBlockHandler(this.emphType, "emph", args, {
            DisallowsBlocks: this.texts.FormatDisallowsNestedBlocks,
            DisallowsTextInsertion: this.texts.FormatDisallowsNestedTextInsertions
        });
    }

    private boldBlockHandler(args: Node): NodeResult {
        return this.coreModule.formatLikeBlockHandler(this.boldType, "bold", args, {
            DisallowsBlocks: this.texts.FormatDisallowsNestedBlocks,
            DisallowsTextInsertion: this.texts.FormatDisallowsNestedTextInsertions
        });
    }

    private italicBlockHandler(args: Node): NodeResult {
        return this.coreModule.formatLikeBlockHandler(this.italicType, "italic", args, {
            DisallowsBlocks: this.texts.FormatDisallowsNestedBlocks,
            DisallowsTextInsertion: this.texts.FormatDisallowsNestedTextInsertions
        });
    }

    // **************** Insertions ****************

    private codeInsertionHandler(): NodeResult {
        return this.coreModule.prepareMatch(this.codeType, "inline-code-handler", this.myCodeInsertionHandler, this, this.coreModule.defaultAnalysis);
    }

    private myCodeInsertionHandler(result: NodeResult) {

        let res: MatchResult<null>;
        let valRes: MatchResult<string>;

        let beginIndex = this.sourceText.mark();
        res = result.merge(this.parserModule.match("`"));
        if (res.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }

        if (this.sourceText.isText("^")) {
            let pattern = "`";
            while (true) {
                if ((res = this.parserModule.match("^")).matched) {
                    result.merge(res);
                    pattern += "^";
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                }
                else if (this.sourceText.isText("`")) {
                    break;
                }
                else {
                    result.mergeFailedState();
                    return;
                }
            }

            result.merge(this.parserModule.match("`"));
            pattern += "`";
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.highlightList.add(HighlightType.operator, this.sourceText.computeRange(beginIndex));

            while (true) {
                if (this.sourceText.isEOF()) {
                    break;
                }
                else if (this.parserModule.isMultilineBlankGtOne()) {
                    break;
                }

                else if (this.sourceText.isText(pattern)) {
                    break;
                }
                else if ((valRes = this.parserModule.matchChar()).matched) {
                    result.merge(valRes);
                    result.appendNodeContent(valRes.value);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                }
            }

            res = result.merge(this.parserModule.match(pattern));
            if (result.shouldStop) {
                result.recoverToSkippable();
                result.messageList.add(this.texts.InlineCodeEndedUnexpectedly, this.sourceText.computeRange(beginIndex), MessageType.error);
                return;
            }
            result.highlightList.add(HighlightType.operator, res.range);
        }
        else {
            result.highlightList.add(HighlightType.operator, res.range);

            while (true) {
                if (this.sourceText.isEOF()) {
                    break;
                }
                else if (this.parserModule.isMultilineBlankGtOne()) {
                    break;
                }

                else if (this.sourceText.isText("`")) {
                    break;
                }
                else if ((valRes = this.parserModule.matchChar()).matched) {
                    result.merge(valRes);
                    result.appendNodeContent(valRes.value);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                }
            }

            res = result.merge(this.parserModule.match("`"));
            if (result.shouldStop) {
                result.recoverToSkippable();
                result.messageList.add(this.texts.InlineCodeEndedUnexpectedly, this.sourceText.computeRange(beginIndex), MessageType.error);
                return;
            }
            result.highlightList.add(HighlightType.operator, res.range);
        }
    }

    /*
    inlineEmphHandler(): Result<Node> {
        let result = new Result<Node>(new Node(this.emphType));
        let preIndex = this.parserModule.index;
        this.parserModule.begin("inline-emph-handler");
        this.myInlineFormatHandler(result, "~");
        this.parserModule.end();
        result.content.begin = preIndex;
        result.content.end = this.parserModule.index;
        result.content.type = this.emphType;
        if (result.failed) {
            this.parserModule.index = preIndex;
        }
        return result;
    }

    inlineBoldHandler(): Result<Node> {
        let result = new Result<Node>(new Node(this.boldType));
        let preIndex = this.parserModule.index;
        this.parserModule.begin("inline-bold-handler");
        this.myInlineFormatHandler(result, "*");
        this.parserModule.end();
        result.content.begin = preIndex;
        result.content.end = this.parserModule.index;
        result.content.type = this.boldType;
        if (result.failed) {
            this.parserModule.index = preIndex;
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

        result.merge(this.parserModule.match(endWith));
        if(result.shouldTerminate) {
            result.messageList.add(`Missing '${endWith}' in inline format.`), MessageType.error, this.parserModule.index);
            return;
        }
        result.highlights.push(this.parserModule.getHighlight(HighlightType.operator, -1, 0));

        while (true) {
            if (this.sourceText.isEOF()) {
                if (text !== "") {
                    node.children.push(new Node(this.parserModule.wordsType, text, [], preIndex, this.parserModule.index));
                }
                result.messageList.add("Inline format ended abruptly."), MessageType.error, this.parserModule.index);
                result.mergeState(ResultState.skippable);
                return;
            }

            else if (this.sourceText.isText(endWith)) {
                if (text !== "") {
                    node.children.push(new Node(this.parserModule.wordsType, text, [], preIndex, this.parserModule.index));
                    text = "";
                }
                break;
            }

            else if(this.parserModule.isMultilineBlankGeThanOne()) {
                if (text !== "") {
                    node.children.push(new Node(this.parserModule.wordsType, text, [], preIndex, this.parserModule.index));
                    text = "";
                }
                result.messageList.add("Inline format ended abruptly."), MessageType.error, this.parserModule.index);
                result.mergeState(ResultState.skippable);
                return;
            }

            else if ((blnRes = this.parserModule.matchMultilineBlank()).matched) { // 结束条件判断过大于一行的空行, 这里只能是一行以内的
                if(text === "") {
                    preIndex = this.parserModule.index;
                }
                result.merge(blnRes);
                text += " ";
                if (blnRes.content > 1) {
                    result.messageList.add("Inline format cannot contain linebreaks more than 1.", MessageType.warning), MessageType.error, this.parserModule.index);
                    //result.mergeState(ResultState.skippable);
                }
            }

            else if ((curIndex = this.parserModule.index, symRes = this.parserModule.match("\\\\")).matched) {
                if(text === "") {
                    preIndex = curIndex;
                }
                result.messageList.add("Inline format should not have \\\\.", MessageType.warning), MessageType.error, this.parserModule.index);
                text += "\\\\";
                //result.mergeState(ResultState.skippable);
            }

            else if((curIndex = this.parserModule.index, ndRes = this.parserModule.matchEscapeChar()).matched) {
                if (text === "") {
                    preIndex = curIndex;
                }
                result.merge(ndRes);
                text += ndRes.content.content;
            }

            else if ((curIndex = this.parserModule.index, ndRes = this.parserModule.matchInsertion()).matched) {
                if (text !== "") {
                    node.children.push(new Node(this.parserModule.wordsType, text, [], preIndex, curIndex));
                    text = "";
                }
                result.merge(ndRes);
                // 不会失败
                node.children.push(ndRes.content);
            }

            else if (this.parserModule.isBlock()) {
                if (text !== "") {
                    node.children.push(new Node(this.parserModule.wordsType, text, [], preIndex, this.parserModule.index));
                    text = "";
                }
                result.messageList.add("Inline format should not have block."), MessageType.error, this.parserModule.index);
                result.mergeState(ResultState.skippable);
                this.parserModule.skipByBrackets();
            }

            else {
                if(text === "") {
                    preIndex = this.parserModule.index;
                }
                result.mergeState(ResultState.successful);
                text += this.parserModule.curChar();
                this.parserModule.move();
            }
        }

        result.merge(this.parserModule.match(endWith));
        if(result.shouldTerminate) {
            result.messageList.add(`Missing '${endWith}' in inline format.`), MessageType.error, this.parserModule.index);
            return;
        }
        result.highlights.push(this.parserModule.getHighlight(HighlightType.operator, -1, 0));
    }
    */

    // **************** Basic Blocks ****************

    // **************** Figure ****************

    // FigureBlockHandler: failing | skippable | successful

    private figureBlockHandler(args: Node): NodeResult {
        return this.coreModule.subblockLikeBlockHandler(this.figureType, "figure", args, {
            DisallowsOtherBlocks: this.texts.FigureDisallowsOtherBlocks
        }, () => {
            return this.coreModule.isNoneOfBlocks("image", "caption")
        }, (args, result) => {
            result.setDiscarded(false);
        });
    }

    // ImageBlockHandler: failing | skippable | successful

    private imageBlockHandler(args: Node): NodeResult {
        return this.coreModule.formatLikeBlockHandler(this.imageType, "image", args, {
            DisallowsBlocks: this.texts.FormatDisallowsNestedBlocks,
            DisallowsTextInsertion: this.texts.FormatDisallowsNestedTextInsertions
        }, (args, result) => {
            result.setDiscarded(false);
            let path = this.coreModule.getArgument(args, "path");
            let sourceUri = this.path.toUri(path, this.config.workingDirectoryUri);
            let targetUri = this.config.cacheDirectoryUri.joinPath(sourceUri.basename);
            if (this.path.extname(path) === ".tikz") {
                result.fileRecordList.recordReadFile(sourceUri);
            }
            else {
                result.fileRecordList.recordCopy(sourceUri, targetUri);
            }
        });
    }

    // CaptionHandler: failing | skippable | successful

    private captionBlockHandler(args: Node): NodeResult {
        return this.coreModule.formatLikeBlockHandler(this.captionType, "caption", args, {
            DisallowsBlocks: this.texts.FormatDisallowsNestedBlocks,
            DisallowsTextInsertion: this.texts.FormatDisallowsNestedTextInsertions
        });
    }

    // **************** Code ****************
    //

    private codeBlockHandler(args: Node): NodeResult {
        return this.coreModule.prepareMatchBlock(this.codeType, "code-block-handler", args, this.myCodeBlockHandler, this, this.coreModule.defaultBlockAnalysis);
    }

    private myCodeBlockHandler(args: Node, result: NodeResult) {

        let res: MatchResult<null>;
        let valRes: MatchResult<string>;

        // This is an 'is' function
        let hasMarker = false;
        let preIndex = this.sourceText.mark();
        this.parserModule.skipMutilineBlank();
        if (this.sourceText.isText("`")) {
            hasMarker = true;
        }
        this.sourceText.recover(preIndex);

        if (!hasMarker) {
            while (true) {
                if (this.sourceText.isEOF()) {
                    break;
                }
                else if (this.sourceText.isText("]")) {
                    break;
                }
                else if ((valRes = this.parserModule.matchChar()).matched) {
                    result.merge(valRes);
                    result.appendNodeContent(valRes.value);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                }
            }
        }
        else {
            result.merge(this.parserModule.skipMutilineBlank());

            let beginIndex = this.sourceText.mark();
            res = result.merge(this.parserModule.match("`"));
            if (res.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }

            if (this.sourceText.isText("^")) {
                let pattern = "`";
                while (true) {
                    if ((res = this.parserModule.match("^")).matched) {
                        result.merge(res);
                        pattern += "^";
                        if (result.shouldStop) {
                            error(parserExceptionTexts.LogicalUnexpectedStop);
                        }
                    }
                    else if (this.sourceText.isText("`")) {
                        break;
                    }
                    else {
                        result.mergeFailedState();
                        return;
                    }
                }

                result.merge(this.parserModule.match("`"));
                pattern += "`";
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.highlightList.add(HighlightType.operator, this.sourceText.computeRange(beginIndex));

                while (true) {
                    if (this.sourceText.isEOF()) {
                        break;
                    }
                    else if (this.sourceText.isText(pattern)) {
                        break;
                    }
                    else if ((valRes = this.parserModule.matchChar()).matched) {
                        result.merge(valRes);
                        result.appendNodeContent(valRes.value);
                        if (result.shouldStop) {
                            error(parserExceptionTexts.LogicalUnexpectedStop);
                        }
                    }
                }

                res = result.merge(this.parserModule.match(pattern));
                if (result.shouldStop) {
                    result.recoverToSkippable();
                    result.messageList.add(this.texts.InlineCodeEndedUnexpectedly, this.sourceText.computeRange(beginIndex), MessageType.error);
                    return;
                }
                result.highlightList.add(HighlightType.operator, res.range);
            }
            else {
                result.highlightList.add(HighlightType.operator, this.sourceText.computeRange(beginIndex));

                while (true) {
                    if (this.sourceText.isEOF()) {
                        break;
                    }
                    else if (this.sourceText.isText("`")) {
                        break;
                    }
                    else if ((valRes = this.parserModule.matchChar()).matched) {
                        result.merge(valRes);
                        if (result.shouldStop) {
                            error(parserExceptionTexts.LogicalUnexpectedStop);
                        }
                        result.appendNodeContent(valRes.value);
                    }
                }

                res = result.merge(this.parserModule.match("`"));
                if (result.shouldStop) {
                    result.recoverToSkippable();
                    result.messageList.add(this.texts.InlineCodeEndedUnexpectedly, this.sourceText.computeRange(beginIndex), MessageType.error);
                    return;
                }
                result.highlightList.add(HighlightType.operator, res.range);
            }

            result.merge(this.parserModule.skipMutilineBlank());
        }
    }

    // **************** List ****************

    private listBlockHandler(args: Node): NodeResult {

        let star: string;

        return this.coreModule.multiParagraphLikeBlockHandler(this.listType, this.itemType, "list", "item", args, {
            DisallowsOtherBlocks: this.texts.ListDisallowsOtherBlocks,
        }, (result) => {
            star = "";
        }, () => {
            return this.coreModule.isNoneOfBlocks(BlockType.basic, BlockType.format, "item");
        }, () => {
            return this.sourceText.isText("*");
        }, (result) => {
            let res: MatchResult<null>;

            let beginIndex = this.sourceText.mark();
            star = "";
            while (true) {
                if ((res = this.parserModule.match("*")).matched) {
                    result.merge(res);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    star += "*";
                }
                else {
                    break;
                }
            }
            result.highlightList.add(HighlightType.operator, this.sourceText.computeRange(beginIndex));
        }, (nodeRes, result) => {
            nodeRes.node.content = star;
            nodeRes.analysedNode.content = star;
            result.node.children.push(nodeRes.node);
            if (!nodeRes.discarded) {
                result.analysedNode.children.push(nodeRes.analysedNode);
            }
            star = "";
        });
    }

    private itemBlockHandler(args: Node): NodeResult {
        return this.coreModule.paragraphLikeBlockHandler(this.itemType, "item", args, {
            DisallowsOtherBlocks: this.texts.ParagraphDisallowsOtherBlocks
        }, () => {
            return this.coreModule.isNoneOfBlocks(BlockType.basic, BlockType.format);
        }, (args, result) => {
            result.setDiscarded(false);
        });
    }

    // **************** Table ****************

    // TextBlockHandler: failing | skippable | successful

    private tableBlockHandler(args: Node): NodeResult {

        let subNode: Node;
        let subAnalysedNode: Node;

        return this.coreModule.multiParagraphLikeBlockHandler(this.tableType, this.cellType, "table", "cell", args, {
            DisallowsOtherBlocks: this.texts.TableDisallowsOtherBlocks,
        }, (result) => {
            subNode = result.addChild(this.cellType, this.sourceText.emptyRange);
            subAnalysedNode = result.addAnalysedChild(this.cellType, this.sourceText.emptyRange);
        }, () => {
            return this.coreModule.isNoneOfBlocks(BlockType.basic, BlockType.format, "cell");
        }, () => {
            return this.sourceText.isText("&") || this.sourceText.isText(";");
        }, (result) => {
            let res: MatchResult<null>;
            if ((res = this.parserModule.match("&")).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.highlightList.add(HighlightType.operator, res.range);
            }
            else if ((res = this.parserModule.match(";")).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.highlightList.add(HighlightType.operator, res.range);

                subNode = result.addChild(this.cellType, this.sourceText.emptyRange);
                subAnalysedNode = result.addAnalysedChild(this.cellType, this.sourceText.emptyRange);
            }
        }, (nodeRes, result) => {
            subNode.children.push(nodeRes.node);
            if (!nodeRes.discarded) {
                subAnalysedNode.children.push(nodeRes.analysedNode);
            }

            if (subNode.children.length > 0) {
                subNode.range = this.sourceText.unionRange(subNode.children[0].range, subNode.children.at(-1)!.range);
            }
            if (subAnalysedNode.children.length > 0) {
                subAnalysedNode.range = this.sourceText.unionRange(subAnalysedNode.children[0].range, subAnalysedNode.children.at(-1)!.range);
            }
        });
    }

    private cellBlockHandler(args: Node): NodeResult {
        return this.coreModule.paragraphLikeBlockHandler(this.cellType, "cell", args, {
            DisallowsOtherBlocks: this.texts.ParagraphDisallowsOtherBlocks
        }, () => {
            return this.coreModule.isNoneOfBlocks(BlockType.basic, BlockType.format);
        }, (args, result) => {
            result.setDiscarded(false);
        });
    }
}
