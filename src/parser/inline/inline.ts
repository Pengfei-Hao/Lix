import { Node } from "../../syntax-tree/node";
import { Type } from "../../syntax-tree/type";
import { Module } from "../module";
import { Parser } from "../parser";
import { BasicResult, HighlightType, NodeResult, Reference, Result } from "../result";
import { MessageType } from "../message";
import { ArgumentType, BlockType } from "../block-table";
import { parserExceptionTexts } from "../texts";
import { error } from "../../foundation/error";

export class Inline extends Module {

    // types of syntax tree node

    private documentType: Type;

    private commandType: Type;
    private settingType: Type;
    private settingParameterType: Type;

    private paragraphType: Type;
    textType: Type;
    wordsType: Type;
    private insertionType: Type;
    private escapeCharType: Type;

    private blockType: Type;
    private argumentsType: Type;
    private argumentType: Type;
    private nameType: Type;
    private stringType: Type;
    private numberType: Type;
    private referenceType: Type;

    // errorType: Type;

    constructor(parser: Parser) {
        super(parser);

        // **************** Types ****************

        this.documentType = this.typeTable.add("document");
        this.commandType = this.typeTable.add("command");
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
        // this.errorType = this.typeTable.add("error");
        this.argumentsType = this.typeTable.add("arguments");
        this.argumentType = this.typeTable.add("argument");

        // **************** Structural Blocks ****************

        // blocks
        this.parser.blockTable.add("paragraph", this.paragraphBlockHandler, this, {
            type: BlockType.structural,
            argumentOptions: new Map([
                ["start", { type: ArgumentType.enumeration, options: ["titled", "default"], default: "default" }]
            ]),
            allowReference: false
        });

        // **************** Basic Blocks ****************

        this.parser.blockTable.add("text", this.textBlockHandler, this, {
            type: BlockType.basic,
            argumentOptions: new Map([
                ["start", { type: ArgumentType.enumeration, options: ["indent", "noindent", "auto"], default: "auto" }]
            ]),
            allowReference: false
        });

        // **************** Insertions ****************

        this.parser.insertionTable.add("@", this.referenceInsertionHandler, this);
        //this.insertionHandlerTable.add("&", () => {let r = new Result<Node>(new Node(this.referenceType)); r.state = ResultState.matched ; r.highlights.push(this.getHighlight(HighlightType.operator, 0, 1)); return r });

        // **************** Commands ****************

        this.parser.commandTable.add("#", this.settingCommandHandler, this);
    }

    init() {
    }

    // ************ Document *************

    // MatchDocument: failing | skippable | successful

    matchDocument(): NodeResult {
        return this.parser.prepareMatch(this.documentType, "document", this.myMatchDocument, this);
    }

