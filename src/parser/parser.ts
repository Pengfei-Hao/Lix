/**
* Parser: analyise the document, generate the sytnax tree
*/

import { Type } from "../sytnax-tree/type";
import { Node } from "../sytnax-tree/node";
import { TypeTable } from "../sytnax-tree/type-table";
import { LabelHandlerTable } from "./label-handler-table";
import { Math } from "./math/math";
import { Module } from "./module";


export class Result<T> {
    constructor(public success: boolean, public content: T) {
    }
}
export type MatchResult = Result<Node>;

/*
export function init(source: string) {
    syntaxTree.init(); // must be placed before math.init()
    math.init();
    label.init();


    text = source;
    ast = new Node(Type.document);
}
*/

export class Parser {

    // Text and index of the source text.
    private text: string;
    private index: number;

    // Generated syntax tree will be storaged here, type table holds all the type of node.
    syntaxTree: Node;
    typeTable: TypeTable;

    // Types in type table
    documentType: Type;
    paragraphType: Type;
    textType: Type;
    settingType: Type;
    settingParameterType: Type;
    labelType: Type;

    // This table holds all the labels that lix contains with its handle function.
    labelHandlerTable: LabelHandlerTable;

    // Modules
    modules: Module[];
    mathModule: Math;
    constructor(text: string) {
        this.text = text;
        this.index = 0;

        this.typeTable = new TypeTable(this);
        this.documentType = this.typeTable.add("document")!;
        this.paragraphType = this.typeTable.add("paragraph")!;
        this.textType = this.typeTable.add("text")!;
        this.settingType = this.typeTable.add("setting")!;
        this.settingParameterType = this.typeTable.add("setting-parameter")!;
        this.labelType = this.typeTable.add("label")!;

        this.labelHandlerTable = new LabelHandlerTable(this);
        this.labelHandlerTable.add("title", this.matchInteriorParagraph, this);
        this.labelHandlerTable.add("author", this.matchInteriorParagraph, this);
        this.labelHandlerTable.add("section", this.matchInteriorParagraph, this);
        this.labelHandlerTable.add("subsection", this.matchInteriorParagraph, this);
        this.labelHandlerTable.add("_1", this.matchInteriorParagraph, this);

        this.syntaxTree = new Node(this.documentType);

        this.modules = [];
        this.mathModule = new Math(this);
    }

    /*
    getSyntaxTree(): Node {
        return this.syntaxTree;
    }
    */

    // parse and 'match' series function

