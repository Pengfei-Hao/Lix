/**
* Parser: analyise the document, generate the syntax tree
*/

import { Type } from "../syntax-tree/type";
import { Node } from "../syntax-tree/node";
import { TypeTable } from "../syntax-tree/type-table";
import { BlockTable } from "./block-table";
import { Math } from "./math/math";
import { Module } from "./module";
import { Highlight, HighlightType, Reference, NodeResult, ResultState, BasicResult, Result } from "./result";
import { Message, MessageType } from "./message";
import { Core } from "./core/core";
import { Article } from "./article/article";
import { Config } from "../compiler/config";
import { InsertionTable } from "./insertion-table";
import { FileSystem, FileSystemRecord } from "../compiler/file-system";
import { parserExceptionTexts } from "./texts";
import { Compiler } from "../compiler/compiler";
import { ParserTexts } from "./texts";
import { SourceText } from "./source-text";
import { error } from "../foundation/error";
import { Inline } from "./inline/inline";
import { CommandTable } from "./command-table";

export type MatchResult = NodeResult;

export class Parser {

    // **************** Environment ****************

    // Compiler
    compiler: Compiler;
    private typeTable: TypeTable;
    private config: Config;
    private fileSystem: FileSystem;
    private texts: ParserTexts;

    private emptyType: Type;

    // Block & insertion table
    blockTable: BlockTable;
    insertionTable: InsertionTable;
    commandTable: CommandTable;

    // Modules
    modules: Module[];
    inlineModule: Inline;
    mathModule: Math;
    coreModule: Core;

    // **************** Parsing ****************

    sourceText: SourceText;

    // Stack of 'match' function
    process: string[];

    result: NodeResult;

    constructor(compiler: Compiler) {

        this.compiler = compiler;
        this.typeTable = compiler.typeTable;
        this.config = compiler.config;
        this.fileSystem = compiler.fileSystem;
        this.texts = compiler.texts.Parser;

        this.emptyType = this.typeTable.emptyType;

        // **************** Blocks & Insertions ****************

        this.blockTable = new BlockTable();
        this.insertionTable = new InsertionTable();
        this.commandTable = new CommandTable();

        // **************** Init ****************

        this.sourceText = new SourceText();

        this.process = [];

        this.result = new NodeResult(new Node(this.emptyType), new Node(this.emptyType));

        // **************** Modules ****************

        this.inlineModule = new Inline(this);
        this.mathModule = new Math(this);
        this.coreModule = new Core(this);
        this.modules = [this.inlineModule, this.mathModule, this.coreModule, new Article(this)];
    }

    // *********** Init and Parse ***************

    get syntaxTree(): Node {
        return this.result.node;
    }

    get analysedTree(): Node {
        return this.result.analysedNode;
    }

    get state(): ResultState {
        return this.result.state;
    }

    get messages(): Message[] {
        return this.result.messages;
    }

    get highlights(): Highlight[] {
        return this.result.highlights;
    }

    get references(): Reference[] {
        return this.result.references;
    }

    get fileRecords(): FileSystemRecord[] {
        return this.result.fileRecords;
    }

    private init(text: string) {
        this.sourceText.init(text);

        this.process = [];

        this.result = new NodeResult(new Node(this.emptyType), new Node(this.emptyType));
    }

    parse(text: string) {
        this.init(text);
        for (let module of this.modules) {
            module.init();
        }

        // parse
        this.result = this.inlineModule.matchDocument();
    }

    // **************** Name & Constants ****************

    // MatchName: failing | successful

    matchName(): Result<string> {
        return this.prepareMatchingForFoundation(new Result<string>(""), `name`, this.myMatchName, this);
    }

    private myMatchName(result: Result<string>) {
        if (!this.sourceText.isName()) {
            result.mergeFailedState();
            return;
        }
        while (true) {
            if (this.sourceText.isName()) {
                let valRes = result.merge(this.matchChar());
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.value += valRes.value;
            }
            else {
                break;
            }
        }
    }

    // MatchNameWithHyphen: failing | successful

    matchNameWithHyphen(): Result<string> {
        return this.prepareMatchingForFoundation(new Result<string>(""), `name-with-hyphen`, this.myMatchNameWithHyphen, this);
    }

    private myMatchNameWithHyphen(result: Result<string>) {
        if (!this.sourceText.isNameOrHyphen()) {
            result.mergeFailedState();
            return;
        }
        while (true) {
            if (this.sourceText.isNameOrHyphen()) {
                let valRes = result.merge(this.matchChar());
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.value += valRes.value;
            }
            else {
                break;
            }
        }
    }

    // MatchRawString: failing | skippable | successful

