import { Config } from "../../common/config";
import { Path } from "../../common/file-system/path";
import { MessageType } from "../../common/result/message";
import { MatchResult } from "../../common/result/parsing-result";
import { Result } from "../../common/result/result";
import { Index, Range, SourceText } from "../../common/source-text";
import { TypeTable } from "../../common/syntax-tree/type-table";
import { error } from "../../foundation/error";
import { BlockTable } from "../table/block-table";
import { CommandTable } from "../table/command-table";
import { EmbedmentTable } from "../table/embedment-table";
import { InsertionTable } from "../table/insertion-table";
import { parserExceptionTexts, ParserTexts } from "../texts";
import { Module } from "./module";

export class ParserModule extends Module {

    // Block & insertion & command table
    public blockTable: BlockTable;
    public insertionTable: InsertionTable;
    public embedmentTable: EmbedmentTable;
    public commandTable: CommandTable;

    // Stack of 'match' function
    public process: string[];

    constructor(config: Config, path: Path, texts: ParserTexts, typeTable: TypeTable, sourceText: SourceText) {
        super(config, path, texts, typeTable, sourceText);

        this.process = [];

        this.blockTable = new BlockTable();
        this.insertionTable = new InsertionTable();
        this.embedmentTable = new EmbedmentTable();
        this.commandTable = new CommandTable();
    }

    init() {
        this.process = [];
    }

    // **************** Name & Constants ****************

    // MatchName: failing | successful

    matchName(): MatchResult<string> {
        return this.prepareMatchingForFoundation("", `name`, this.myMatchName, this);
    }

    private myMatchName(result: MatchResult<string>) {
        if (!this.sourceText.isName()) {
            result.mergeFailedState();
            return;
        }
        while (true) {
            if (this.sourceText.isName()) {
                let valRes = result.merge(this.matchChar());
                result.value += valRes.value;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                break;
            }
        }
    }

    // MatchNameWithHyphen: failing | successful

    matchNameWithHyphen(): MatchResult<string> {
        return this.prepareMatchingForFoundation("", `name-with-hyphen`, this.myMatchNameWithHyphen, this);
    }

    private myMatchNameWithHyphen(result: MatchResult<string>) {
        if (!this.sourceText.isNameOrHyphen()) {
            result.mergeFailedState();
            return;
        }
        while (true) {
            if (this.sourceText.isNameOrHyphen()) {
                let valRes = result.merge(this.matchChar());
                result.value += valRes.value;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                break;
            }
        }
    }

    // MatchRawString: failing | skippable | successful

    private matchRawString(marker: string): MatchResult<string> {
        return this.prepareMatchingForFoundation("", `raw-string`, this.myMatchRawString.bind(this, marker), this);
    }

    private myMatchRawString(marker: string, result: MatchResult<string>) {

        let valRes: MatchResult<string>;

        let beginIndex = this.sourceText.mark();
        result.merge(this.match(marker));
        if (result.shouldStop) {
            return;
        }

        while (true) {
            if (this.sourceText.isText(marker)) {
                break;
            }
            else if (this.sourceText.isEOF()) {
                break;
            }
            else if (this.sourceText.isNewline()) {
                result.mergeFailedState();
                result.recoverToSkippable();
                result.messageList.add(this.texts.StringNewlineForbidden, this.sourceText.computeRange(beginIndex), MessageType.error);
                return;
            }
            else if ((valRes = this.matchChar()).matched) {
                result.merge(valRes);
                result.value += valRes.value;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                error(parserExceptionTexts.LogicalUnexpectedBranch);
            }
        }

        result.merge(this.match(marker));
        if (result.shouldStop) {
            result.recoverToSkippable();
            result.messageList.add(this.texts.StringEndedUnexpectedly, this.sourceText.computeRange(beginIndex), MessageType.error);
            return;
        }
    }

    // MatchString: failing | skippable | successful

    matchString(): MatchResult<string> {
        return this.prepareMatchingForFoundation("", `string`, this.myMatchString, this);
    }

    private myMatchString(result: MatchResult<string>) {
        let res: MatchResult<string>;

        if ((res = this.matchRawString('`')).matched) {
            result.merge(res);
            result.value = res.value;
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
        }
        else if ((res = this.matchRawString('"')).matched) {
            result.merge(res);
            result.value = res.value;
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
        }
        else if ((res = this.matchRawString("'")).matched) {
            result.merge(res);
            result.value = res.value;
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
        }
        else {
            result.mergeFailedState();
            return;
        }
    }

