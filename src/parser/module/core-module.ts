import { Config } from "../../common/config";
import { Path } from "../../common/file-system/path";
import { HighlightType } from "../../common/result/highlight";
import { MessageType } from "../../common/result/message";
import { MatchResult, MergeStrategy, NodeResult } from "../../common/result/parsing-result";
import { Result } from "../../common/result/result";
import { Index, Range, SourceText } from "../../common/source-text";
import { Node } from "../../common/syntax-tree/node";
import { Type, TypeTable } from "../../common/syntax-tree/type-table";
import { error } from "../../foundation/error";
import { ArgumentType, BlockType } from "../table/block-table";
import { parserExceptionTexts, ParserTexts } from "../texts";
import { Module } from "./module";
import { ParserModule } from "./parser-module";

export class CoreModule extends Module {

    private parserModule: ParserModule

    // Types

    private documentType: Type;

    private commandType: Type;
    private insertionType: Type;
    private embedmentType: Type;

    private paragraphType: Type;
    private textType: Type;
    private wordsType: Type;
    private escapeCharType: Type;

    private blockType: Type;
    private argumentsType: Type;
    private argumentType: Type;
    private nameType: Type;
    private stringType: Type;
    private numberType: Type;

    private settingType: Type;
    private settingParameterType: Type;
    private newlineType: Type;
    private referenceType: Type;

    constructor(config: Config, path: Path, texts: ParserTexts, typeTable: TypeTable, sourceText: SourceText, parserModule: ParserModule) {
        super(config, path, texts, typeTable, sourceText);
        this.parserModule = parserModule;

        // **************** Types ****************

        this.documentType = this.typeTable.add("document");

        this.commandType = this.typeTable.add("command");
        this.insertionType = this.typeTable.add("insertion");
        this.embedmentType = this.typeTable.add("embedment");

        this.paragraphType = this.typeTable.add("paragraph");
        this.textType = this.typeTable.add("text");
        this.wordsType = this.typeTable.add("words");
        this.escapeCharType = this.typeTable.add("escape-char");

        this.blockType = this.typeTable.add("block");
        this.argumentsType = this.typeTable.add("arguments");
        this.argumentType = this.typeTable.add("argument");
        this.nameType = this.typeTable.add("name");
        this.stringType = this.typeTable.add("string");
        this.numberType = this.typeTable.add("number");

        this.settingType = this.typeTable.add("setting");
        this.settingParameterType = this.typeTable.add("setting-parameter");
        this.newlineType = this.typeTable.add("newline");
        this.referenceType = this.typeTable.add("reference");

        // **************** Structural Blocks ****************

        this.parserModule.blockTable.add("paragraph", this.paragraphBlockHandler, this, {
            type: BlockType.structural,
            argumentOptions: new Map([
                ["start", { type: ArgumentType.enumeration, options: ["titled", "default"], default: "default" }]
            ]),
            allowReference: false
        });

        // **************** Basic Blocks ****************

        this.parserModule.blockTable.add("text", this.textBlockHandler, this, {
            type: BlockType.basic,
            argumentOptions: new Map([
                ["start", { type: ArgumentType.enumeration, options: ["indent", "noindent", "auto"], default: "auto" }]
            ]),
            allowReference: false
        });

        // **************** Commands ****************

        this.parserModule.commandTable.add("#", this.settingCommandHandler, this);

        // **************** Embedment ****************

        parserModule.embedmentTable.add("\\\\", this.newlineEmbedmentHandler, this);

        // **************** Insertions ****************

        this.parserModule.insertionTable.add("@", this.referenceInsertionHandler, this, {
            onlyInText: false
        });
        //this.insertionHandlerTable.add("&", () => {let r = new Result<Node>(new Node(this.referenceType)); r.state = ResultState.matched ; r.highlights.push(this.getHighlight(HighlightType.operator, 0, 1)); return r });
    }

    init() {
    }

    // ************ Document *************

    // MatchDocument: failing | skippable | successful

    matchDocument(): NodeResult {
        return this.prepareMatch(this.documentType, "document", this.myMatchDocument, this);
    }

