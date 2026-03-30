import { error } from "../foundation/error";
import { parserExceptionTexts } from "./texts";

export class SourceText {

    // Text and index of the source text
    private text: string; // EOF is treated as an element after the last character
    private index: number; // [0, length], can be equal to length

    // Ranges of every line
    private lineRanges: number[]; // [0, a, ..., z, length + 1], range is [0, a - 1], [a, b - 1] ..., [z, length], EOF is equal to line break

    constructor() {
        this.text = "";
        this.index = 0;
        this.lineRanges = [0, 1];
    }

    init(text: string) {
        this.text = text;
        this.index = 0;
        this.lineRanges = [0, 1];

        // 统一行尾
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
    // isText(candidates: Set<string>): boolean;
    // isText(textOrCandidates: string | Set<string>): boolean {
    //     if (typeof (textOrCandidates) === "string") {
    //         return this.isChar() && this.text.startsWith(textOrCandidates, this.index);
    //     }
    //     textOrCandidates.forEach((candidate) => {
    //         if (this.isChar() && this.text.startsWith(candidate, this.index)) {
    //             return true;
    //         }
    //     });
    //     return false;
    // }

    findLongestMatch(candidates: Set<string>, maxLength: number): string | undefined {
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
            error(parserExceptionTexts.IndexOutOfBoundsInclusive);
        }
    }

    private assertIndexInBoundsExclusive() {
        if (this.index < 0 || this.index >= this.text.length) {
            error(parserExceptionTexts.IndexOutOfBoundsExclusive);
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
        this.index += this.isSurrogatePair() ? 2 : 1;
        this.assertIndexInBoundsInclusive();
    }

    getIndex(): number {
        return this.index;
    }

    setIndex(index: number) {
        this.index = index;
        this.assertIndexInBoundsInclusive();
    }

    // **************** Line Ranges ****************

    // Example: `abc\nde\EOF`, length = 6, lineRanges = [0, 4, 7] = [0, ..., length + 1], lines are [0, 4), [4, 7)
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
    indexToLineAndCharacter(index: number = this.index, truncate: boolean = true): { line: number, character: number } {
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

        error(parserExceptionTexts.GetLineAndCharacterOutOfBounds);
    }

    lineAndCharacterToIndex(line: number, character: number, truncate: boolean = true): number {
        line = (truncate && line < 0) ? 0 : line;
        line = (truncate && line >= this.lineRanges.length - 1) ? this.lineRanges.length - 2 : line;
        if (0 <= line && line < this.lineRanges.length - 1) {
            character = (truncate && character < 0) ? 0 : character;
            character = (truncate && character >= this.lineRanges[line + 1] - this.lineRanges[line]) ? this.lineRanges[line + 1] - this.lineRanges[line] - 1 : character;
            if (character >= 0 && character + this.lineRanges[line] < this.lineRanges[line + 1]) {
                return character + this.lineRanges[line];
            }
        }

        error(parserExceptionTexts.GetIndexOutOfBounds);
    }
}