    // MatchNumber: failing | matched | skippable | successful

    matchNumber(): MatchResult<string> {
        return this.prepareMatchingForFoundation("", `number`, this.myMatchNumber, this);
    }

    private myMatchNumber(result: MatchResult<string>) {
        let res: Result;
        let valRes: MatchResult<string>;

        if ((res = this.match('+')).matched) {
            result.merge(res);
            //result.value += '+';
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
        }
        else if ((res = this.match('-')).matched) {
            result.merge(res);
            result.value += '-';
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
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
                result.value += valRes.value;
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                break;
            }
        }

        if ((res = this.match(".")).matched) {
            result.merge(res);
            result.value += ".";
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }

            while (true) {
                if (this.sourceText.isDigit()) {
                    valRes = result.merge(this.matchChar());
                    result.value += valRes.value;
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
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
            result.value += "%";
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
        }
        else if ((res = this.match("px")).matched) {
            result.merge(res);
            result.value += "px";
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
        }
        else if ((res = this.match("em")).matched) {
            result.merge(res);
            result.value += "em";
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
        }
        else if ((res = this.match("cm")).matched) {
            result.merge(res);
            result.value += "cm";
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
        }
        else {
            result.mergeSuccessfulState();
        }
    }

    // **************** Blank & Comments ****************

    // MatchSinglelineBlank: failing | skippable | successful

    matchSinglelineBlank(): MatchResult<null> {
        return this.prepareMatchingForFoundation(null, `singleline-blank`, this.myMatchSinglelineBlank, this);
    }