    private myMatchDocument(result: NodeResult) {
        let nodeRes: NodeResult;

        while (true) {
            if (this.isNoneOfBlocks(BlockType.structural, BlockType.basic, BlockType.format)) {
                result.mergeFailedState();

                result.recoverToSkippable();
                let length = this.parser.skipByBrackets();
                result.addMessage(this.texts.DocumentRequiresStructuralBlocks, MessageType.error, this.sourceText.getIndex(), -length, 0);
            }

            else if ((nodeRes = this.matchCommand()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeBothNodesWithChild(nodeRes);
            }

            else if ((nodeRes = this.matchFreeParagraph()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeBothNodesWithChild(nodeRes);
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 structural block
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

        if (this.sourceText.isEOF()) {
            result.mergeSuccessfulState();
        }
        else {
            error(parserExceptionTexts.LogicalMatchDocumentFailed);
        }
    }

    // **************** Command ****************

    private isCommand(): boolean {
        return this.parser.commandTable.find(name => this.sourceText.isText(name)) !== undefined;
    }

    // MatchCommand: failing | skippable | successful

    private matchCommand(): NodeResult {
        return this.parser.prepareMatch(this.commandType, "command", this.myMatchCommand, this);
    }

    private myMatchCommand(result: NodeResult) {

        let name = this.parser.commandTable.find(name => this.sourceText.isText(name));
        if (name === undefined) {
            result.mergeFailedState();
            return;
        }
        let handler = this.parser.commandTable.getHandler(name)!;
        result.ensureMatched();

        let hdlRes = result.merge(handler());
        if (result.shouldStop) {
            result.recoverToSkippable();
            this.parser.skipLength(name.length);
            return;
        }
        result.mergeNodeWithChildAndAnalysedNodeByTransferring(hdlRes);
    }

    // **************** Block ****************

    // MatchBlock: failing | skippable | successful

    matchBlock(): NodeResult {
        // analyse 在 parse 中一起处理了
        return this.parser.prepareMatch(this.blockType, "block", this.myMatchBlock, this);
    }

    private myMatchBlock(result: NodeResult) {

        let beginIndex = this.sourceText.getIndex();
        result.merge(this.parser.match("["));
        if (result.shouldStop) {
            return;
        }

        result.merge(this.parser.skipBlank());

        let nameIndex = this.sourceText.getIndex();
        let nameRes = result.merge(this.parser.matchNameWithHyphen());
        if (result.shouldStop) {
            return;
        }
        result.setNodeContent(nameRes.value);

        let handler = this.parser.blockTable.getHandler(nameRes.value);
        if (handler === undefined) {
            result.mergeFailedState();
            return;
        }
        result.ensureMatched();
        result.addHighlight(HighlightType.operator, beginIndex, 0, 1);
        result.addHighlight(HighlightType.keyword, nameIndex, 0, nameRes.value.length);

        result.merge(this.parser.skipBlank());

        let argRes = result.merge(this.matchArguments(nameRes.value));
        if (result.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }
        result.mergeBothNodesWithChild(argRes);
        result.references.forEach(value => {
            value.node = result.analysedNode;
        });

        let hdlRes = result.merge(handler(argRes.analysedNode));
        if (result.shouldStop) {
            result.recoverToSkippable();
            this.parser.skipByBrackets(1);
            return;
        }
        result.mergeNodeWithChildAndAnalysedNodeByTransferring(hdlRes);
        result.setDiscarded(hdlRes.discarded);

        let endIndex = this.sourceText.getIndex();
        result.merge(this.parser.match("]"));
        if (result.shouldStop) {
            result.addMessage(this.texts.BlockClosingBracketMissing, MessageType.error, beginIndex, 0, endIndex - beginIndex);
            result.recoverToSkippable();
            if (!this.sourceText.isEOF() && this.parser.isMultilineBlankGtOne()) {
                this.parser.skipByBrackets(1);
            }
            return;
        }
        result.addHighlight(HighlightType.operator, endIndex, 0, 1);
    }

    // MatchArguments: skippable | successful

    private checkAndStandardizeArguments(blockName: string, result: NodeResult) {
        let stdArguments = result.analysedNode;
        let argumentsSpec = this.parser.blockTable.getOption(blockName)!;

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
                error(parserExceptionTexts.ArgumentHasNoValue.format(name));
            }

            let argumentValue = argument.children[0];

            if (argumentValue.type === this.referenceType) {
                if (!argumentsSpec.allowReference) {
                    result.addMessage(this.texts.ReferencesNotAllowedInBlock.format(blockName), MessageType.error, argumentValue);
                    result.mergeFailedState();
                    result.recoverToSkippable();
                    continue;
                }
                if (references.has(argumentValue.content)) {
                    result.addMessage(this.texts.ReferenceDuplicated.format(argumentValue.content), MessageType.error, argumentValue);
                    result.mergeFailedState();
                    result.recoverToSkippable();
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
                    result.mergeFailedState();
                    result.recoverToSkippable();
                }
                if (name === "") {
                    result.addMessage(this.texts.UnknownArgumentImplicitValue.format(argumentValue.content), MessageType.error, argumentValue);
                    result.mergeFailedState();
                    result.recoverToSkippable();
                    continue;
                }
            }

            let spec = argumentsSpec.argumentOptions.get(name);
            if (!spec) {
                result.addMessage(this.texts.ArgumentUnknown.format(name), MessageType.error, argument);
                result.mergeFailedState();
                result.recoverToSkippable();
                continue;
            }

            if (argumentTypeToType.get(spec.type) !== argumentValue.type) {
                result.addMessage(this.texts.ArgumentTypeMismatch.format(name), MessageType.error, argument);
                result.mergeFailedState();
                result.recoverToSkippable();
                continue;
            }

            if (spec.type === ArgumentType.enumeration && spec.options.indexOf(argumentValue.content) === -1) {
                result.addMessage(this.texts.ArgumentEnumerationValueInvalid.format(name), MessageType.error, argument);
                result.mergeFailedState();
                result.recoverToSkippable();
                continue;
            }

            stdArguments.children.find(node => node.content === name)!.children[0].content = argumentValue.content;
        }

        references.forEach(value => {
            stdArguments.children.push(new Node(this.referenceType, value));
            result.references.push(new Reference(value, result.analysedNode));
        });
    }

    private matchArguments(blockName: string): NodeResult {
        return this.parser.prepareMatch(this.argumentsType, "arguments", this.myMatchArguments, this, this.checkAndStandardizeArguments.bind(this, blockName));
    }

    private myMatchArguments(result: NodeResult) {
        let res: BasicResult;
        let nodeRes: NodeResult;

        let beginIndex = this.sourceText.getIndex();
        if ((res = this.parser.match("(")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.addHighlight(HighlightType.operator, beginIndex, 0, 1);

            result.merge(this.parser.skipBlank());

            let preIndex = this.sourceText.getIndex();
            if ((nodeRes = this.matchArgument()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeNodeWithChild(nodeRes);

                result.merge(this.parser.skipBlank());

                while (true) {
                    let commaIndex = this.sourceText.getIndex();
                    result.merge(this.parser.match(","));
                    if (result.shouldStop) {
                        break;
                    }
                    result.addHighlight(HighlightType.operator, commaIndex, 0, 1);

                    result.merge(this.parser.skipBlank());

                    preIndex = this.sourceText.getIndex();
                    nodeRes = result.merge(this.matchArgument());
                    if (result.shouldStop) {
                        result.addMessage(this.texts.ArgumentUnrecognized, MessageType.error, beginIndex, 0, preIndex - beginIndex);
                        result.recoverToSkippable();
                        this.parser.skipToAfter(")");
                        return;
                    }
                    result.mergeNodeWithChild(nodeRes);

                    result.merge(this.parser.skipBlank());
                }
            }
            else {
                result.mergeSuccessfulState();
            }

            preIndex = this.sourceText.getIndex();
            result.merge(this.parser.match(")"));
            if (result.shouldStop) {
                result.addMessage(this.texts.ArgumentsEndedUnexpectedly, MessageType.error, beginIndex, 0, preIndex - beginIndex);

                result.recoverToSkippable();
                return;
            }
            result.addHighlight(HighlightType.operator, preIndex, 0, 1);
        }
        else if ((res = this.parser.match(":")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.addHighlight(HighlightType.operator, beginIndex, 0, 1);
        }
        else {
            result.mergeSuccessfulState();
        }
    }

    // MatchArgument: failed | skippable | successful

    private matchArgument(): NodeResult {
        // 无需 analyse 复制一份
        return this.parser.prepareMatch(this.argumentType, "argument", this.myMatchArgument, this);
    }

    private myMatchArgument(result: NodeResult) {
        let res: BasicResult;
        let valRes: Result<string>;
        let nameRes: Result<string>;

        let beginIndex = this.sourceText.getIndex();
        if ((res = this.parser.match("@")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.addHighlight(HighlightType.operator, beginIndex, 0, 1);

            result.merge(this.parser.skipBlank());

            let nameIndex = this.sourceText.getIndex();
            let nameRes = result.merge(this.parser.matchNameWithHyphen());
            if (result.shouldStop) {
                result.addMessage(this.texts.ReferenceNameMissing, MessageType.error, beginIndex, 0, 1);
                result.recoverToSkippable();
                result.addChild(this.referenceType, nameRes.value, [], beginIndex, 0, 1);
                return;
            }
            result.addChild(this.referenceType, nameRes.value, [], beginIndex, 0, this.sourceText.getIndex() - beginIndex);
            result.addHighlight(HighlightType.keyword, nameIndex, 0, nameRes.value.length);
        }
        else if ((nameRes = this.parser.matchNameWithHyphen()).matched) {
            result.merge(nameRes);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.addHighlight(HighlightType.keyword, beginIndex, 0, nameRes.value.length);

            // This is an 'is' function
            let preIndex = this.sourceText.getIndex();
            this.parser.skipBlank();
            let hasValue = this.sourceText.isText(":");
            this.sourceText.setIndex(preIndex);

            if (hasValue) {
                result.setNodeContent(nameRes.value);

                result.merge(this.parser.skipBlank());

                let colonIndex = this.sourceText.getIndex();
                result.merge(this.parser.match(":"));
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.addHighlight(HighlightType.operator, colonIndex, 0, 1);

                result.merge(this.parser.skipBlank());

                preIndex = this.sourceText.getIndex();
                if ((valRes = this.parser.matchNumber()).matched) {
                    result.merge(valRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.addHighlight(HighlightType.number, preIndex, 0, this.sourceText.getIndex() - preIndex);
                    result.addChild(this.numberType, valRes.value, [], preIndex, 0, this.sourceText.getIndex() - preIndex);
                }
                else if ((valRes = this.parser.matchString()).matched) {
                    result.merge(valRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.addHighlight(HighlightType.string, preIndex, 0, this.sourceText.getIndex() - preIndex);
                    result.addChild(this.stringType, valRes.value, [], preIndex, 0, this.sourceText.getIndex() - preIndex);
                }
                else if ((valRes = this.parser.matchNameWithHyphen()).matched) {
                    result.merge(valRes);
                    result.addHighlight(HighlightType.keyword, preIndex, 0, this.sourceText.getIndex() - preIndex);
                    result.addChild(this.nameType, valRes.value, [], preIndex, 0, this.sourceText.getIndex() - preIndex);
                }
                else {
                    result.mergeFailedState();
                    result.addMessage(this.texts.ArgumentValueMissing, MessageType.error, colonIndex, 0, 1);

                    result.recoverToSkippable();
                    result.addChild(this.nameType, "", [], preIndex, 0, 0);
                }
            }
            else {
                result.addChild(this.nameType, nameRes.value, [], beginIndex, 0, nameRes.value.length);
            }
        }
        else {
            result.mergeFailedState();
            return;
        }
    }

    // IsOneOfBlocks, IsNoneOfBlocks

    private getBlockName(): Result<string> {
        let result = new Result<string>("");
        result.merge(this.parser.match("["));
        if (result.shouldStop) {
            return result;
        }

        result.merge(this.parser.skipBlank());

        let nameRes = this.parser.matchNameWithHyphen();
        result.merge(nameRes);
        if (result.shouldStop) {
            return result;
        }
        result.value = nameRes.value;
        return result;
    }

    isOneOfBlocks(...filters: (string | BlockType)[]): boolean {
        let preIndex = this.sourceText.getIndex();
        let blcRes = this.getBlockName();
        this.sourceText.setIndex(preIndex);
        if (blcRes.matched) {
            let type = this.parser.blockTable.getType(blcRes.value);
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

    isNoneOfBlocks(...filters: (string | BlockType)[]): boolean {
        let preIndex = this.sourceText.getIndex();
        let blcRes = this.getBlockName();
        this.sourceText.setIndex(preIndex);
        if (blcRes.matched) {
            let type = this.parser.blockTable.getType(blcRes.value);
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

    // **************** Text & Paragraph ****************

    // MatchFreeParagraph: failing | skippable | successful

    private cleanupParagraph(result: NodeResult) {
        result.setDiscarded(result.analysedNode.children.length === 0);
    }

    private matchFreeParagraph(): NodeResult {
        return this.parser.prepareMatch(this.paragraphType, "free-paragraph", this.myMatchFreeParagraph, this, this.cleanupParagraph);
    }

    private myMatchFreeParagraph(result: NodeResult) {

        let nodeRes: NodeResult;
        let res: BasicResult;

        if ((res = this.parser.matchMultilineBlankGtOne()).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();
        }
        else {
            if ((nodeRes = this.matchFreeText()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
                result.mergeBothNodesWithChild(nodeRes);
            }
            else if (this.isOneOfBlocks(BlockType.basic) && (nodeRes = this.matchBlock()).matched) {
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
                if ((nodeRes = this.matchFreeText()).matched) {
                    result.merge(nodeRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.ensureMatched();
                    result.mergeBothNodesWithChild(nodeRes);
                }
                else if (this.isOneOfBlocks(BlockType.basic) && (nodeRes = this.matchBlock()).matched) {
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

            if ((res = this.parser.matchMultilineBlankGtOne()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }
            else {
                result.mergeSuccessfulState();
            }
        }
    }

    cleanupText(result: NodeResult) {
        let analNode = result.analysedNode;

        // 一定不含有一个 Arguments 节点
        // word node 的begin end 没改
        if (analNode.children.length === 0) {
            result.setDiscarded(true);
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
            result.setDiscarded(true);
            return;
        }
        node = analNode.children.at(-1)!;
        if (node.type === this.wordsType && node.content.endsWith(" ")) {
            node.content = node.content.slice(0, -1);
            if (node.content.length === 0) {
                analNode.children.splice(-1, 1);
            }
        }
        result.setDiscarded(analNode.children.length === 0);
    }

    // MatchFreeText: failing | skippable | successful

    private matchFreeText(): NodeResult {
        return this.parser.prepareMatch(this.textType, "free-text", this.myMatchFreeText, this, this.cleanupText);
    }

    private myMatchFreeText(result: NodeResult) {

        let text = "";
        let res: BasicResult;
        let valRes: Result<string>;
        let nodeRes: NodeResult;

        let preIndex = 0, curIndex: number;

        const mergeWordsNode = () => {
            if (text !== "") {
                result.addChild(this.wordsType, text, [], preIndex, 0, curIndex - preIndex);
                result.addAnalysedChild(this.wordsType, text, [], preIndex, 0, curIndex - preIndex);
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
            else if (this.sourceText.isText("\\\\")) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }
            else if (this.isNoneOfBlocks(BlockType.format)) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }
            else if (this.isCommand()) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }

            while (true) {
                curIndex = this.sourceText.getIndex();

                if (this.sourceText.isEOF()) {
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
                else if (this.isNoneOfBlocks(BlockType.format)) {
                    mergeWordsNode();
                    break;
                }
                else if (this.isCommand()) {
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

                else if ((nodeRes = this.matchEscapeChar()).matched) {
                    resetIndex();
                    result.merge(nodeRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.ensureMatched();
                    text += nodeRes.node.content;
                }

                else if ((nodeRes = this.matchInsertion()).matched) {
                    mergeWordsNode();
                    result.merge(nodeRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.ensureMatched();
                    result.mergeBothNodesWithChild(nodeRes);
                }

                else if ((nodeRes = this.matchBlock()).matched) {
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
                result.ensureMatched();
                result.addHighlight(HighlightType.operator, this.sourceText.getIndex(), -2, 0);
            }
            else {
                result.mergeSuccessfulState();
            }
        }
    }

    // MatchParFreeText: failing | skippable | successful

    private matchParFreeText(): NodeResult {
        return this.parser.prepareMatch(this.textType, "par-free-text", this.myMatchParFreeText, this, this.cleanupText);
    }

    private myMatchParFreeText(result: NodeResult) {

        let text = "";
        let res: BasicResult;
        let valRes: Result<string>;
        let nodeRes: NodeResult;

        let preIndex = 0, curIndex: number;

        const mergeWordsNode = () => {
            if (text !== "") {
                result.addChild(this.wordsType, text, [], preIndex, 0, curIndex - preIndex);
                result.addAnalysedChild(this.wordsType, text, [], preIndex, 0, curIndex - preIndex);
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
            else if (this.sourceText.isText("\\\\")) {
                mergeWordsNode();
                result.mergeFailedState();
                return;
            }
            else if (this.isNoneOfBlocks(BlockType.format)) {
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

                if (this.sourceText.isEOF()) {
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
                else if (this.isNoneOfBlocks(BlockType.format)) {
                    mergeWordsNode();
                    break;
                }
                else if (this.sourceText.isText("]")) {
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

                else if ((nodeRes = this.matchEscapeChar()).matched) {
                    resetIndex();
                    result.merge(nodeRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.ensureMatched();
                    text += nodeRes.node.content;
                }

                else if ((nodeRes = this.matchInsertion()).matched) {
                    mergeWordsNode();
                    result.merge(nodeRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.ensureMatched();
                    result.mergeBothNodesWithChild(nodeRes);
                }

                else if ((nodeRes = this.matchBlock()).matched) {
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

    // MatchEscapeChar: failing | successful

    matchEscapeChar(): NodeResult {
        return this.parser.prepareMatch(this.escapeCharType, "escape-char", this.myMatchEscapeChar, this, this.parser.defaultAnalysis);
    }

    private myMatchEscapeChar(result: NodeResult) {

        let beginIndex = this.sourceText.getIndex();
        result.merge(this.parser.match("\\"));
        if (result.shouldStop) {
            return;
        }
        result.ensureMatched();

        let valRes = result.merge(this.parser.matchChar());
        if (result.shouldStop) { // EOF
            result.setNodeContent("\\");
            result.addMessage(this.texts.EscapeSequenceIncomplete, MessageType.warning, beginIndex, 0, 1);

            result.recoverToSkippable();
            return;
        }
        switch (valRes.value) {
            case "(": case ")":
            case "[": case "]": case "/": case "#": case "@":
                result.setNodeContent(valRes.value);
                result.addHighlight(HighlightType.operator, beginIndex, 0, 2);
                break;
            default:
                result.setNodeContent("\\" + valRes.value);
                result.addMessage(this.texts.InvalidEscapeSequence.format(valRes.value), MessageType.warning, beginIndex, 0, 2);
                break;
        }

    }

    // MatchInsertion: failing | skippable | successful

    private isInsertion(): boolean {
        return this.parser.insertionTable.find((name) => this.sourceText.isText(name)) !== undefined;
    }

    matchInsertion(): NodeResult {
        // analyse 在 parse 中一起处理了
        return this.parser.prepareMatch(this.insertionType, "insertion", this.myMatchInsertion, this);
    }

    private myMatchInsertion(result: NodeResult) {

        let name = this.parser.insertionTable.find((name) => this.sourceText.isText(name));
        if (name === undefined) {
            result.mergeFailedState();
            return;
        }
        let handler = this.parser.insertionTable.getHandler(name)!;
        result.ensureMatched();

        let hdlRes = result.merge(handler());
        if (result.shouldStop) {
            result.recoverToSkippable();
            this.parser.skipLength(name.length);
            return;
        }
        result.mergeNodeWithChildAndAnalysedNodeByTransferring(hdlRes);
    }

    // **************** Blocks ****************

    // ParagraphBlockHandler: failing | skippable | successful

    private paragraphBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.paragraphType, "paragraph-block-handler", this.myParagraphBlockHandler.bind(this, args, "paragraph"), this, this.cleanupParagraph);
    }

    paragraphLikeBlockHandler(blockName: string, type: Type, args: Node): NodeResult {
        let result = this.parser.prepareMatch(this.paragraphType, `${blockName}-block-handler`, this.myParagraphBlockHandler.bind(this, args, blockName), this, this.cleanupParagraph);
        result.setNodeType(type);
        result.setAnalysedNodeType(type);
        return result;
    }

    private myParagraphBlockHandler(args: Node, blockName: string, result: NodeResult) {

        let nodeRes: NodeResult;
        let preIndex: number;

        while (true) {
            preIndex = this.sourceText.getIndex();

            if (this.isNoneOfBlocks(BlockType.basic, BlockType.format)) {
                result.mergeFailedState();

                result.recoverToSkippable();
                let length = this.parser.skipByBrackets();
                result.addMessage(this.texts.ParagraphDisallowsOtherBlocks, MessageType.error, preIndex, 0, length);
            }
            else if ((nodeRes = this.matchParFreeText()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeBothNodesWithChild(nodeRes);
            }
            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 basic block, format block 在 par free text 中处理了
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

    // TextBlockHandler: failing | skippable | successful

    private textBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.textType, "text-block-handler", this.myTextBlockHandler.bind(this, args), this, this.cleanupText);
    }

    textLikeBlockHandler(blockName: string, type: Type, args: Node): NodeResult {
        let result = this.parser.prepareMatch(this.textType, `${blockName}-block-handler`, this.myTextBlockHandler.bind(this, args), this, this.cleanupText);
        result.setNodeType(type);
        result.setAnalysedNodeType(type);
        return result;
    }

    private myTextBlockHandler(args: Node, result: NodeResult) {

        let text = "";
        let res: BasicResult;
        let valRes: Result<string>;
        let nodeRes: NodeResult;

        let preIndex = 0, curIndex: number;

        const mergeWordsNode = () => {
            if (text !== "") {
                result.addChild(this.wordsType, text, [], preIndex, 0, curIndex - preIndex);
                result.addAnalysedChild(this.wordsType, text, [], preIndex, 0, curIndex - preIndex);
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        while (true) {
            curIndex = this.sourceText.getIndex();

            if (this.sourceText.isEOF()) {
                mergeWordsNode();
                break;
            }
            else if (this.parser.isMultilineBlankGtOne()) {
                mergeWordsNode();
                break;
            }
            else if (this.sourceText.isText("]")) {
                mergeWordsNode();
                break;
            }
            else if ((res = this.parser.match("\\\\")).matched) {
                resetIndex();
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeFailedState();
                result.addMessage(this.texts.TextDisallowsLineBreakEscape, MessageType.warning, curIndex, 0, 2);

                result.recoverToSkippable();
                text += "\\\\";
            }
            else if (this.isNoneOfBlocks(BlockType.format)) {
                mergeWordsNode();
                result.mergeFailedState();

                result.recoverToSkippable();
                let length = this.parser.skipByBrackets();
                result.addMessage(this.texts.TextDisallowsNonFormatBlocks, MessageType.error, curIndex, 0, length);
            }

            else if ((res = this.parser.matchMultilineBlankLeqOne()).matched) {
                resetIndex();
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                text += " ";
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                text += nodeRes.node.content;
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeBothNodesWithChild(nodeRes);
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 format block 前边判断过
                mergeWordsNode();
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeBothNodesWithChild(nodeRes);
            }

            else {
                resetIndex();
                valRes = result.merge(this.parser.matchChar());
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                text += valRes.value;
            }
        }
    }

    // FormatLikeBlockHandler: failing | skippable | successful

    formatLikeBlockHandler(blockName: string, type: Type, args: Node): NodeResult {
        let result = this.parser.prepareMatch(this.textType, `${blockName}-block-handler`, this.myFormatLikeBlockHandler.bind(this, blockName, args), this, this.cleanupText);
        result.node.type = type;
        result.analysedNode.type = type;
        return result;
    }

    private myFormatLikeBlockHandler(blockName: string, args: Node, result: NodeResult) {

        let text = "";
        let res: BasicResult;
        let valRes: Result<string>;
        let nodeRes: NodeResult;

        let preIndex = 0, curIndex: number;

        const mergeWordsNode = () => {
            if (text !== "") {
                result.addChild(this.wordsType, text, [], preIndex, 0, curIndex - preIndex);
                result.addAnalysedChild(this.wordsType, text, [], preIndex, 0, curIndex - preIndex);
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        while (true) {
            curIndex = this.sourceText.getIndex();

            if (this.sourceText.isEOF()) {
                mergeWordsNode();
                break;
            }
            else if (this.parser.isMultilineBlankGtOne()) {
                mergeWordsNode();
                break;
            }

            else if (this.sourceText.isText("]")) {
                mergeWordsNode();
                break;
            }
            else if ((res = this.parser.match("\\\\")).matched) {
                resetIndex();
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeFailedState();
                result.addMessage(this.texts.FormatDisallowsLineBreakEscape, MessageType.warning, curIndex, 0, 2);

                result.recoverToSkippable();
                text += "\\\\";
            }
            else if (this.isNoneOfBlocks()) {
                mergeWordsNode();
                result.mergeFailedState();

                result.recoverToSkippable();
                let length = this.parser.skipByBrackets();
                result.addMessage(this.texts.FormatDisallowsNestedBlocks, MessageType.error, curIndex, 0, length);
            }

            else if ((res = this.parser.matchMultilineBlankLeqOne()).matched) {
                resetIndex();
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                text += " ";
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                text += nodeRes.node.content;
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeBothNodesWithChild(nodeRes);
            }

            else {
                resetIndex();
                valRes = this.parser.matchChar();
                result.merge(valRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                text += valRes.value;
            }
        }
    }

    // **************** Commands ****************

    // SettingCommandHandler: failing | skippable | successful

    private settingCommandHandler(): NodeResult {
        return this.parser.prepareMatch(this.settingType, "setting", this.mySettingCommandHandler, this, this.parser.defaultAnalysis);
    }

    private mySettingCommandHandler(result: NodeResult) {
        let hashIndex = this.sourceText.getIndex();
        result.merge(this.parser.match("#"));
        if (result.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }
        result.addHighlight(HighlightType.operator, hashIndex, 0, 1);

        result.merge(this.parser.skipBlank());

        let nameIndex = this.sourceText.getIndex();
        let nameRes = result.merge(this.parser.matchNameWithHyphen());
        if (result.shouldStop) {
            result.addMessage(this.texts.SettingNameMissing, MessageType.error, hashIndex, 0, 1);

            result.recoverToSkippable();
            this.parser.skipToEndOfLine();
            result.addChild(this.settingParameterType, "", [], nameIndex, 0, 0);
            return;
        }
        result.addHighlight(HighlightType.keyword, nameIndex, 0, nameRes.value.length);
        result.setNodeContent(nameRes.value);

        result.merge(this.parser.skipBlank());

        let colonIndex = this.sourceText.getIndex();
        result.merge(this.parser.match(":"));
        if (result.shouldStop) {
            result.addMessage(this.texts.SettingColonMissing, MessageType.error, nameIndex, 0, nameRes.value.length);

            result.recoverToSkippable();
            this.parser.skipToEndOfLine();
            result.addChild(this.settingParameterType, "", [], colonIndex, 0, 0);
            return;
        }
        result.addHighlight(HighlightType.operator, colonIndex, 0, 1);

        let commandIndex = this.sourceText.getIndex();
        let command = "";
        while (true) {
            if (this.sourceText.isEOF()) {
                break;
            }
            else if (this.sourceText.isNewline()) {
                break;
            }
            else {
                let valRes = result.merge(this.parser.matchChar());
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                command += valRes.value;
            }

        }
        result.addChild(this.settingParameterType, command, [], commandIndex, 0, command.length);
    }

    // **************** Insertions ****************

    // ReferenceInsertionHandler: failing | skippable | successful

    private referenceInsertionHandler(): NodeResult {
        return this.parser.prepareMatch(this.referenceType, "reference", this.myReferenceInsertionHandler, this, this.parser.defaultAnalysis);
    }

    private myReferenceInsertionHandler(result: NodeResult) {

        let res: BasicResult;

        let beginIndex = this.sourceText.getIndex();
        result.merge(this.parser.match("@"));
        if (result.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }
        result.addHighlight(HighlightType.operator, beginIndex, 0, 1);

        result.merge(this.parser.skipBlank());

        let nameIndex = this.sourceText.getIndex();
        let nameRes = result.merge(this.parser.matchNameWithHyphen());
        if (result.shouldStop) {
            result.recoverToSkippable();
            result.addMessage(this.texts.ReferenceNameMissing, MessageType.error, beginIndex, 0, 1);
            return;
        }
        result.setNodeContent(nameRes.value);
        result.addHighlight(HighlightType.keyword, nameIndex, 0, nameRes.value.length);

        result.merge(this.parser.skipBlank());

        let endIndex = this.sourceText.getIndex();
        if ((res = this.parser.match(";")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.addHighlight(HighlightType.operator, endIndex, 0, 1);
        }
        else {
            result.mergeSuccessfulState();
        }
    }


    // **************** Analyse ****************

    getArgument(args: Node, name: string): string {
        let found: string | undefined;
        args.children.forEach(argNode => {
            if (argNode.type === this.argumentType && argNode.content === name) {
                found = argNode.children[0].content;
            }
        });
        if (found === undefined) {
            error(parserExceptionTexts.ArgumentNotFound);
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
}
