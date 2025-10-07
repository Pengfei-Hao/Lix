import { Node } from "../../sytnax-tree/node";
import { Type } from "../../sytnax-tree/type";
import { Module } from "../module";
import { Parser } from "../parser";
import { BasicResult, HighlightType, NodeResult, Result, ResultState } from "../result";
import { MessageType } from "../../foundation/message";
import { BlockOption, ArgumentType, BlockType } from "../block-table";
import { LixError } from "../../foundation/error";

export class Core extends Module {

    // types of syntax tree node

    figureType: Type;
    imageType: Type;

    codeType: Type;

    listType: Type;
    itemType: Type;

    tableType: Type;
    cellType: Type;

    captionType: Type;

    emphType: Type;
    boldType: Type;
    italicType: Type;

    constructor(parser: Parser) {
        super(parser);

        // **************** Types ****************

        // Init syntax tree node type
        this.figureType = this.parser.typeTable.add("figure");
        this.imageType = this.parser.typeTable.add("image");
        this.codeType = this.parser.typeTable.add("code");
        this.listType = this.parser.typeTable.add("list");
        this.itemType = parser.typeTable.add("item");
        this.tableType = this.parser.typeTable.add("table");
        this.cellType = this.parser.typeTable.add("cell");
        this.captionType = this.parser.typeTable.add("caption");

        this.emphType = this.parser.typeTable.add("emph");
        this.boldType = this.parser.typeTable.add("bold");
        this.italicType = this.parser.typeTable.add("italic");

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

    emphBlockHandler(args: Node): NodeResult {
        return this.parser.formatLikeBlockHandler("emph", this.emphType, args);
    }

    boldBlockHandler(args: Node): NodeResult {
        return this.parser.formatLikeBlockHandler("bold", this.boldType, args);
    }

    italicBlockHandler(args: Node): NodeResult {
        return this.parser.formatLikeBlockHandler("italic", this.italicType, args);
    }

    // **************** Insertions ****************

    codeInsertionHandler(): NodeResult {
        return this.parser.prepareMatch(this.codeType, "inline-code-handler", this.myCodeInsertionHandler, this, this.parser.defaultAnalysis);
    }

    private myCodeInsertionHandler(result: NodeResult) {
        let node = result.node;

        let symRes: BasicResult;

        let beginIndex = this.parser.index;
        let count = 0;
        while ((symRes = this.parser.match("`")).matched) {
            result.merge(symRes);
            count++;
        }
        if (count !== 0) {
            result.addHighlight(HighlightType.operator, beginIndex, 0, count);
        }

        let occur = 0;
        while (true) {
            if (this.parser.isEOF()) {
                result.mergeState(ResultState.skippable);
                result.addMessage("Inline code ended abruptly.", MessageType.error, beginIndex, 0, this.parser.index - beginIndex);
                return;
            }

            else if (this.parser.isMultilineBlankGtOne()) {
                result.mergeState(ResultState.skippable);
                result.addMessage("Inline code ended abruptly.", MessageType.error, beginIndex, 0, this.parser.index - beginIndex);
                return;
            }

            else if ((symRes = this.parser.match("`")).matched) {
                result.merge(symRes);
                occur++;
                node.content += "`";
                if (occur == count) {
                    if (count !== 0) {
                        node.content = node.content.slice(0, -count);
                        result.addHighlight(HighlightType.operator, this.parser.index, -count, 0);
                    }
                    return;
                }
            }

            else {
                result.mergeState(ResultState.successful);
                occur = 0;
                node.content += this.parser.curChar();
                this.parser.move();
            }

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
            if (this.parser.isEOF()) {
                if (text !== "") {
                    node.children.push(new Node(this.parser.wordsType, text, [], preIndex, this.parser.index));
                }
                result.addMessage("Inline format ended abruptly."), MessageType.error, this.parser.index);
                result.mergeState(ResultState.skippable);
                return;
            }

            else if (this.parser.is(endWith)) {
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

    checkAndStandardizeFigure(result: NodeResult) {
        result.discarded = false;
    }

    // FigureBlockHandler: failing | skippable | successful

    figureBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.figureType, "figure-block-handler", this.myFigureBlockHandler.bind(this, args), this, this.checkAndStandardizeFigure);
    }

    private myFigureBlockHandler(args: Node, result: NodeResult) {
        let nodeRes: NodeResult;
        let blkRes: Result<number>;
        let preIndex: number;

        result.mergeState(ResultState.successful);

        while (true) {
            preIndex = this.parser.index;

            if (this.parser.isEOF()) {
                return;
            }
            if (this.parser.isMultilineBlankGtOne()) {
                return;
            }
            else if (this.parser.is("]")) {
                break;
            }
            else if (this.parser.isNonSomeBlock("image", "caption")) {
                result.mergeState(ResultState.skippable);
                let length = this.parser.skipByBrackets();
                result.addMessage("Figure block should not have other block.", MessageType.error, preIndex, 0, length);
            }

            else if ((blkRes = this.parser.matchMultilineBlank()).matched) {
                result.merge(blkRes);
            }

            else if ((nodeRes = this.parser.matchBlock()).matched) {
                // 只能是 image 或 caption
                result.merge(nodeRes);
                // 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else {
                result.addMessage("Figure block should not have non block contents.", MessageType.error, preIndex, 0, 1);
                result.mergeState(ResultState.skippable);
                this.parser.move();
            }
        }
    }

    // ImageBlockHandler: failing | skippable | successful

    imageBlockHandler(args: Node): NodeResult {
        let result = this.parser.formatLikeBlockHandler("image", this.imageType, args);
        result.discarded = false;
        return result;
    }

    // CaptionHandler: failing | skippable | successful

    captionBlockHandler(args: Node): NodeResult {
        return this.parser.formatLikeBlockHandler("caption", this.captionType, args);
    }

    // **************** Code ****************

    codeBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.codeType, "code-block-handler", this.myCodeBlockHandler, this, this.parser.defaultAnalysis);
    }

    private myCodeBlockHandler(result: NodeResult, args: Node = new Node(this.parser.argumentsType)) {
        let node = result.node;

        result.merge(this.parser.skipBlank());

        let symRes: BasicResult;

        let beginIndex = this.parser.index;
        let count = 0;
        while ((symRes = this.parser.match("`")).matched) {
            result.merge(symRes);
            count++;
        }
        if (count !== 0) {
            result.addHighlight(HighlightType.operator, beginIndex, 0, count);
        }

        result.merge(this.parser.skipBlank());

        result.merge(this.parser.match("\n"));
        if (result.shouldTerminate) {
            result.addMessage("First line should not have codes.", MessageType.error, this.parser.index, 0, 1);
            return;
        }

        let occur = 0;
        while (true) {
            if (this.parser.isEOF()) {
                result.mergeState(ResultState.skippable);
                result.addMessage("Code block ended abruptly.", MessageType.error, beginIndex, 0, this.parser.index - beginIndex);
                return;
            }
            else if (this.parser.is("]")) {
                if (occur >= count) {
                    if (count !== 0) {
                        node.content = node.content.slice(0, -count);
                        result.addHighlight(HighlightType.operator, this.parser.index, -count, 0);
                    }
                    return;
                }
                occur = 0;
                node.content += "]";
                result.merge(this.parser.match("]"));
            }

            else if ((symRes = this.parser.match("`")).matched) {
                result.merge(symRes);
                occur++;
                node.content += "`";
            }

            else {
                result.mergeState(ResultState.successful);
                occur = 0;
                node.content += this.parser.curChar();
                this.parser.move();
            }

        }
    }

    // **************** List ****************

    listBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.listType, "list-block-handler", this.myListBlockHandler.bind(this, args), this);
    }

    private myListBlockHandler(args: Node, result: NodeResult) {
        let nodeRes: NodeResult;
        let preIndex: number;

        result.mergeState(ResultState.successful);

        while (true) {
            preIndex = this.parser.index;

            if (this.parser.isEOF()) {
                return;
            }
            if (this.parser.isMultilineBlankGtOne()) {
                return;
            }
            else if (this.parser.is("]")) {
                break;
            }
            else if (this.parser.isNonSomeBlock(BlockType.basic, BlockType.format, "item")) {
                result.mergeState(ResultState.skippable);
                let length = this.parser.skipByBrackets();
                result.addMessage("List block should not have other block.", MessageType.error, preIndex, 0, length);
            }

            else if ((nodeRes = this.matchFreeItem()).matched) {
                result.merge(nodeRes);
                // 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else if ((nodeRes = this.parser.matchBlock()).matched) {
                // 只能是 item block, format 和 basic 前面处理了
                result.merge(nodeRes);
                // 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else {
                // 理论上不会出现
                throw new LixError("[[Logical Error]] Matching list item and free item failed.");
            }
        }
    }

    cleanupItem(result: NodeResult) {
        result.discarded = (result.analysedNode.content === "" && result.analysedNode.children.length === 0);
    }

    // MatchFreeItem: failing | skippable | successful

    matchFreeItem(): NodeResult {
        let result = this.parser.prepareMatch(this.itemType, "free-item", this.myMatchFreeItem, this, this.cleanupItem);
        return result;
    }

    private myMatchFreeItem(result: NodeResult) {
        let nodeRes: NodeResult;
        let res: BasicResult;

        // result.content.children.push(new Node(this.argumentsType));
        // result.analysedContent.children.push(new Node(this.argumentsType));

        let count = 0;
        while (this.parser.is("*")) {
            result.GuaranteeMatched();
            result.merge(this.parser.match("*"));
            result.node.content += "*";
            result.analysedNode.content += "*";
            count++;
        }
        if (count > 0) {
            result.addHighlight(HighlightType.operator, this.parser.index, -count, 0);
        }

        while (true) {
            if (this.parser.isEOF()) {
                break;
            }
            else if (this.parser.isMultilineBlankGtOne()) {
                break;
            }
            else if (this.parser.is("]")) {
                break;
            }
            else if (this.parser.is("*")) { // includes *, **, ***, ****
                break;
            }
            else if (this.parser.isNonSomeBlock(BlockType.basic, BlockType.format)) {
                break;
            }

            else if ((nodeRes = this.matchListFreeText()).matched) {
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else if ((nodeRes = this.parser.matchBlock()).matched) {
                // 只能是 basic block, format block 在 list free text 中处理了
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // match block 不会失败
                result.mergeNodeToChildren(nodeRes);
            }
            else {
                throw new LixError("[[Logical Error]]Unintended 'else'. Free list match failed.");
            }
        }
    }

    // MatchListFreeText: failing | skippable | successful

    matchListFreeText(): NodeResult {
        return this.parser.prepareMatch(this.parser.textType, "list-free-text", this.myMatchListFreeText, this, this.parser.cleanupText, this.parser);
    }

    private myMatchListFreeText(result: NodeResult) {
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
                node.children.push(new Node(this.parser.wordsType, text, [], preIndex, curIndex));
                analysedNode.children.push(new Node(this.parser.wordsType, text, [], preIndex, curIndex));
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        while (true) {
            curIndex = this.parser.index;

            if (this.parser.isEOF()) {
                mergeWordsNode();
                break;
            }
            else if (this.parser.isMultilineBlankGtOne()) {
                mergeWordsNode();
                break;
            }
            else if (this.parser.is("]")) {
                mergeWordsNode();
                break;
            }
            else if (this.parser.is("*")) { // includes *, **, ***, ****
                mergeWordsNode();
                break;
            }
            else if ((symRes = this.parser.match("\\\\")).matched) {
                mergeWordsNode();
                result.merge(symRes);
                result.GuaranteeMatched();
                result.addHighlight(HighlightType.operator, curIndex, 0, 2);
                break;
            }
            else if (this.parser.isNonSomeBlock(BlockType.format)) {
                mergeWordsNode();
                break;
            }

            else if ((blkRes = this.parser.matchMultilineBlank()).matched) {
                resetIndex();
                result.merge(blkRes);
                result.GuaranteeMatched();
                text += " ";
            }

            else if ((nodeRes = this.parser.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                text += nodeRes.node.content;
            }

            else if ((nodeRes = this.parser.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else if ((nodeRes = this.parser.matchBlock()).matched) {
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
                valRes = this.parser.matchChar();
                result.merge(valRes);
                // 不会失败
                text += valRes.value;
            }
        }
    }

    // ItemBlockHandler: failing | skippable | successful

    itemBlockHandler(args: Node): NodeResult {
        let result = this.parser.paragraphLikeBlockHandler("item", this.itemType, args);
        result.discarded = false;
        return result;
    }

    // **************** Table ****************

    // TextBlockHandler: failing | skippable | successful

    tableBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.tableType, "table-block-handler", this.myTableBlockHandler.bind(this, args), this);
    }

    private myTableBlockHandler(args: Node, result: NodeResult) {
        let nodeRes: NodeResult;
        let res: BasicResult;
        let preIndex: number;

        result.mergeState(ResultState.successful);

        let row = result.addNode(this.cellType, "", [], this.parser.index, 0, 0);
        let analysedRow = result.addAnalysedNode(this.cellType, "", [], this.parser.index, 0, 0);

        while (true) {
            preIndex = this.parser.index;

            if (this.parser.isEOF()) {
                return;
            }
            if (this.parser.isMultilineBlankGtOne()) {
                return;
            }
            else if (this.parser.is("]")) {
                break;
            }
            else if (this.parser.isNonSomeBlock(BlockType.basic, BlockType.format, "cell")) {
                result.mergeState(ResultState.skippable);
                let length = this.parser.skipByBrackets();
                result.addMessage("Table block should not have other block.", MessageType.error, preIndex, 0, length);
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
                
                row = result.addNode(this.cellType, "", [], this.parser.index, 0, 0);
                analysedRow = result.addAnalysedNode(this.cellType, "", [], this.parser.index, 0, 0);
            }

            else if ((nodeRes = this.matchFreeCell()).matched) {
                result.merge(nodeRes);
                // 不会失败
                row.children.push(nodeRes.node);
                if (!nodeRes.discarded) {
                    analysedRow.children.push(nodeRes.analysedNode);
                }
            }

            else if ((nodeRes = this.parser.matchBlock()).matched) {
                // 只能是 cell block, format 和 basic 前面处理了
                result.merge(nodeRes);
                // 不会失败
                row.children.push(nodeRes.node);
                if (!nodeRes.discarded) {
                    analysedRow.children.push(nodeRes.analysedNode);
                }
            }

            else {
                // 理论上不会出现
                throw new LixError("[[Logical Error]] Matching table cell and free cell failed.");
            }
        }
    }

    cleanupCell(result: NodeResult) {
        result.discarded = (result.analysedNode.children.length === 0);
    }

    // MatchFreeCell: failing | skippable | successful

    matchFreeCell(): NodeResult {
        let result = this.parser.prepareMatch(this.cellType, "free-cell", this.myMatchFreeCell, this, this.cleanupCell);
        return result;
    }

    private myMatchFreeCell(result: NodeResult) {
        let nodeRes: NodeResult;
        let res: BasicResult;

        // result.content.children.push(new Node(this.argumentsType));
        // result.analysedContent.children.push(new Node(this.argumentsType));

        while (true) {
            if (this.parser.isEOF()) {
                break;
            }
            else if (this.parser.isMultilineBlankGtOne()) {
                break;
            }
            else if (this.parser.is("]")) {
                break;
            }
            else if (this.parser.is("&")) {
                break;
            }
            else if (this.parser.is(";")) {
                break;
            }
            else if (this.parser.isNonSomeBlock(BlockType.basic, BlockType.format)) {
                break;
            }

            else if ((nodeRes = this.matchTableFreeText()).matched) {
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else if ((nodeRes = this.parser.matchBlock()).matched) {
                // 只能是 basic block, format block 在 table free text 中处理了
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // match block 不会失败
                result.mergeNodeToChildren(nodeRes);
            }
            else {
                throw new LixError("[[Logical Error]]Unintended 'else'. Free cell match failed.");
            }
        }
    }

    // MatchTableFreeText: failing | skippable | successful

    matchTableFreeText(): NodeResult {
        return this.parser.prepareMatch(this.parser.textType, "table-free-text", this.myMatchTableFreeText, this, this.parser.cleanupText, this.parser);
    }

    private myMatchTableFreeText(result: NodeResult) {
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
                node.children.push(new Node(this.parser.wordsType, text, [], preIndex, curIndex));
                analysedNode.children.push(new Node(this.parser.wordsType, text, [], preIndex, curIndex));
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        while (true) {
            curIndex = this.parser.index;

            if (this.parser.isEOF()) {
                mergeWordsNode();
                break;
            }
            else if (this.parser.isMultilineBlankGtOne()) {
                mergeWordsNode();
                break;
            }
            else if (this.parser.is("]")) {
                mergeWordsNode();
                break;
            }
            else if (this.parser.is("&")) {
                mergeWordsNode();
                break;
            }
            else if (this.parser.is(";")) {
                mergeWordsNode();
                break;
            }
            else if ((symRes = this.parser.match("\\\\")).matched) {
                mergeWordsNode();
                result.merge(symRes);
                result.GuaranteeMatched();
                result.addHighlight(HighlightType.operator, curIndex, 0, 2);
                break;
            }
            else if (this.parser.isNonSomeBlock(BlockType.basic, BlockType.format)) {
                mergeWordsNode();
                break;
            }

            else if ((blkRes = this.parser.matchMultilineBlank()).matched) {
                resetIndex();
                result.merge(blkRes);
                result.GuaranteeMatched();
                text += " ";
            }

            else if ((nodeRes = this.parser.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                text += nodeRes.node.content;
            }

            else if ((nodeRes = this.parser.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes);
                result.GuaranteeMatched();
                // 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else if ((nodeRes = this.parser.matchBlock()).matched) {
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
                valRes = this.parser.matchChar();
                result.merge(valRes);
                // 不会失败
                text += valRes.value;
            }
        }
    }

    // CellBlockHandler: failing | skippable | successful

    cellBlockHandler(args: Node): NodeResult {
        let result = this.parser.paragraphLikeBlockHandler("cell", this.cellType, args);
        result.discarded = false;
        return result;
    }
}