    private myMatchDocument(result: NodeResult) {

        let res: MatchResult<null>;
        let nodeRes: NodeResult;

        while (true) {
            if (this.isNoneOfBlocks(BlockType.structural, BlockType.basic, BlockType.format)) {
                result.mergeFailedState();

                result.recoverToSkippable();
                let range = this.parserModule.skipByBrackets();
                result.messageList.add(this.texts.DocumentRequiresStructuralBlocks, range, MessageType.error);
            }

            else if ((nodeRes = this.matchCommand()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchFreeParagraph()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((res = this.parserModule.matchMultilineBlankGtOne()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 structural block
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
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
        return this.parserModule.commandTable.find(this.sourceText.isOneOfTexts, this.sourceText) !== undefined;
    }

    // MatchCommand: failing | (matched) | skippable | successful

    private matchCommand(): NodeResult {
        return this.prepareMatch(this.commandType, "command", this.myMatchCommand, this);
    }

    private myMatchCommand(result: NodeResult) {

        let name = this.parserModule.commandTable.find(this.sourceText.isOneOfTexts, this.sourceText);
        if (name === undefined) {
            result.mergeFailedState();
            return;
        }
        let handler = this.parserModule.commandTable.getHandler(name)!;
        result.ensureMatched();

        let hdlRes = result.merge(handler(), MergeStrategy.AppendChild, MergeStrategy.Transfer);
        result.setDiscarded(hdlRes.discarded);
        if (result.shouldStop) {
            result.recoverToSkippable();
            this.parserModule.skipText(name);
            return;
        }
    }

    // **************** Embedment ****************

    private isEmbedment(): boolean {
        return this.parserModule.embedmentTable.find(this.sourceText.isOneOfTexts, this.sourceText) !== undefined;
    }

    // MatchEmbedment: failing | (matched) | skippable | successful

    private matchEmbedment(): NodeResult {
        return this.prepareMatch(this.embedmentType, "embedment", this.myMatchEmbedment, this);
    }

    private myMatchEmbedment(result: NodeResult) {

        let name = this.parserModule.embedmentTable.find(this.sourceText.isOneOfTexts, this.sourceText);
        if (name === undefined) {
            result.mergeFailedState();
            return;
        }
        let handler = this.parserModule.embedmentTable.getHandler(name)!;
        result.ensureMatched();

        let hdlRes = result.merge(handler(), MergeStrategy.AppendChild, MergeStrategy.Transfer);
        result.setDiscarded(hdlRes.discarded);
        if (result.shouldStop) {
            result.recoverToSkippable();
            this.parserModule.skipText(name);
            return;
        }
    }

    // **************** Insertion ****************

    // MatchInsertion: failing | (matched) | skippable | successful

    private isInsertion(): boolean {
        return this.parserModule.insertionTable.find(this.sourceText.isOneOfTexts, this.sourceText) !== undefined;
    }

    private isTextInsertion(): boolean {
        let name = this.parserModule.insertionTable.find(this.sourceText.isOneOfTexts, this.sourceText);
        let options = name !== undefined ? this.parserModule.insertionTable.getOptions(name) : undefined;
        return options !== undefined ? options.onlyInText : false;
    }

    private getInsertionName(): string | undefined {
        return this.parserModule.insertionTable.find(this.sourceText.isOneOfTexts, this.sourceText);
    }

    private matchInsertion(): NodeResult {
        return this.prepareMatch(this.insertionType, "insertion", this.myMatchInsertion, this);
    }

    private myMatchInsertion(result: NodeResult) {

        let name = this.parserModule.insertionTable.find(this.sourceText.isOneOfTexts, this.sourceText);
        if (name === undefined) {
            result.mergeFailedState();
            return;
        }
        let handler = this.parserModule.insertionTable.getHandler(name)!;
        result.ensureMatched();

        let hdlRes = result.merge(handler(), MergeStrategy.AppendChild, MergeStrategy.Transfer);
        result.setDiscarded(hdlRes.discarded);
        if (result.shouldStop) {
            result.recoverToSkippable();
            this.parserModule.skipText(name);
            return;
        }
    }


    // **************** Block ****************

    // MatchBlock: failing | (matched) | skippable | successful

    private matchBlock(): NodeResult {
        // analyse 在 parse 中一起处理了
        return this.prepareMatch(this.blockType, "block", this.myMatchBlock, this);
    }

    private myMatchBlock(result: NodeResult) {

        let res: MatchResult<null>;
        let nameRes: MatchResult<string>;

        let beginIndex = this.sourceText.mark();
        res = result.merge(this.parserModule.match("["));
        if (result.shouldStop) {
            return;
        }

        result.merge(this.parserModule.skipBlank());

        nameRes = result.merge(this.parserModule.matchNameWithHyphen());
        result.setNodeContent(nameRes.value);
        if (result.shouldStop) {
            return;
        }

        let handler = this.parserModule.blockTable.getHandler(nameRes.value);
        if (handler === undefined) {
            result.mergeFailedState();
            return;
        }
        result.ensureMatched();
        result.highlightList.add(HighlightType.operator, res.range);
        result.highlightList.add(HighlightType.keyword, nameRes.range);

        result.merge(this.parserModule.skipBlank());

        let argRes = result.merge(this.matchArguments(nameRes.value, result.analysedNode), MergeStrategy.AppendChild, MergeStrategy.AppendChild);
        if (result.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }

        let hdlRes = result.merge(handler(argRes.analysedNode), MergeStrategy.AppendChild, MergeStrategy.Transfer);
        result.setDiscarded(hdlRes.discarded);
        if (result.shouldStop) {
            result.recoverToSkippable();
            this.parserModule.skipByBrackets(1);
            return;
        }

        res = result.merge(this.parserModule.match("]"));
        if (result.shouldStop) {
            result.messageList.add(this.texts.BlockClosingBracketMissing, this.sourceText.computeRange(beginIndex), MessageType.error);

            result.recoverToSkippable();
            this.parserModule.skipByBrackets(1);
            return;
        }
        result.highlightList.add(HighlightType.operator, res.range);
    }

    // MatchInvalidBlock: failing | (matched) | skippable

    private matchInvalidBlock(): NodeResult {
        return this.prepareMatch(this.blockType, "invalid-block", this.myMatchInvalidBlock, this);
    }

    private myMatchInvalidBlock(result: NodeResult) {

        let res: Result;
        let valRes: MatchResult<string>;

        let beginIndex = this.sourceText.mark();
        result.merge(this.parserModule.match("["));
        if (result.shouldStop) {
            return;
        }
        result.setNodeContent("[");
        result.ensureMatched();

        let bracketsCount = 1;
        while (true) {
            if (this.sourceText.isEOF()) {
                break;
            }
            else if (this.parserModule.isMultilineBlankGtOne()) {
                break;
            }
            else if ((res = this.parserModule.match("[")).matched) {
                result.merge(res);
                bracketsCount++;
                result.appendNodeContent("[");
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else if ((res = this.parserModule.match("]")).matched) {
                result.merge(res);
                bracketsCount--;
                result.appendNodeContent("]");
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }

                if (bracketsCount === 0) {
                    break;
                }
            }
            else if ((valRes = this.parserModule.matchChar()).matched) {
                result.merge(valRes);
                result.appendNodeContent(valRes.value);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                error(parserExceptionTexts.LogicalUnexpectedBranch);
            }
        }
        result.mergeFailedState();

        result.recoverToSkippable();
        result.setDiscarded(true);
        result.messageList.add(this.texts.BlockUnrecognized, this.sourceText.computeRange(beginIndex), MessageType.error);
    }

    // MatchArguments: skippable | successful

    private checkAndStandardizeArguments(blockName: string, referenceNode: Node, result: NodeResult) {
        let stdArguments = result.analysedNode;
        let argumentsSpec = this.parserModule.blockTable.getOption(blockName)!;

        const argumentTypeToType: Map<ArgumentType, Type> = new Map([[ArgumentType.string, this.stringType], [ArgumentType.number, this.numberType], [ArgumentType.enumeration, this.nameType]]);

        for (let [name, spec] of argumentsSpec.argumentOptions) {
            let stdArgument = new Node(this.argumentType, this.sourceText.emptyRange, name);
            stdArgument.children.push(new Node(argumentTypeToType.get(spec.type)!, this.sourceText.emptyRange, spec.default));
            stdArguments.children.push(stdArgument);
        }

        // 可以避免重复输入参数或者少输入参数带来的问题

        let references: Set<string> = new Set();
        let referenceRanges: Map<string, Range> = new Map();

        for (let argument of result.node.children) {
            let name = argument.content;
            if (argument.children.length !== 1) {
                error(parserExceptionTexts.LogicalUnexpectedNodeStruture);
            }

            let argumentValue = argument.children[0];

            if (argumentValue.type === this.referenceType) {
                if (!argumentsSpec.allowReference) {
                    result.messageList.add(this.texts.ReferencesNotAllowedInBlock.format(blockName), argumentValue.range, MessageType.error);
                    result.mergeFailedState();
                    result.recoverToSkippable();
                    continue;
                }
                if (references.has(argumentValue.content)) {
                    result.messageList.add(this.texts.ReferenceDuplicated.format(argumentValue.content), argumentValue.range, MessageType.error);
                    result.mergeFailedState();
                    result.recoverToSkippable();
                }
                references.add(argumentValue.content);
                referenceRanges.set(argumentValue.content, argumentValue.range);
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
                    result.messageList.add(this.texts.UnknownArgumentImplicitValueNotUnique.format(argumentValue.content), argumentValue.range, MessageType.error);
                    result.mergeFailedState();
                    result.recoverToSkippable();
                }
                if (name === "") {
                    result.messageList.add(this.texts.UnknownArgumentImplicitValue.format(argumentValue.content), argumentValue.range, MessageType.error);
                    result.mergeFailedState();
                    result.recoverToSkippable();
                    continue;
                }
            }

            let spec = argumentsSpec.argumentOptions.get(name);
            if (!spec) {
                result.messageList.add(this.texts.ArgumentUnknown.format(name), argument.range, MessageType.error);
                result.mergeFailedState();
                result.recoverToSkippable();
                continue;
            }

            if (argumentTypeToType.get(spec.type) !== argumentValue.type) {
                result.messageList.add(this.texts.ArgumentTypeMismatch.format(name), argument.range, MessageType.error);
                result.mergeFailedState();
                result.recoverToSkippable();
                continue;
            }

            if (spec.type === ArgumentType.enumeration && spec.options.indexOf(argumentValue.content) === -1) {
                result.messageList.add(this.texts.ArgumentEnumerationValueInvalid.format(name), argument.range, MessageType.error);
                result.mergeFailedState();
                result.recoverToSkippable();
                continue;
            }

            let stdNode = stdArguments.children.find(node => node.content === name)!;
            stdNode.range = argument.range;
            stdNode.children[0].content = argumentValue.content;
            stdNode.children[0].range = argumentValue.range;
        }

        references.forEach(value => {
            stdArguments.children.push(new Node(this.referenceType, referenceRanges.get(value)!, value));
            result.referenceList.add(value, referenceNode);
        });
    }

    private matchArguments(blockName: string, referenceNode: Node): NodeResult {
        return this.prepareMatch(this.argumentsType, "arguments", this.myMatchArguments, this, this.checkAndStandardizeArguments.bind(this, blockName, referenceNode));
    }

    private myMatchArguments(result: NodeResult) {

        let res: MatchResult<null>;
        let nodeRes: NodeResult;

        let beginIndex = this.sourceText.mark();
        if ((res = this.parserModule.match("(")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.highlightList.add(HighlightType.operator, res.range);

            result.merge(this.parserModule.skipBlank());

            if ((nodeRes = this.matchArgument()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.None);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }

                result.merge(this.parserModule.skipBlank());

                while (true) {
                    res = result.merge(this.parserModule.match(","));
                    if (result.shouldStop) {
                        break;
                    }
                    result.highlightList.add(HighlightType.operator, res.range);

                    result.merge(this.parserModule.skipBlank());

                    nodeRes = result.merge(this.matchArgument(), MergeStrategy.AppendChild, MergeStrategy.None);
                    if (result.shouldStop) {
                        result.messageList.add(this.texts.ArgumentUnrecognized, res.range, MessageType.error);

                        result.recoverToSkippable();
                        this.parserModule.skipToAfter(")");
                        return;
                    }

                    result.merge(this.parserModule.skipBlank());
                }
            }
            else {
                result.mergeSuccessfulState();
            }

            res = result.merge(this.parserModule.match(")"));
            if (result.shouldStop) {
                result.messageList.add(this.texts.ArgumentsEndedUnexpectedly, this.sourceText.computeRange(beginIndex), MessageType.error);

                result.recoverToSkippable();
                return;
            }
            result.highlightList.add(HighlightType.operator, res.range);
        }
        else if ((res = this.parserModule.match(":")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.highlightList.add(HighlightType.operator, res.range);
        }
        else {
            result.mergeSuccessfulState();
        }
    }

    // MatchArgument: failed | skippable | successful

    private matchArgument(): NodeResult {
        // 无需 analyse 复制一份
        return this.prepareMatch(this.argumentType, "argument", this.myMatchArgument, this);
    }

    private myMatchArgument(result: NodeResult) {
        let res: MatchResult<null>;
        let valRes: MatchResult<string>;
        let nameRes: MatchResult<string>;

        let beginIndex = this.sourceText.mark();
        if ((res = this.parserModule.match("@")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.highlightList.add(HighlightType.operator, res.range);

            result.merge(this.parserModule.skipBlank());

            let nameRes = result.merge(this.parserModule.matchNameWithHyphen());
            if (result.shouldStop) {
                result.messageList.add(this.texts.ReferenceNameMissing, res.range, MessageType.error);

                result.recoverToSkippable();
                this.parserModule.skipTo(",");
                result.addChild(this.referenceType, res.range, nameRes.value, []);
                return;
            }
            result.addChild(this.referenceType, this.sourceText.computeRange(beginIndex), nameRes.value, []);
            result.highlightList.add(HighlightType.keyword, nameRes.range);
        }
        else if ((nameRes = this.parserModule.matchNameWithHyphen()).matched) {
            result.merge(nameRes);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.highlightList.add(HighlightType.keyword, nameRes.range);

            // This is an 'is' function
            let preIndex = this.sourceText.mark();
            this.parserModule.skipBlank();
            let hasValue = this.sourceText.isText(":");
            this.sourceText.recover(preIndex);

            if (hasValue) {
                result.setNodeContent(nameRes.value);

                result.merge(this.parserModule.skipBlank());

                res = result.merge(this.parserModule.match(":"));
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.highlightList.add(HighlightType.operator, res.range);

                result.merge(this.parserModule.skipBlank());

                if ((valRes = this.parserModule.matchNumber()).matched) {
                    result.merge(valRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.highlightList.add(HighlightType.number, valRes.range);
                    result.addChild(this.numberType, valRes.range, valRes.value, []);
                }
                else if ((valRes = this.parserModule.matchString()).matched) {
                    result.merge(valRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.highlightList.add(HighlightType.string, valRes.range);
                    result.addChild(this.stringType, valRes.range, valRes.value, []);
                }
                else if ((valRes = this.parserModule.matchNameWithHyphen()).matched) {
                    result.merge(valRes);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.highlightList.add(HighlightType.keyword, valRes.range);
                    result.addChild(this.nameType, valRes.range, valRes.value, []);
                }
                else {
                    result.mergeFailedState();
                    result.messageList.add(this.texts.ArgumentValueMissing, res.range, MessageType.error);

                    result.recoverToSkippable();
                    this.parserModule.skipTo(",");
                    result.addChild(this.nameType, res.range, "", []);
                }
            }
            else {
                result.addChild(this.nameType, nameRes.range, nameRes.value, []);
            }
        }
        else {
            result.mergeFailedState();
            return;
        }
    }

    // IsOneOfBlocks, IsNoneOfBlocks

    private getBlockName(): MatchResult<string> {
        let result = new MatchResult<string>("", this.sourceText.emptyRange);
        result.merge(this.parserModule.match("["));
        if (result.shouldStop) {
            return result;
        }

        result.merge(this.parserModule.skipBlank());

        let nameRes = this.parserModule.matchNameWithHyphen();
        result.merge(nameRes);
        if (result.shouldStop) {
            return result;
        }
        result.value = nameRes.value;
        return result;
    }

    isOneOfBlocks(...filters: (string | BlockType)[]): boolean {
        let preIndex = this.sourceText.mark();
        let blcRes = this.getBlockName();
        this.sourceText.recover(preIndex);
        if (blcRes.matched) {
            let type = this.parserModule.blockTable.getType(blcRes.value);
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
        let preIndex = this.sourceText.mark();
        let blcRes = this.getBlockName();
        this.sourceText.recover(preIndex);
        if (blcRes.matched) {
            let type = this.parserModule.blockTable.getType(blcRes.value);
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

    // MatchFreeParagraph: failing | (matched) | skippable | successful

    private cleanupParagraph(args: Node | undefined, result: NodeResult) {
        result.setDiscarded(result.analysedNode.children.length === 0);
    }

    private matchFreeParagraph(): NodeResult {
        return this.prepareMatch(this.paragraphType, "free-paragraph", this.myMatchFreeParagraph, this, this.cleanupParagraph.bind(this, undefined));
    }

    private myMatchFreeParagraph(result: NodeResult) {

        let nodeRes: NodeResult;

        if ((nodeRes = this.matchFreeText()).matched) {
            result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();
        }
        else if (this.isOneOfBlocks(BlockType.basic) && (nodeRes = this.matchBlock()).matched) {
            result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();
        }
        else if ((nodeRes = this.matchEmbedment()).matched) {
            result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();
        }
        else {
            result.mergeFailedState();
            return;
        }

        while (true) {
            if ((nodeRes = this.matchFreeText()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }
            else if (this.isOneOfBlocks(BlockType.basic) && (nodeRes = this.matchBlock()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }
            else if ((nodeRes = this.matchEmbedment()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }
            else {
                break;
            }
        }
    }

    private cleanupText(args: Node | undefined, result: NodeResult) {

        let analNode = result.analysedNode;

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
                preNode.range = this.sourceText.unionRange(preNode.range, node.range);
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

    // MatchFreeText: failing | (matched) | skippable | successful

    private matchFreeText(): NodeResult {
        return this.prepareMatch(this.textType, "free-text", this.myMatchFreeText, this, this.cleanupText.bind(this, undefined));
    }

    private myMatchFreeText(result: NodeResult) {

        let text = "";
        let res: Result;
        let valRes: MatchResult<string>;
        let nodeRes: NodeResult;

        let preIndex: Index, curIndex: Index;

        const mergeWordsNode = () => {
            if (text !== "") {
                result.addChild(this.wordsType, this.sourceText.computeRange(preIndex, curIndex), text, []);
                result.addAnalysedChild(this.wordsType, this.sourceText.computeRange(preIndex, curIndex), text, []);
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        if (this.sourceText.isEOF()) {
            mergeWordsNode();
            result.mergeFailedState();
            return;
        }
        else if (this.parserModule.isMultilineBlankGtOne()) {
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
        else if (this.isEmbedment()) {
            mergeWordsNode();
            result.mergeFailedState();
            return;
        }

        while (true) {
            curIndex = this.sourceText.mark();

            if (this.sourceText.isEOF()) {
                mergeWordsNode();
                break;
            }
            else if (this.parserModule.isMultilineBlankGtOne()) {
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
            else if (this.isEmbedment()) {
                mergeWordsNode();
                break;
            }

            else if ((res = this.parserModule.matchMultilineBlankLeqOne()).matched) {
                resetIndex();
                result.merge(res);
                text += " ";
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                text += nodeRes.node.content;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 format block
                mergeWordsNode();
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchInvalidBlock()).matched) {
                resetIndex();
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                text += nodeRes.node.content;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((valRes = this.parserModule.matchChar()).matched) {
                resetIndex();
                result.merge(valRes);
                text += valRes.value;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else {
                error(parserExceptionTexts.LogicalUnexpectedBranch);
            }
        }
    }

    // MatchParFreeText: failing | (matched) | skippable | successful

    private matchParFreeText(): NodeResult {
        return this.prepareMatch(this.textType, "par-free-text", this.myMatchParFreeText, this, this.cleanupText.bind(this, undefined));
    }

    private myMatchParFreeText(result: NodeResult) {

        let text = "";
        let res: Result;
        let valRes: MatchResult<string>;
        let nodeRes: NodeResult;

        let preIndex: Index, curIndex: Index;

        const mergeWordsNode = () => {
            if (text !== "") {
                result.addChild(this.wordsType, this.sourceText.computeRange(preIndex, curIndex), text, []);
                result.addAnalysedChild(this.wordsType, this.sourceText.computeRange(preIndex, curIndex), text, []);
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        if (this.sourceText.isEOF()) {
            mergeWordsNode();
            result.mergeFailedState();
            return;
        }
        else if (this.parserModule.isMultilineBlankGtOne()) {
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
        else if (this.isEmbedment()) {
            mergeWordsNode();
            result.mergeFailedState();
            return;
        }

        while (true) {
            curIndex = this.sourceText.mark();

            if (this.sourceText.isEOF()) {
                mergeWordsNode();
                break;
            }
            else if (this.parserModule.isMultilineBlankGtOne()) {
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
            else if (this.isEmbedment()) {
                mergeWordsNode();
                break;
            }

            else if ((res = this.parserModule.matchMultilineBlankLeqOne()).matched) {
                resetIndex();
                result.merge(res);
                text += " ";
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                text += nodeRes.node.content;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 format block
                mergeWordsNode();
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchInvalidBlock()).matched) {
                resetIndex();
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                text += nodeRes.node.content;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((valRes = this.parserModule.matchChar()).matched) {
                resetIndex();
                result.merge(valRes);
                text += valRes.value;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else {
                error(parserExceptionTexts.LogicalUnexpectedBranch);
            }
        }
    }

    // MatchEscapeChar: failing | (matched) | successful

    private matchEscapeChar(): NodeResult {
        return this.prepareMatch(this.escapeCharType, "escape-char", this.myMatchEscapeChar, this);
    }

    private myMatchEscapeChar(result: NodeResult) {

        let beginIndex = this.sourceText.mark();
        let res = result.merge(this.parserModule.match("\\"));
        if (result.shouldStop) {
            return;
        }
        result.ensureMatched();

        let valRes = result.merge(this.parserModule.matchChar());
        if (result.shouldStop) { // EOF
            result.setNodeContent("\\");
            result.messageList.add(this.texts.EscapeSequenceIncomplete, res.range, MessageType.warning);

            result.recoverToSkippable();
            return;
        }
        switch (valRes.value) {
            case "(": case ")":
            case "[": case "]": case "/": case "#": case "@":
                result.setNodeContent(valRes.value);
                result.highlightList.add(HighlightType.operator, this.sourceText.computeRange(beginIndex));
                break;
            default:
                result.setNodeContent("\\" + valRes.value);
                result.messageList.add(this.texts.InvalidEscapeSequence.format(valRes.value), this.sourceText.computeRange(beginIndex), MessageType.warning);
                break;
        }

    }

    // **************** Custom Blocks ****************

    // ParagraphBlockHandler: failing | skippable | successful

    private paragraphBlockHandler(args: Node): NodeResult {
        return this.prepareMatchBlock(this.paragraphType, "paragraph-block-handler", args, this.myParagraphBlockHandler, this, this.cleanupParagraph);
    }

    private myParagraphBlockHandler(args: Node, result: NodeResult) {

        let nodeRes: NodeResult;

        while (true) {
            if (this.isNoneOfBlocks(BlockType.basic, BlockType.format)) {
                result.mergeFailedState();

                result.recoverToSkippable();
                let range = this.parserModule.skipByBrackets();
                result.messageList.add(this.texts.ParagraphDisallowsOtherBlocks, range, MessageType.error);
            }
            else if ((nodeRes = this.matchParFreeText()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 basic block, format block 在 par free text 中处理了
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else if ((nodeRes = this.matchEmbedment()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                break;
            }
        }
    }

    // TextBlockHandler: failing | skippable | successful

    private textBlockHandler(args: Node): NodeResult {
        return this.prepareMatchBlock(this.textType, "text-block-handler", args, this.myTextBlockHandler, this, this.cleanupText);
    }

    private myTextBlockHandler(args: Node, result: NodeResult) {

        let text = "";
        let res: MatchResult<null>;
        let valRes: MatchResult<string>;
        let nodeRes: NodeResult;

        let preIndex: Index, curIndex: Index;

        const mergeWordsNode = () => {
            if (text !== "") {
                result.addChild(this.wordsType, this.sourceText.computeRange(preIndex, curIndex), text, []);
                result.addAnalysedChild(this.wordsType, this.sourceText.computeRange(preIndex, curIndex), text, []);
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        while (true) {
            curIndex = this.sourceText.mark();

            if (this.sourceText.isEOF()) {
                mergeWordsNode();
                break;
            }
            else if (this.parserModule.isMultilineBlankGtOne()) {
                mergeWordsNode();
                break;
            }
            else if (this.sourceText.isText("]")) {
                mergeWordsNode();
                break;
            }
            else if (this.isNoneOfBlocks(BlockType.format)) {
                mergeWordsNode();
                result.mergeFailedState();

                result.recoverToSkippable();
                let range = this.parserModule.skipByBrackets();
                result.messageList.add(this.texts.TextDisallowsNonFormatBlocks, range, MessageType.error);
            }

            else if ((res = this.parserModule.matchMultilineBlankLeqOne()).matched) {
                resetIndex();
                result.merge(res);
                text += " ";
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                text += nodeRes.node.content;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 format block 前边判断过
                mergeWordsNode();
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchInvalidBlock()).matched) {
                resetIndex();
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                text += nodeRes.node.content;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((valRes = this.parserModule.matchChar()).matched) {
                resetIndex();
                result.merge(valRes);
                text += valRes.value;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else {
                error(parserExceptionTexts.LogicalUnexpectedBranch);
            }
        }
    }

    // **************** Template Handlers ****************

    // SubblockLikeBlockHandler: failing | skippable | successful

    subblockLikeBlockHandler(type: Type, blockName: string, args: Node, texts: { DisallowsOtherBlocks: string }, disallowedBlocks: () => boolean, myAnalyse?: (args: Node, result: NodeResult) => void, thisArg?: unknown): NodeResult {
        return this.prepareMatchBlock(type, `${blockName}-block-handler`, args, this.mySubblockLikeBlockHandler.bind(this, texts, disallowedBlocks), this, myAnalyse, thisArg);
    }

    private mySubblockLikeBlockHandler(texts: { DisallowsOtherBlocks: string }, disallowedBlocks: () => boolean, args: Node, result: NodeResult) {

        let res: MatchResult<null>;
        let nodeRes: NodeResult;

        while (true) {

            if ((res = this.parserModule.matchMultilineBlankLeqOne()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if (disallowedBlocks()) {
                result.mergeFailedState();

                result.recoverToSkippable();
                let range = this.parserModule.skipByBrackets();
                result.messageList.add(texts.DisallowsOtherBlocks, range, MessageType.error);
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else {
                break;
            }
        }
    }

    // FormatLikeBlockHandler: failing | skippable | successful

    formatLikeBlockHandler(type: Type, blockName: string, args: Node, texts: { DisallowsBlocks: string, DisallowsTextInsertion: string }, myAnalyse?: (args: Node, result: NodeResult) => void, thisArg?: unknown): NodeResult {
        return this.prepareMatchBlock(type, `${blockName}-block-handler`, args, this.myFormatLikeBlockHandler.bind(this, texts), this, (args, result) => {
            this.cleanupText(args, result);
            if (myAnalyse) {
                myAnalyse.bind(thisArg)(args, result);
            }
        });
    }

    private myFormatLikeBlockHandler(texts: { DisallowsBlocks: string, DisallowsTextInsertion: string }, args: Node, result: NodeResult) {

        let text = "";
        let res: MatchResult<null>;
        let valRes: MatchResult<string>;
        let nodeRes: NodeResult;

        let preIndex: Index, curIndex: Index;

        const mergeWordsNode = () => {
            if (text !== "") {
                result.addChild(this.wordsType, this.sourceText.computeRange(preIndex, curIndex), text, []);
                result.addAnalysedChild(this.wordsType, this.sourceText.computeRange(preIndex, curIndex), text, []);
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        while (true) {
            curIndex = this.sourceText.mark();

            if (this.sourceText.isEOF()) {
                mergeWordsNode();
                break;
            }
            else if (this.parserModule.isMultilineBlankGtOne()) {
                mergeWordsNode();
                break;
            }
            else if (this.sourceText.isText("]")) {
                mergeWordsNode();
                break;
            }
            else if (this.isNoneOfBlocks()) {
                mergeWordsNode();
                result.mergeFailedState();

                result.recoverToSkippable();
                let range = this.parserModule.skipByBrackets();
                result.messageList.add(texts.DisallowsBlocks, range, MessageType.error);
            }
            else if (this.isTextInsertion()) {
                mergeWordsNode();
                result.mergeFailedState();

                result.recoverToSkippable();
                let name = this.getInsertionName()!;
                let range = this.parserModule.skipText(name);
                result.messageList.add(texts.DisallowsTextInsertion, range, MessageType.error);
            }

            else if ((res = this.parserModule.matchMultilineBlankLeqOne()).matched) {
                resetIndex();
                result.merge(res);
                text += " ";
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                text += nodeRes.node.content;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchInvalidBlock()).matched) {
                resetIndex();
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                text += nodeRes.node.content;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((valRes = this.parserModule.matchChar()).matched) {
                resetIndex();
                result.merge(valRes);
                text += valRes.value;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else {
                error(parserExceptionTexts.LogicalUnexpectedBranch);
            }
        }
    }

    // TextLikeBlockHandler: failing | skippable | successful

    textLikeBlockHandler(type: Type, blockName: string, args: Node, texts: { DisallowsOtherBlocks: string }, disallowedBlocks: () => boolean, myAnalyse?: (args: Node, result: NodeResult) => void, thisArg?: unknown): NodeResult {
        let result = this.prepareMatchBlock(type, `${blockName}-block-handler`, args, this.myTextLikeBlockHandler.bind(this, texts, disallowedBlocks), this, (args, result) => {
            this.cleanupText(args, result);
            if (myAnalyse) {
                myAnalyse.bind(thisArg)(args, result);
            }
        });
        return result;
    }

    private myTextLikeBlockHandler(texts: { DisallowsOtherBlocks: string }, disallowedBlocks: () => boolean, args: Node, result: NodeResult) {

        let text = "";
        let res: MatchResult<null>;
        let valRes: MatchResult<string>;
        let nodeRes: NodeResult;

        let preIndex: Index, curIndex: Index;

        const mergeWordsNode = () => {
            if (text !== "") {
                result.addChild(this.wordsType, this.sourceText.computeRange(preIndex, curIndex), text, []);
                result.addAnalysedChild(this.wordsType, this.sourceText.computeRange(preIndex, curIndex), text, []);
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        while (true) {
            curIndex = this.sourceText.mark();

            if (this.sourceText.isEOF()) {
                mergeWordsNode();
                break;
            }
            else if (this.parserModule.isMultilineBlankGtOne()) {
                mergeWordsNode();
                break;
            }
            else if (this.sourceText.isText("]")) {
                mergeWordsNode();
                break;
            }
            else if (disallowedBlocks()) {
                mergeWordsNode();
                result.mergeFailedState();

                result.recoverToSkippable();
                let range = this.parserModule.skipByBrackets();
                result.messageList.add(texts.DisallowsOtherBlocks, range, MessageType.error);
            }

            else if ((res = this.parserModule.matchMultilineBlankLeqOne()).matched) {
                resetIndex();
                result.merge(res);
                text += " ";
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                text += nodeRes.node.content;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 format block 前边判断过
                mergeWordsNode();
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchInvalidBlock()).matched) {
                resetIndex();
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                text += nodeRes.node.content;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((valRes = this.parserModule.matchChar()).matched) {
                resetIndex();
                result.merge(valRes);
                text += valRes.value;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else {
                error(parserExceptionTexts.LogicalUnexpectedBranch);
            }
        }
    }

    // ParagraphLikeBlockHandler: failing | skippable | successful

    paragraphLikeBlockHandler(type: Type, blockName: string, args: Node, texts: { DisallowsOtherBlocks: string }, disallowedBlocks: () => boolean, myAnalyse?: (args: Node, result: NodeResult) => void, thisArg?: unknown): NodeResult {
        return this.prepareMatchBlock(type, `${blockName}-block-handler`, args, this.myParagraphLikeBlockHandler.bind(this, blockName, texts, disallowedBlocks), this, (args, result) => {
            this.cleanupParagraph(args, result);
            if (myAnalyse) {
                myAnalyse.bind(thisArg)(args, result);
            }
        });
    }

    private myParagraphLikeBlockHandler(blockName: string, texts: { DisallowsOtherBlocks: string }, disallowedBlocks: () => boolean, args: Node, result: NodeResult) {

        let nodeRes: NodeResult;

        while (true) {
            if (disallowedBlocks()) {
                result.mergeFailedState();

                result.recoverToSkippable();
                let range = this.parserModule.skipByBrackets();
                result.messageList.add(texts.DisallowsOtherBlocks, range, MessageType.error);
            }
            else if ((nodeRes = this.matchParFreeTextLike(blockName)).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 basic block, format block 在 par free text 中处理了
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else if ((nodeRes = this.matchEmbedment()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                break;
            }
        }
    }

    // MatchParFreeTextLike: failing | (matched) | skippable | successful

    private matchParFreeTextLike(blockName: string): NodeResult {
        return this.prepareMatch(this.textType, `${blockName}-free-text`, this.myMatchParFreeTextLike, this, this.cleanupText.bind(this, undefined));
    }

    private myMatchParFreeTextLike(result: NodeResult) {

        let text = "";
        let res: Result;
        let valRes: MatchResult<string>;
        let nodeRes: NodeResult;

        let preIndex: Index, curIndex: Index;

        const mergeWordsNode = () => {
            if (text !== "") {
                result.addChild(this.wordsType, this.sourceText.computeRange(preIndex, curIndex), text, []);
                result.addAnalysedChild(this.wordsType, this.sourceText.computeRange(preIndex, curIndex), text, []);
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        if (this.sourceText.isEOF()) {
            mergeWordsNode();
            result.mergeFailedState();
            return;
        }
        else if (this.parserModule.isMultilineBlankGtOne()) {
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
        else if (this.isEmbedment()) {
            mergeWordsNode();
            result.mergeFailedState();
            return;
        }

        while (true) {
            curIndex = this.sourceText.mark();

            if (this.sourceText.isEOF()) {
                mergeWordsNode();
                break;
            }
            else if (this.parserModule.isMultilineBlankGtOne()) {
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
            else if (this.isEmbedment()) {
                mergeWordsNode();
                break;
            }

            else if ((res = this.parserModule.matchMultilineBlankLeqOne()).matched) {
                resetIndex();
                result.merge(res);
                text += " ";
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                text += nodeRes.node.content;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 format block
                mergeWordsNode();
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchInvalidBlock()).matched) {
                resetIndex();
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                text += nodeRes.node.content;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((valRes = this.parserModule.matchChar()).matched) {
                resetIndex();
                result.merge(valRes);
                text += valRes.value;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else {
                error(parserExceptionTexts.LogicalUnexpectedBranch);
            }
        }
    }

    // MultiParagraphLikeBlockHandler: failing | skippable | successful

    multiParagraphLikeBlockHandler(type: Type, subType: Type, blockName: string, subName: string, args: Node, texts: { DisallowsOtherBlocks: string }, init: (result: NodeResult) => void, disallowedBlocks: () => boolean, isSeparator: () => boolean, matchSeparator: (result: NodeResult) => void, mergeNode: (nodeRes: NodeResult, result: NodeResult) => void, myAnalyse?: (args: Node, result: NodeResult) => void, thisArg?: unknown): NodeResult {
        return this.prepareMatchBlock(type, `${blockName}-block-handler`, args, this.myMultiParagraphLikeBlockHandler.bind(this, subType, blockName, subName, texts, init, disallowedBlocks, isSeparator, matchSeparator, mergeNode), this, myAnalyse, thisArg);
    }

    private myMultiParagraphLikeBlockHandler(subType: Type, blockName: string, subName: string, texts: { DisallowsOtherBlocks: string }, init: (result: NodeResult) => void, disallowedBlocks: () => boolean, isSeparator: () => boolean, matchSeparator: (result: NodeResult) => void, mergeNode: (nodeRes: NodeResult, result: NodeResult) => void, args: Node, result: NodeResult) {

        let nodeRes: NodeResult;

        init(result);

        while (true) {
            if (disallowedBlocks()) {
                result.mergeFailedState();

                result.recoverToSkippable();
                let range = this.parserModule.skipByBrackets();
                result.messageList.add(texts.DisallowsOtherBlocks, range, MessageType.error);
            }
            else if (isSeparator()) {
                matchSeparator(result);
            }

            else if ((nodeRes = this.matchFreeParagraphLike(subType, blockName, subName, isSeparator)).matched) {
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                mergeNode(nodeRes, result);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                mergeNode(nodeRes, result);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else {
                break;
            }
        }
    }

    // MatchFreeParagraphLike: failing | (matched) | skippable | successful

    private matchFreeParagraphLike(subType: Type, blockName: string, subName: string, isSeparator: () => boolean): NodeResult {
        return this.prepareMatch(subType, `${blockName}-free-${subName}`, this.myMatchFreeParagraphLike.bind(this, blockName, isSeparator), this, this.cleanupParagraph.bind(this, undefined));
    }

    private myMatchFreeParagraphLike(blockName: string, isSeparator: () => boolean, result: NodeResult) {

        let nodeRes: NodeResult;

        if ((nodeRes = this.matchFreeTextLike(blockName, isSeparator)).matched) {
            result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();
        }
        else if (this.isOneOfBlocks(BlockType.basic) && (nodeRes = this.matchBlock()).matched) {
            result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();
        }
        else if ((nodeRes = this.matchEmbedment()).matched) {
            result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();
        }
        else {
            result.mergeFailedState();
            return;
        }

        while (true) {
            if ((nodeRes = this.matchFreeTextLike(blockName, isSeparator)).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }
            else if (this.isOneOfBlocks(BlockType.basic) && (nodeRes = this.matchBlock()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }
            else if ((nodeRes = this.matchEmbedment()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }
            else {
                break;
            }
        }
    }

    // MatchFreeTextLike: failing | (matched) | skippable | successful

    private matchFreeTextLike(blockName: string, isSeparator: () => boolean): NodeResult {
        return this.prepareMatch(this.textType, `${blockName}-free-text`, this.myMatchFreeTextLike.bind(this, isSeparator), this, this.cleanupText.bind(this, undefined));
    }

    private myMatchFreeTextLike(isSeparator: () => boolean, result: NodeResult) {

        let text = "";
        let res: Result;
        let valRes: MatchResult<string>;
        let nodeRes: NodeResult;

        let preIndex: Index, curIndex: Index;

        const mergeWordsNode = () => {
            if (text !== "") {
                result.addChild(this.wordsType, this.sourceText.computeRange(preIndex, curIndex), text, []);
                result.addAnalysedChild(this.wordsType, this.sourceText.computeRange(preIndex, curIndex), text, []);
                text = "";
            }
        }

        const resetIndex = () => {
            if (text === "") {
                preIndex = curIndex;
            }
        }

        if (this.sourceText.isEOF()) {
            mergeWordsNode();
            result.mergeFailedState();
            return;
        }
        else if (this.parserModule.isMultilineBlankGtOne()) {
            mergeWordsNode();
            result.mergeFailedState();
            return;
        }
        else if (this.isNoneOfBlocks(BlockType.format)) {
            mergeWordsNode();
            result.mergeFailedState();
            return;
        }
        else if (isSeparator()) {
            mergeWordsNode();
            result.mergeFailedState();
            return;
        }
        else if (this.sourceText.isText("]")) {
            mergeWordsNode();
            result.mergeFailedState();
            return;
        }
        else if (this.isCommand()) {
            mergeWordsNode();
            result.mergeFailedState();
            return;
        }
        else if (this.isEmbedment()) {
            mergeWordsNode();
            result.mergeFailedState();
            return;
        }

        while (true) {
            curIndex = this.sourceText.mark();

            if (this.sourceText.isEOF()) {
                mergeWordsNode();
                break;
            }
            else if (this.parserModule.isMultilineBlankGtOne()) {
                mergeWordsNode();
                break;
            }
            else if (this.isNoneOfBlocks(BlockType.format)) {
                mergeWordsNode();
                break;
            }
            else if (isSeparator()) {
                mergeWordsNode();
                break;
            }
            else if (this.sourceText.isText("]")) {
                mergeWordsNode();
                break;
            }
            else if (this.isCommand()) {
                mergeWordsNode();
                break;
            }
            else if (this.isEmbedment()) {
                mergeWordsNode();
                break;
            }

            else if ((res = this.parserModule.matchMultilineBlankLeqOne()).matched) {
                resetIndex();
                result.merge(res);
                text += " ";
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchEscapeChar()).matched) {
                resetIndex();
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                text += nodeRes.node.content;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchInsertion()).matched) {
                mergeWordsNode();
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchBlock()).matched) {
                // 只能是 format block
                mergeWordsNode();
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((nodeRes = this.matchInvalidBlock()).matched) {
                resetIndex();
                result.merge(nodeRes, MergeStrategy.None, MergeStrategy.None);
                text += nodeRes.node.content;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else if ((valRes = this.parserModule.matchChar()).matched) {
                resetIndex();
                result.merge(valRes);
                text += valRes.value;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.ensureMatched();
            }

            else {
                error(parserExceptionTexts.LogicalUnexpectedBranch);
            }
        }
    }

    // **************** Custom Commands ****************

    // SettingCommandHandler: failing | skippable | successful

    private settingCommandHandler(): NodeResult {
        return this.prepareMatch(this.settingType, "setting", this.mySettingCommandHandler, this, this.defaultAnalysis);
    }

    private mySettingCommandHandler(result: NodeResult) {

        let res: MatchResult<null>;
        let valRes: MatchResult<string>;

        res = result.merge(this.parserModule.match("#"));
        if (result.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }
        result.highlightList.add(HighlightType.operator, res.range);

        result.merge(this.parserModule.skipBlank());

        let nameRes = result.merge(this.parserModule.matchNameWithHyphen());
        if (result.shouldStop) {
            result.messageList.add(this.texts.SettingNameMissing, res.range, MessageType.error);

            result.recoverToSkippable();
            this.parserModule.skipToEndOfLine();
            result.addChild(this.settingParameterType, res.range, "", []);
            return;
        }
        result.highlightList.add(HighlightType.keyword, nameRes.range);
        result.setNodeContent(nameRes.value);

        result.merge(this.parserModule.skipBlank());

        res = result.merge(this.parserModule.match(":"));
        if (result.shouldStop) {
            result.messageList.add(this.texts.SettingColonMissing, nameRes.range, MessageType.error);

            result.recoverToSkippable();
            this.parserModule.skipToEndOfLine();
            result.addChild(this.settingParameterType, nameRes.range, "", []);
            return;
        }
        result.highlightList.add(HighlightType.operator, res.range);

        let commandIndex = this.sourceText.mark();
        let command = "";
        while (true) {
            if (this.sourceText.isEOF()) {
                break;
            }
            else if (this.sourceText.isNewline()) {
                break;
            }
            else if ((valRes = this.parserModule.matchChar()).matched) {
                result.merge(valRes);
                command += valRes.value;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                error(parserExceptionTexts.LogicalUnexpectedBranch);
            }
        }
        result.addChild(this.settingParameterType, this.sourceText.computeRange(commandIndex), command, []);
    }

    // **************** Custom Insertions ****************

    // NewlineEmbedmentHandler: failing | skippable | successful

    private newlineEmbedmentHandler(): NodeResult {
        return this.prepareMatch(this.newlineType, "newline", this.myNewlineEmbedmentHandler, this);
    }

    private myNewlineEmbedmentHandler(result: NodeResult) {

        let res: MatchResult<null>;

        res = result.merge(this.parserModule.match("\\\\"));
        if (result.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }
        result.highlightList.add(HighlightType.operator, res.range);
        result.setDiscarded(true);
    }

    // **************** Custom Insertions ****************

    // ReferenceInsertionHandler: failing | skippable | successful

    private referenceInsertionHandler(): NodeResult {
        return this.prepareMatch(this.referenceType, "reference", this.myReferenceInsertionHandler, this, this.defaultAnalysis);
    }

    private myReferenceInsertionHandler(result: NodeResult) {

        let res: MatchResult<null>;

        let beginIndex = this.sourceText.mark();
        res = result.merge(this.parserModule.match("@"));
        if (result.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }
        result.highlightList.add(HighlightType.operator, res.range);

        result.merge(this.parserModule.skipBlank());

        let nameRes = result.merge(this.parserModule.matchNameWithHyphen());
        if (result.shouldStop) {
            result.recoverToSkippable();
            result.messageList.add(this.texts.ReferenceNameMissing, res.range, MessageType.error);
            return;
        }
        result.setNodeContent(nameRes.value);
        result.highlightList.add(HighlightType.keyword, nameRes.range);

        result.merge(this.parserModule.skipBlank());

        let endIndex = this.sourceText.mark();
        if ((res = this.parserModule.match(";")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.highlightList.add(HighlightType.operator, res.range);
        }
        else {
            result.mergeSuccessfulState();
        }
    }

    // **************** Matching, Analysing & Skipping ****************

    // index, stack, node.range, analyse
    // 如果在 match 过程中已经分析 (配合 mergeNodeToChildren), 则 analyse 置空; 如果 match 没有处理, 用 defaultAnalyse; 如果需要自定义, 请自行指定 analyse.

    prepareMatch(type: Type, name: string, myMatch: (result: NodeResult) => void, thisArg?: unknown, myAnalyse?: (result: NodeResult) => void, secondThisArg?: unknown) {
        let result = new NodeResult(new Node(type, this.sourceText.emptyRange), new Node(type, this.sourceText.emptyRange));
        let preIndex = this.sourceText.mark();
        this.parserModule.begin(name);
        myMatch.bind(thisArg)(result);
        this.parserModule.end();

        if (myAnalyse) {
            this.parserModule.begin('analyse-' + name);
            myAnalyse.bind(secondThisArg ?? thisArg)(result);
            this.parserModule.end();
        }
        if (result.failed) {
            this.sourceText.recover(preIndex);
        }
        result.node.range = this.sourceText.computeRange(preIndex);
        result.analysedNode.range = this.sourceText.computeRange(preIndex);
        return result;
    }

    prepareMatchBlock(type: Type, name: string, args: Node, myMatch: (args: Node, result: NodeResult) => void, thisArg?: unknown, myAnalyse?: (args: Node, result: NodeResult) => void, secondThisArg?: unknown) {
        let result = new NodeResult(new Node(type, this.sourceText.emptyRange), new Node(type, this.sourceText.emptyRange));
        let preIndex = this.sourceText.mark();
        this.parserModule.begin(name);
        myMatch.bind(thisArg)(args, result);
        this.parserModule.end();

        if (myAnalyse) {
            this.parserModule.begin('analyse-' + name);
            myAnalyse.bind(secondThisArg ?? thisArg)(args, result);
            this.parserModule.end();
        }
        if (result.failed) {
            this.sourceText.recover(preIndex);
        }
        result.node.range = this.sourceText.computeRange(preIndex);
        result.analysedNode.range = this.sourceText.computeRange(preIndex);
        return result;
    }

    defaultAnalysis(result: NodeResult) {
        result.node.transferTo(result.analysedNode);
        result.setDiscarded(false);
    }

    defaultBlockAnalysis(args: Node, result: NodeResult) {
        result.node.transferTo(result.analysedNode);
        result.setDiscarded(false);
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