    private myMatchSinglelineBlank(result: MatchResult<null>) {
        let res: Result;

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

    matchMultilineBlank(): MatchResult<number> {
        return this.prepareMatchingForFoundation(0, `multiline-blank`, this.myMatchMultilineBlank, this);
    }

    private myMatchMultilineBlank(result: MatchResult<number>) {
        let res: Result;

        if (this.sourceText.isBlank()) {
            result.merge(this.matchChar());
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
        }
        else if (this.sourceText.isNewline()) {
            result.merge(this.matchChar());
            result.value++;
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
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
        let preIndex = this.sourceText.mark();
        let valRes = this.matchMultilineBlank();
        this.sourceText.recover(preIndex);
        if (valRes.matched && valRes.value > 1) {
            return true;
        }
        return false;
    }

    isMultilineBlankLeqOne(): boolean {
        let preIndex = this.sourceText.mark();
        let valRes = this.matchMultilineBlank();
        this.sourceText.recover(preIndex);
        if (valRes.matched && valRes.value <= 1) {
            return true;
        }
        return false;
    }

    // MatchMultilineBlankGtOne: failing | skippable | successful

    matchMultilineBlankGtOne(): MatchResult<null> {
        return this.prepareMatchingForFoundation(null, `multiline-blank-gt-1`, (result: MatchResult<null>) => {
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

    matchMultilineBlankLeqOne(): MatchResult<null> {
        return this.prepareMatchingForFoundation(null, `multiline-blank-leq-1`, (result: MatchResult<null>) => {
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

    private matchSinglelineComment(): MatchResult<null> {
        return this.prepareMatchingForFoundation(null, `singleline-comment`, this.myMatchSinglelineComment, this);
    }

    private myMatchSinglelineComment(result: MatchResult<null>) {
        let res: Result;

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
                error(parserExceptionTexts.LogicalUnexpectedBranch);
            }
        }
    }

    // MatchMultilineComment: failing | skippable | successful

    private matchMultilineComment(): MatchResult<null> {
        return this.prepareMatchingForFoundation(null, `multiline-comment`, this.myMatchMultilineComment, this);
    }

    private myMatchMultilineComment(result: MatchResult<null>) {
        let res: Result;

        let beginIndex = this.sourceText.mark();
        result.merge(this.match("/*"));
        if (result.shouldStop) {
            return;
        }

        while (true) {
            if (this.sourceText.isText("*/")) {
                break;
            }
            else if (this.sourceText.isEOF()) {
                break;
            }
            else if ((res = this.matchMultilineComment()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else if ((res = this.matchChar()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                error(parserExceptionTexts.LogicalUnexpectedBranch);
            }
        }

        result.merge(this.match("*/"));
        if (result.shouldStop) {
            result.recoverToSkippable();
            result.messageList.add(this.texts.MultilineCommentEndedUnexpectedly, this.sourceText.computeRange(beginIndex), MessageType.warning);
            return;
        }
    }

    // SkipBlank: skippable | successful

    skipBlank(): MatchResult<null> {
        return this.prepareMatchingForFoundation(null, `skip-blank`, (result: MatchResult<null>) => {
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

    skipMutilineBlank(): MatchResult<number> {
        return this.prepareMatchingForFoundation(0, `skip-multiline-blank`, (result: MatchResult<number>) => {
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

    skipMutilineBlankGtOne(): MatchResult<null> {
        return this.prepareMatchingForFoundation(null, `skip-multiline-blank-gt-1`, (result: MatchResult<null>) => {
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

    skipMutilineBlankLeqOne(): MatchResult<null> {
        return this.prepareMatchingForFoundation(null, `skip-multiline-blank-leq-1`, (result: MatchResult<null>) => {
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
    private prepareMatchingForFoundation<T>(value: T, name: string, myMatch: (result: MatchResult<T>) => void, thisArg?: unknown): MatchResult<T> {
        let result = new MatchResult<T>(value, this.sourceText.emptyRange);
        this.begin(name);
        myMatch.bind(thisArg)(result);
        this.end();
        if (result.failed) {
            this.sourceText.recover(result.range.begin);
        }
        result.range = this.sourceText.computeRange(result.range.begin);
        return result;
    }

    // **************** Terminal Token ****************

    // Match: failing | successful

    match(text: string): MatchResult<null> {
        return this.prepareMatchingForFoundation(null, `match'${text}'`, this.myMatch.bind(this, text));
    }

    private myMatch(text: string, result: Result) {
        if (this.sourceText.isText(text)) {
            result.mergeSuccessfulState();
            this.sourceText.recover(new Index(this.sourceText.mark().value + text.length, this.sourceText));
        }
        else {
            result.mergeFailedState();
        }
    }

    // MatchChar: failing | successful

    matchChar(): MatchResult<string> {
        return this.prepareMatchingForFoundation("", `matchChar`, this.myMatchChar, this);
    }

    private myMatchChar(result: MatchResult<string>) {
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

    // **************** Skipping ****************

    skipByBrackets(bracketsCount: number = 0, multiline: boolean = false): Range {
        let preIndex = this.sourceText.mark();
        while (true) {
            if (this.sourceText.isEOF()) {
                return this.sourceText.computeRange(preIndex);
            }
            else if (this.sourceText.isText("[")) {
                bracketsCount++;
                this.sourceText.move();
            }
            else if (this.sourceText.isText("]")) {
                bracketsCount--;
                this.sourceText.move();
                if (bracketsCount <= 0) {
                    return this.sourceText.computeRange(preIndex);
                }
            }
            else if (!multiline && this.isMultilineBlankGtOne()) {
                return this.sourceText.computeRange(preIndex);
            }
            else {
                this.sourceText.move();
            }
        }
    }

    skipToEndOfLine(): Range {
        let preIndex = this.sourceText.mark();
        while (true) {
            if (this.sourceText.isEOF()) {
                return this.sourceText.computeRange(preIndex);
            }
            else if (this.sourceText.isNewline()) {
                return this.sourceText.computeRange(preIndex);
            }

            else {
                this.sourceText.move();
            }
        }
    }

    skipToAfter(char: string, singleline: boolean = true): Range {
        let preIndex = this.sourceText.mark();
        while (true) {
            if (this.sourceText.isEOF()) {
                return this.sourceText.computeRange(preIndex);
            }
            else if (singleline && this.sourceText.isNewline()) {
                return this.sourceText.computeRange(preIndex);
            }
            else if (this.sourceText.isText(char)) {
                this.sourceText.move();
                return this.sourceText.computeRange(preIndex);
            }

            else {
                this.sourceText.move();
            }
        }
    }

    skipTo(char: string, singleline: boolean = true): Range {
        let preIndex = this.sourceText.mark();
        while (true) {
            if (this.sourceText.isEOF()) {
                return this.sourceText.computeRange(preIndex);
            }
            else if (singleline && this.sourceText.isNewline()) {
                return this.sourceText.computeRange(preIndex);
            }
            else if (this.sourceText.isText(char)) {
                return this.sourceText.computeRange(preIndex);
            }

            else {
                this.sourceText.move();
            }
        }
    }

    skipText(text: string): Range {
        if (this.sourceText.isText(text)) {
            let preIndex = this.sourceText.mark();
            this.sourceText.recover(new Index(this.sourceText.mark().value + text.length, this.sourceText));
            return this.sourceText.computeRange(preIndex);
        }
        return this.sourceText.emptyRange;
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