    parse() {
        // 统一行尾
        this.text = this.text.replace(/\r\n/g, "\n");
        this.text = this.text.replace(/\r/g, "\n");

        // 去除注释
        this.text = this.text.replace(/\/\/.*\n/g, "\n").replace(/\/\*[^]*?\*\//g, " ");

        // parse
        this.skipBlank();
        while (this.notEnd()) {
            let result = this.tryToMatchSetting();
            if (result.success) {
                this.syntaxTree.children.push(result.content);
                continue;
            }

            result = this.tryToMatchParagraph();
            if (result.success) {
                this.syntaxTree.children.push(result.content);
                continue;
            }

            // failed
            this.syntaxTree.children.push(new Node(this.paragraphType, "[[[Parse Failed!!!]]]"));
            return;
        }
        // success

    }

    // All the 'match' functions begin scanning from the current index, and end in the index of first unmatched char if success, and end in uncertain index if not success.
    // If you are not sure that the match will success, use 'tryTo' to reset the index.

    // MatchSetting
    // Lex:  # name : ... \n
    // Result: type: setting, content: (name of this setting), children: [type: settingParameter, content: (parameter of this setting), children: [unused]]
    private matchSetting(): Result<Node> {
        let node = new Node(this.settingType);

        if (!this.match("#")) {
            return new Result(false, node);
        }

        this.skipBlank();

        let nameRes = this.tryToMatchName();
        if (!nameRes.success) {
            return new Result(false, node);
        }
        node.content = nameRes.content;

        this.skipBlank();

        if (!this.match(":")) {
            return new Result(false, node);
        }

        var command = "";
        while (this.notEnd() && !this.is("\n")) {
            command += this.curChar();
            this.moveForward();
        }

        this.skipBlank();

        node.children.push(new Node(this.settingParameterType, command));
        return new Result(true, node);
    }

    private tryToMatchSetting(): MatchResult {
        let preIndex = this.index;
        let result = this.matchSetting();
        if (!result.success) {
            this.index = preIndex;
        }
        return result;
    }

    // MatchParagraph
    // Lex:  ... \n\n
    // Result: type: paragraph, content: [unused], children: [type: text, content: (text), children: [unused]], [type: label]]
    private matchParagraph(): MatchResult {
        let node = new Node(this.paragraphType);

        if (!(this.notEnd() && !this.is(Parser.blank))) {
            return new Result(false, node);
        }

        let text = "";
        while (this.notEnd()) {
            if (this.is(Parser.blank)) {
                let count = 0;
                do {
                    if (this.is(Parser.newline)) {
                        count++;
                    }
                    this.moveForward();
                } while (this.notEnd() && this.is(Parser.blank));

                if (count >= 2) {
                    break;
                }
                else {
                    text += " ";
                }
            }

            else if (this.is("\\")) {
                this.moveForward();
                if (this.notEnd()) {
                    switch (this.curChar()) {
                        case "\"": case "\\": case "[": case "]": case "{": case "}": case "'":
                            text += this.curChar();
                            break;

                        case "t":
                            text += "\t";
                            break;
                        case "n":
                            text += "\n";
                            break;
                        case "r":
                            text += "\r";
                            break;
                        default:
                            text += "\\";
                            text += this.curChar();

                    }
                    this.moveForward();
                }
                else {
                    text += "\\";
                }
            }

            else if (this.is("[")) {
                if (text !== "") {
                    node.children.push(new Node(this.textType, text));
                    text = "";
                }

                let result = this.tryToMatchLabel();
                if (!result.success) {
                    return new Result(false, node);
                }

                node.children.push(result.content);
            }
            else {
                text += this.curChar();
                this.moveForward();
            }
        }
        if (text !== "") {
            node.children.push(new Node(this.textType, text));
        }

        return new Result(true, node);
    }

    private tryToMatchParagraph(): MatchResult {
        let preIndex = this.index;
        let result = this.matchParagraph();
        if (!result.success) {
            this.index = preIndex;
        }
        return result;
    }

    // MatchInteriorParagraph
    // Lex:  ... ]
    // Result: type: paragraph, content: [unused], children: [type: text, content: (text), children: [unused]], [type: label]]
    // Only use the children!
    private matchInteriorParagraph(): MatchResult {
        var text = "";
        var node = new Node(this.paragraphType);
        while (this.notEnd()) {
            if (this.is(Parser.blank)) {
                var count = 0;
                do {
                    if (this.is(Parser.newline)) {
                        count++;
                    }
                    this.moveForward();
                } while (this.notEnd() && this.is(Parser.blank));

                if (count >= 2) {
                    break;
                }
                else {
                    text += " ";
                }
            }

            else if (this.is("\\")) {
                this.moveForward();
                if (this.notEnd()) {
                    switch (this.curChar()) {
                        case "\"": case "\\": case "[": case "]": case "{": case "}": case "'":
                            text += this.curChar();
                            break;

                        case "t":
                            text += "\t";
                            break;
                        case "n":
                            text += "\n";
                            break;
                        case "r":
                            text += "\r";
                            break;
                        default:
                            text += "\\";
                            text += this.curChar();

                    }
                    this.moveForward();
                }
                else {
                    text += "\\";
                }
            }
            else if (this.is("[")) {
                if (text !== "") {
                    node.children.push(new Node(this.textType, text));
                    text = "";
                }
                
                var result = this.tryToMatchLabel();
                if (!result.success) {
                    return new Result(false, node);
                }

                node.children.push(result.content);

            }

            else if (this.is("]")) {
                this.moveForward();
                if (text !== "") {
                    node.children.push(new Node(this.textType, text));
                }
                return new Result(true, node);

            }
            else {
                text += this.curChar();
                this.moveForward();
            }
        }

        if (text !== "") {
            node.children.push(new Node(this.textType, text));
        }

        return new Result(false, node);
    }

    private tryToMatchInteriorParagraph(): MatchResult {
        let preIndex = this.index;
        let result = this.matchInteriorParagraph();
        if (!result.success) {
            this.index = preIndex;
        }
        return result;
    }

    // MatchLabel
    // Lex: [ name ... ]
    // Result: type: label, content: (name of label), children: (depends on the label)
    private matchLabel(): MatchResult {
        let node = new Node(this.labelType);

        this.moveForward();
        this.skipBlank();

        let name = this.tryToMatchName();
        if (!name.success) {
            return new Result(false, node);
        }
        node.content = name.content;

        this.skipBlank();

        let result: MatchResult;

        let handle = this.labelHandlerTable.getHandler(name.content);
        if (handle === undefined) {
            return new Result(false, node);
        }

        let preIndex = this.index;
        result = handle();
        if (!result.success) {
            this.index = preIndex;
            return new Result(false, node);
        }

        node.children = result.content.children;
        return new Result(true, node);
    }

    private tryToMatchLabel(): MatchResult {
        let preIndex = this.index;
        let result = this.matchLabel();
        if (!result.success) {
            this.index = preIndex;
        }
        return result;
    }

    // MatchName
    // Lex: text char
    // Result: string

    tryToMatchName(): Result<string> {
        let preIndex = this.index;
        if (!this.notEnd()) {
            return new Result(false, "");
        }
        if (this.is(Parser.nameChar)) {
            var temp = this.curChar();
            while (this.nextIs(Parser.nameChar)) {
                this.moveForward();
                temp += this.curChar();
            }
            this.moveForward();
            return new Result(true, temp);
        }
        else {
            this.index = preIndex;
            return new Result(false, "");
        }
    }

    // Match
    // Lex: text
    // Result: boolean
    match(text: string): boolean {
        let length = text.length;
        if(!this.notEnd(length-1)) {
            return false;
        }
        let result = true;
        for(let i = 0; i < length; i++, this.moveForward()) {
            if(this.curChar() != text[i]) {
                result = false;
                break;
            }
        }
        return result;
    }

    // SkipBlank
    // Lex: all the blank char
    // Result: null
    skipBlank() {
        if (this.is(Parser.blank)) {
            while (this.nextIs(Parser.blank)) {
                this.moveForward();
            }
            this.moveForward();
        }
    }

    // fundenmental functions

    // tryTo function
    /*
    tryTo<T>(match: () => Result<T>): Result<T> {
        let preIndex = this.index;
        let result = match.call(this);
        if (!result.success) {
            this.index = preIndex;
        }
        return result;
    }
    */

    // current char

    curChar(): string {
        return this.text[this.index];
    }

    // 'is' series functions

    static nameChar = /[A-Za-z0-9-]/;
    static blank = /[\t \v\f\r\n]/;
    static newline = /[\r\n]/;

    is(char: string): boolean;
    is(exp: RegExp): boolean;
    is(condition: string | RegExp): boolean;
    is(condition: string | RegExp): boolean {
        if (typeof (condition) === "string") {
            return this.text[this.index] === condition;
        }
        else {
            return condition.exec(this.text[this.index]) !== null;
        }

    }

    nextIs(char: string): boolean;
    nextIs(exp: RegExp): boolean;
    nextIs(condition: string | RegExp) {
        if (this.notEnd(1)) {
            this.moveForward();
            var res = this.is(condition);
            this.moveBackward();
            return res;
        }
        else {
            return false;
        }
    }

    // index control

    notEnd(offset: number = 0): boolean {
        return this.index + offset < this.text.length;
    }

    moveTo(index: number) {
        this.index = index;
    }

    move(offset: number) {
        this.index += offset;
    }

    moveForward() {
        this.move(1);
    }

    moveBackward() {
        this.move(-1);
    }

}