    private matchRawString(marker: string): Result<string> {
        return this.prepareMatchingForFoundation(new Result<string>(""), `raw-string`, this.myMatchRawString.bind(this, marker), this);
    }

    private myMatchRawString(marker: string, result: Result<string>) {

        let valRes: Result<string>;
        let beginIndex = this.sourceText.getIndex();

        result.merge(this.match(marker));
        if (result.shouldStop) {
            return;
        }

        while (true) {
            if (this.sourceText.isText(marker)) {
                break;
            }
            else if (this.sourceText.isNewline()) {
                result.mergeFailedState();
                result.recoverToSkippable();
                result.addMessage(this.texts.StringNewlineForbidden, MessageType.error, beginIndex, 0, this.sourceText.getIndex() - beginIndex);
                return;
            }
            else if ((valRes = this.matchChar()).matched) {
                result.merge(valRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.value += valRes.value;
            }
            else {
                break;
            }
        }

        result.merge(this.match(marker));
        if (result.shouldStop) {
            result.recoverToSkippable();
            result.addMessage(this.texts.StringEndedUnexpectedly, MessageType.error, beginIndex, 0, this.sourceText.getIndex() - beginIndex);
            return;
        }
    }

    // MatchString: failing | skippable | successful

    matchString(): Result<string> {
        return this.prepareMatchingForFoundation(new Result<string>(""), `string`, this.myMatchString, this);
    }

    private myMatchString(result: Result<string>) {
        let res: Result<string>;

        if ((res = this.matchRawString('`')).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.value = res.value;
        }
        else if ((res = this.matchRawString('"')).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.value = res.value;
        }
        else if ((res = this.matchRawString("'")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.value = res.value;
        }
        else {
            result.mergeFailedState();
            return;
        }
    }

    // MatchNumber: failing | matched | skippable | successful

    matchNumber(): Result<string> {
        return this.prepareMatchingForFoundation(new Result<string>(""), `number`, this.myMatchNumber, this);
    }

    private myMatchNumber(result: Result<string>) {
        let res: BasicResult;
        let valRes: Result<string>;

        if ((res = this.match('+')).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            //result.value += '+';
        }
        else if ((res = this.match('-')).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.value += '-';
        }
        else {
            result.mergeSuccessfulState();
            //result.value += '+';
        }

        if (!this.sourceText.isDigit()) {
            result.mergeFailedState();
            return;
        }
        result.ensureMatched();

        while (true) {
            if (this.sourceText.isDigit()) {
                valRes = result.merge(this.matchChar());
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.value += valRes.value;
            }
            else {
                break;
            }
        }

        if ((res = this.match(".")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.value += ".";

            while (true) {
                if (this.sourceText.isDigit()) {
                    valRes = result.merge(this.matchChar());
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    result.value += valRes.value;
                }
                else {
                    break;
                }
            }
        }
        else {
            result.mergeSuccessfulState();
        }

        result.merge(this.skipBlank());

        if ((res = this.match("%")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.value += "%";
        }
        else if ((res = this.match("px")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.value += "px";
        }
        else if ((res = this.match("em")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.value += "em";
        }
        else if ((res = this.match("cm")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.value += "cm";
        }
        else {
            result.mergeSuccessfulState();
        }
    }

    // **************** Blank & Comments ****************

    // MatchSinglelineBlank: failing | skippable | successful

    matchSinglelineBlank(): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `singleline-blank`, this.myMatchSinglelineBlank, this);
    }

    private myMatchSinglelineBlank(result: BasicResult) {
        let res: BasicResult;

        if ((res = this.matchSinglelineComment()).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
        }
        else {
            if (this.sourceText.isBlank()) {
                result.merge(this.matchChar());
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else if ((res = this.matchMultilineComment()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                result.mergeFailedState();
                return;
            }

            while (true) {
                if (this.sourceText.isBlank()) {
                    result.merge(this.matchChar());
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                }
                else if ((res = this.matchMultilineComment()).matched) {
                    result.merge(res);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                }
                else {
                    break;
                }
            }

            if ((res = this.matchSinglelineComment()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                result.mergeSuccessfulState();
            }
        }
    }

    // MatchMultilineBlank: failing | skippable | successful

    matchMultilineBlank(): Result<number> {
        return this.prepareMatchingForFoundation(new Result<number>(0), `multiline-blank`, this.myMatchMultilineBlank, this);
    }

    private myMatchMultilineBlank(result: Result<number>) {
        let res: BasicResult;

        if (this.sourceText.isBlank()) {
            result.merge(this.matchChar());
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
        }
        else if (this.sourceText.isNewline()) {
            result.merge(this.matchChar());
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.value++;
        }
        else if ((res = this.matchSinglelineComment()).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
        }
        else if ((res = this.matchMultilineComment()).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
        }
        else {
            result.mergeFailedState();
            return;
        }

        while (true) {
            if (this.sourceText.isBlank()) {
                result.merge(this.matchChar());
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else if (this.sourceText.isNewline()) {
                result.merge(this.matchChar());
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.value++;
            }
            else if ((res = this.matchSinglelineComment()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else if ((res = this.matchMultilineComment()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                break;
            }
        }
    }

    // Arguments of MatchMultilineBlank

    isMultilineBlankGtOne(): boolean {
        let preIndex = this.sourceText.getIndex();
        let valRes = this.matchMultilineBlank();
        this.sourceText.setIndex(preIndex);
        if (valRes.matched && valRes.value > 1) {
            return true;
        }
        return false;
    }

    isMultilineBlankLeqOne(): boolean {
        let preIndex = this.sourceText.getIndex();
        let valRes = this.matchMultilineBlank();
        this.sourceText.setIndex(preIndex);
        if (valRes.matched && valRes.value <= 1) {
            return true;
        }
        return false;
    }

    // MatchMultilineBlankGtOne: failing | skippable | successful

    matchMultilineBlankGtOne(): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `multiline-blank-gt-1`, (result: BasicResult) => {
            let valRes = result.merge(this.matchMultilineBlank());
            if (valRes.shouldStop) {
                return;
            }
            if (valRes.value <= 1) {
                result.mergeFailedState();
                return;
            }
        }, this);
    }

    // MatchMultilineBlankLeqOne: failing | skippable | successful

    matchMultilineBlankLeqOne(): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `multiline-blank-leq-1`, (result: BasicResult) => {
            let valRes = result.merge(this.matchMultilineBlank());
            if (valRes.shouldStop) {
                return;
            }
            if (valRes.value > 1) {
                result.mergeFailedState();
                return;
            }
        }, this);
    }

    // MatchSinglelineComment: failing | successful

    private matchSinglelineComment(): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `singleline-comment`, this.myMatchSinglelineComment, this);
    }

    private myMatchSinglelineComment(result: BasicResult) {
        let res: BasicResult;

        result.merge(this.match("//"));
        if (result.shouldStop) {
            return;
        }

        while (true) {
            if (this.sourceText.isEOF()) {
                break;
            }
            else if (this.sourceText.isNewline()) {
                break;
            }
            else if ((res = this.matchChar()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                error(parserExceptionTexts.LogicalSingleLineCommentBranch);
            }
        }
    }

    // MatchMultilineComment: failing | skippable | successful

    private matchMultilineComment(): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `multiline-comment`, this.myMatchMultilineComment, this);
    }

    private myMatchMultilineComment(result: BasicResult) {
        let res: BasicResult;
        let beginIndex = this.sourceText.getIndex();

        result.merge(this.match("/*"));
        if (result.shouldStop) {
            return;
        }

        while (true) {
            if (this.sourceText.isText("*/")) {
                break;
            }
            else if ((res = this.matchMultilineComment()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else if (this.sourceText.isEOF()) {
                break;
            }
            else if ((res = this.matchChar()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                error(parserExceptionTexts.LogicalMultilineCommentBranch);
            }
        }

        result.merge(this.match("*/"));
        if (result.shouldStop) {
            result.recoverToSkippable();
            result.addMessage(this.texts.MultilineCommentEndedUnexpectedly, MessageType.warning, beginIndex, 0, this.sourceText.getIndex() - beginIndex);
            return;
        }
    }

    // SkipBlank: skippable | successful

    skipBlank(): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `skip-blank`, (result: BasicResult) => {
            let res = this.matchSinglelineBlank();
            if (res.matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                result.mergeSuccessfulState();
            }
        }, this);
    }

    // SkipMutilineBlank: skippable | successful

    skipMutilineBlank(): Result<number> {
        return this.prepareMatchingForFoundation(new Result<number>(0), `skip-multiline-blank`, (result: Result<number>) => {
            let valRes = this.matchMultilineBlank();
            if (valRes.matched) {
                result.merge(valRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.value = valRes.value;
            }
            else {
                result.mergeSuccessfulState();
            }
        }, this);
    }

    // SkipMutilineBlankGtOne: skippable | successful

    skipMutilineBlankGtOne(): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `skip-multiline-blank-gt-1`, (result: BasicResult) => {
            let valRes = this.matchMultilineBlankGtOne();
            if (valRes.matched) {
                result.merge(valRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                result.mergeSuccessfulState();
            }
        }, this);
    }

    // SkipMutilineBlankLeqOne: skippable | successful

    skipMutilineBlankLeqOne(): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `skip-multiline-blank-leq-1`, (result: BasicResult) => {
            let valRes = this.matchMultilineBlankLeqOne();
            if (valRes.matched) {
                result.merge(valRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                result.mergeSuccessfulState();
            }
        }, this);
    }

    // **************** Foundation ****************

    // index, stack
    private prepareMatchingForFoundation<R extends BasicResult>(result: R, name: string, myMatch: (result: R) => void, thisArg?: unknown): R {
        let preIndex = this.sourceText.getIndex();
        this.begin(name);
        myMatch.bind(thisArg)(result);
        this.end();
        if (result.failed) {
            this.sourceText.setIndex(preIndex);
        }
        return result;
    }

    // **************** Matching, Analysing & Skipping ****************

    // index, stack, node.range, analyse
    // 如果在 match 过程中已经分析 (配合 mergeNodeToChildren), 则 analyse 置空; 如果 match 没有处理, 用 defaultAnalyse; 如果需要自定义, 请自行指定 analyse.
    prepareMatch(type: Type, name: string, myMatch: (result: NodeResult) => void, thisArg?: unknown, myAnalyse?: (result: NodeResult) => void, secondThisArg?: unknown) {
        let result = new NodeResult(new Node(type), new Node(type));
        let preIndex = this.sourceText.getIndex();
        this.begin(name);
        myMatch.bind(thisArg)(result);
        this.end();
        result.node.begin = preIndex;
        result.node.end = this.sourceText.getIndex();

        if (myAnalyse) {
            this.begin('analyse-' + name);
            myAnalyse.bind(secondThisArg ?? thisArg)(result);
            this.end();
        }
        result.analysedNode.begin = preIndex;
        result.analysedNode.end = this.sourceText.getIndex();

        if (result.failed) {
            this.sourceText.setIndex(preIndex);
        }
        return result;
    }

    defaultAnalysis(result: NodeResult) {
        result.node.transferTo(result.analysedNode);
        result.setDiscarded(false);
    }

    skipByBrackets(bracketsCount: number = 0, multiline: boolean = false): number {
        let preIndex = this.sourceText.getIndex();
        while (true) {
            if (this.sourceText.isEOF()) {

                return this.sourceText.getIndex() - preIndex;
            }
            else if (this.sourceText.isText("[")) {
                bracketsCount++;
                this.sourceText.move();
            }
            else if (this.sourceText.isText("]")) {
                bracketsCount--;
                this.sourceText.move();
                if (bracketsCount <= 0) {
                    return this.sourceText.getIndex() - preIndex;
                }
            }
            else if (!multiline && this.isMultilineBlankGtOne()) {
                return this.sourceText.getIndex() - preIndex;
            }
            else {
                this.sourceText.move();
            }
        }
    }

    skipToEndOfLine() {
        while (true) {
            if (this.sourceText.isEOF()) {
                return;
            }
            else if (this.sourceText.isNewline()) {
                return;
            }

            else {
                this.sourceText.move();
            }

        }
    }

    skipToAfter(char: string, singleline: boolean = true) {
        while (true) {
            if (this.sourceText.isEOF()) {
                return;
            }
            else if (singleline && this.sourceText.isNewline()) {
                return;
            }
            else if (this.sourceText.isText(char)) {
                this.sourceText.move();
                return;
            }

            else {
                this.sourceText.move();
            }
        }
    }

    skipLength(length: number) {
        this.sourceText.setIndex(this.sourceText.getIndex() + length);
    }

    // **************** Terminal Token ****************

    // Match: failing | successful

    match(text: string): BasicResult {
        return this.prepareMatchingForFoundation(new BasicResult(), `match'${text}'`, this.myMatch.bind(this, text));
    }

    private myMatch(text: string, result: BasicResult) {
        if (this.sourceText.isText(text)) {
            result.mergeSuccessfulState();
            this.sourceText.setIndex(this.sourceText.getIndex() + text.length);
        }
        else {
            result.mergeFailedState();
        }
    }

    // MatchChar: failing | successful

    matchChar(): Result<string> {
        return this.prepareMatchingForFoundation(new Result<string>(""), `matchChar`, this.myMatchChar, this);
    }

    private myMatchChar(result: Result<string>) {
        if (this.sourceText.isChar()) {
            result.mergeSuccessfulState();
            result.value = this.sourceText.peek();
            this.sourceText.move();
        }
        else {
            result.mergeFailedState();
            return;
        }
    }

    // **************** Environment ****************

    // process

    begin(process: string) {
        this.process.push(process);
    }

    end() {
        this.process.pop();
    }
}