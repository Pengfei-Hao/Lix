import { error } from "../foundation/error";
import { commonExceptionTexts } from "./texts";

export class Index {

    constructor(
        public readonly value: number,
        private sourceText: SourceText
    ) {
    }
}

export class Range {

    constructor(
        public readonly begin: Index,
        public readonly end: Index,
        private sourceText: SourceText
    ) {
    }
}

export class Position {

    constructor(
        public readonly line: number,
        public readonly character: number,
    ) {
    }
}

export interface ReadonlySourceText {
    indexToPosition(index: Index, truncate?: boolean): Position;
    positionToIndex(position: Position, truncate?: boolean): Index;
}

export class SourceText implements ReadonlySourceText {

    // EOF is treated as an element after the last character, its index is length
    // index i requires 0 <= i <= length
    // range [a, b) requires 0 <= a <= b <= length

    // Text and index of the source text
    private text: string;
    private index: number;

    // Ranges of every line
    private lineRanges: number[]; // [0, a, ..., z, length + 1], range is [0, a - 1], [a, b - 1] ..., [z, length], EOF is equal to line break. Example: `abc\nde\EOF`, length = 6, lineRanges = [0, 4, 7] = [0, ..., length + 1], lines are [0, 4), [4, 7)

    constructor() {
        this.text = "";
        this.index = 0;
        this.lineRanges = [0, 1];
    }

    load(text: string) {
        this.text = text;
        this.index = 0;
        this.lineRanges = [0, 1];

        // Normalize newlines to \n
        this.text = this.text.replace(/\r\n/g, "\n");
        this.text = this.text.replace(/\r/g, "\n");

        this.computeLineRanges();
    }

    // **************** Character Tests ****************

    private static nameChar = /[0-9a-zA-Z]/;
    private static nameWithHyphen = /[A-Za-z0-9-]/;
    private static number = /[0-9]/;
    private static blank = /[\t \v\f]/;
    private static newline = /[\r\n]/;

    isName(): boolean {
        return this.is(SourceText.nameChar);
    }

    isNameOrHyphen(): boolean {
        return this.is(SourceText.nameWithHyphen);
    }

    isDigit(): boolean {
        return this.is(SourceText.number);
    }

    isBlank(): boolean {
        return this.is(SourceText.blank);
    }

    isNewline(): boolean {
        return this.is(SourceText.newline);
    }

    // This method tests the following characters
    isText(text: string): boolean {
        return this.isChar() && this.text.startsWith(text, this.index);
    }

    isOneOfTexts(candidates: Set<string>, maxLength: number): string | undefined {
        if (candidates.size === 0) {
            return undefined;
        }
        for (let length = maxLength; length > 0; length--) {
            const str = this.text.slice(this.index, this.index + length);
            if (candidates.has(str)) {
                return str;
            }
        }
        return undefined;
    }

    // This method only tests the current character
    private is(char: string): boolean;
    private is(reg: RegExp): boolean;
    private is(charOrReg: string | RegExp): boolean {
        if (typeof (charOrReg) === "string") {
            return this.isChar() && this.text.startsWith(charOrReg, this.index);
        }
        return this.isChar() && charOrReg.exec(this.peek()) !== null;
    }

    isEOF(): boolean {
        return this.index === this.text.length;
    }

    isChar(): boolean {
        return this.index < this.text.length;
    }

    // **************** Index Control ****************

    private assertIndexInBoundsInclusive() {
        if (this.index < 0 || this.index > this.text.length) {
            error(commonExceptionTexts.IndexOutOfBoundsInclusive);
        }
    }

    private assertIndexInBoundsExclusive() {
        if (this.index < 0 || this.index >= this.text.length) {
            error(commonExceptionTexts.IndexOutOfBoundsExclusive);
        }
    }

    private isSurrogatePair(): boolean {
        return this.text.charCodeAt(this.index) !== this.text.codePointAt(this.index);
    }

    peek(): string {
        this.assertIndexInBoundsExclusive();
        return this.text.slice(this.index, this.index + (this.isSurrogatePair() ? 2 : 1));
    }

    move() {
        this.assertIndexInBoundsExclusive();
        this.index += this.isSurrogatePair() ? 2 : 1;
        this.assertIndexInBoundsInclusive();
    }

    mark(): Index {
        return new Index(this.index, this);
    }

    recover(marker: Index) {
        this.index = marker.value;
        this.assertIndexInBoundsInclusive();
    }

    // **************** Position and Index Conversion ****************

    private computeLineRanges() {
        this.lineRanges = [];
        this.lineRanges.push(0);
        let i = 0;
        for (; i < this.text.length; i++, this.index++) {
            if (this.isNewline()) {
                this.lineRanges.push(i + 1);
            }
        }
        this.lineRanges.push(i + 1);
        this.index = 0;
    }

    // index should be in [0, length], if 'truncate' is true, the index will be truncated to [0, length]
    indexToPosition(index: Index, truncate: boolean = true): Position {
        let value = index.value;
        if (truncate && value < 0) {
            value = 0;
        }
        else if (truncate && value >= this.text.length + 1) {
            value = this.text.length;
        }
        for (let i = 0; i < this.lineRanges.length - 1; i++) {
            if (this.lineRanges[i] <= value && value < this.lineRanges[i + 1]) {
                return new Position(i, value - this.lineRanges[i]);
            }
        }

        error(commonExceptionTexts.GetPositionOutOfBounds);
    }

    positionToIndex(position: Position, truncate: boolean = true): Index {
        let { line, character } = position;
        line = (truncate && line < 0) ? 0 : line;
        line = (truncate && line >= this.lineRanges.length - 1) ? this.lineRanges.length - 2 : line;
        if (0 <= line && line < this.lineRanges.length - 1) {
            character = (truncate && character < 0) ? 0 : character;
            character = (truncate && character >= this.lineRanges[line + 1] - this.lineRanges[line]) ? this.lineRanges[line + 1] - this.lineRanges[line] - 1 : character;
            if (character >= 0 && character + this.lineRanges[line] < this.lineRanges[line + 1]) {
                return new Index(character + this.lineRanges[line], this);
            }
        }

        error(commonExceptionTexts.GetIndexOutOfBounds);
    }

    // **************** Range Computation ****************

    computeRange(begin: Index, end?: Index): Range {
        return new Range(begin, end ?? this.mark(), this);
    }

    unionRange(beginRange: Range, endRange: Range): Range {
        return new Range(beginRange.begin, endRange.end, this);
    }

    get fullRange(): Range {
        return new Range(new Index(0, this), new Index(this.text.length, this), this);
    }

    get emptyRange(): Range {
        return new Range(this.mark(), this.mark(), this);
    }

    get currentCharRange(): Range {
        if (this.isEOF()) {
            return new Range(this.mark(), this.mark(), this);
        }
        return new Range(this.mark(), new Index(this.index + (this.isSurrogatePair() ? 2 : 1), this), this);
    }
}