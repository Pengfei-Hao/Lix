/**
* Parser: analyise the document, generate the sytnax tree
*/

import { Type } from "../sytnax-tree/type";
import { Node } from "../sytnax-tree/node";
import { TypeTable } from "../sytnax-tree/type-table";
import { LabelHandlerTable } from "./label-handler-table";
import { Math } from "./math/math";
import { Module } from "./module";
import { Config } from "../foundation/config";
import { Result } from "../foundation/result";
import { off, send } from "process";
import { Message, MessageType } from "../foundation/message";
import { notebooks } from "vscode";

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
    index: number;

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
    errorType: Type;

    // This table holds all the labels that lix contains with its handle function.
    labelHandlerTable: LabelHandlerTable;

    // Modules
    modules: Module[];
    mathModule: Math;

    // Configs
    configs: Config;

    // Message list
    messageList: Message[];
    lineRanges: [number, number][];
    process: string[];

    constructor(text: string, configs: Config) {
        this.text = text;
        this.index = 0;
        this.lineRanges = [];
        this.process = [];

        this.configs = configs;

        this.typeTable = new TypeTable(this);
        this.documentType = this.typeTable.add("document")!;
        this.paragraphType = this.typeTable.add("paragraph")!;
        this.textType = this.typeTable.add("text")!;
        this.settingType = this.typeTable.add("setting")!;
        this.settingParameterType = this.typeTable.add("setting-parameter")!;
        this.labelType = this.typeTable.add("label")!;
        this.errorType = this.typeTable.add("error")!;

        this.labelHandlerTable = new LabelHandlerTable(this);
        this.labelHandlerTable.add("title", this.matchLabelDefault.bind(this, 1), this);
        this.labelHandlerTable.add("author", this.matchLabelDefault.bind(this, 2), this);
        this.labelHandlerTable.add("section", this.matchLabelDefault.bind(this, 3), this);
        this.labelHandlerTable.add("subsection", this.matchLabelDefault.bind(this, 4), this);
        this.labelHandlerTable.add("_1", this.matchLabelDefault.bind(this, 5), this);

        this.syntaxTree = new Node(this.documentType);

        this.modules = [];
        this.mathModule = new Math(this);

        this.messageList = [];
    }

    init(text: string) {
        this.text = text;
        this.index = 0;
        this.lineRanges = [];
        this.process = [];

        // 统一行尾
        this.text = this.text.replace(/\r\n/g, "\n");
        this.text = this.text.replace(/\r/g, "\n");

        // 去除注释
        //this.text = this.text.replace(/\/\/.*\n/g, "\n").replace(/\/\*[^]*?\*\//g, " ");

        this.generateLineRanges();
    }

    // parse and 'match' series function

    // Parse & MatchDocument
    // Lex: Setting | Paragraph
    // Result: type: document, content: [unused], children: [Paragraph, Setting]
    parse(text: string) {
       this.init(text);
       this.mathModule.init();

        // parse
        this.matchDocument();
    }

    // All the 'match' functions begin scanning from the current index, and end in the index of first unmatched char if success, and end in uncertain index if not success.
    // If you are not sure that the match will success, use 'tryTo' to reset the index.

    // MatchDocument

    private matchDocument(): boolean {
        let preIndex = this.index;
        let result = this.myMatchDocument();
        this.end();
        this.syntaxTree.end = this.index;
        if (!result) {
            this.index = preIndex;
        }
        return result;
    }

    private myMatchDocument(): boolean {
        this.syntaxTree = new Node(this.documentType);
        this.messageList = [];
        this.begin("document");
        this.syntaxTree.begin = this.index;

        this.skipBlank();
        while (this.notEnd()) {
            let result = this.matchSetting();
            if (result.success) {
                this.syntaxTree.children.push(result.content);
                this.mergeMessage(this.messageList, result.messages);
                continue;
            }

            result = this.matchParagraph();
            if (result.success) {
                this.syntaxTree.children.push(result.content);
                this.mergeMessage(this.messageList, result.messages);
                continue;
            }

            // failed
            this.mergeMessage(this.messageList, result.messages);
            this.syntaxTree.children.push(new Node(this.errorType, "[[[Parse Failed!!!]]]"));
            this.sendMessage(this.messageList, "Match both paragraph and setting failed.");
            return false;
        }
        // success
        return true;
    }

    // MatchSetting
    // Lex:  # name : ... \n
    // Result: type: setting, content: (name of this setting), children: [type: settingParameter, content: (parameter of this setting), children: [unused]]
    private myMatchSetting(): Result<Node> {
        let node = new Node(this.settingType);
        let msg: Message[] = [];
        this.begin("setting");
        node.begin = this.index;

        if (!this.match("#")) {
            this.sendMessage(msg, "Missing '#'.");
            return new Result(false, node, msg);
        }

        this.skipBlank();

        let nameRes = this.matchName();
        if (!nameRes.success) {
            this.sendMessage(msg, "Missing name.");
            return new Result(false, node, msg);
        }
        node.content = nameRes.content;

        this.skipBlank();

        if (!this.match(":")) {
            this.sendMessage(msg, "Missing ':'.");
            return new Result(false, node, msg);
        }

        let command = "";
        while (this.notEnd()) {
            if(this.is("\n")) {
                this.move();
                break;
            }
            else {
                command += this.curChar();
                this.move();
            }
            
        }

        this.skipBlank();

        node.children.push(new Node(this.settingParameterType, command));
        return new Result(true, node, msg);
    }

    private matchSetting(): MatchResult {
        let preIndex = this.index;
        let result = this.myMatchSetting();
        this.end();
        result.content.end = this.index;
        if (!result.success) {
            this.index = preIndex;
        }
        return result;
    }

    // MatchParagraph
    // Lex:  ... \n\n
    // Result: type: paragraph, content: [unused], children: [type: text, content: (text), children: [unused]], [type: label]]
    private myMatchParagraph(): MatchResult {
        let node = new Node(this.paragraphType);
        let msg: Message[] = [];
        this.begin("paragraph");
        node.begin = this.index;

        if (!(this.notEnd() && !this.is(Parser.blank))) {
            this.sendMessage(msg, "Not a paragraph.");
            return new Result(false, node, msg);
        }

        let text = "";
        while (this.notEnd()) {
            let blankRes = this.matchBlank();
            if (blankRes.success) {
                if(blankRes.content >= 2) {
                    break;
                }
                text += " ";
            }


            else if (this.is("\\")) {
                this.move();
                if (this.notEnd()) {
                    switch (this.curChar()) {
                        case "\"": case "\\": case "[": case "]": case "{": case "}": case "'":
                            text += this.curChar();
                            break;
                        /*
                        case "t":
                            text += "\t";
                            break;
                        case "n":
                            text += "\n";
                            break;
                        case "r":
                            text += "\r";
                            break;
                        */
                        default:
                            text += "\\";
                            text += this.curChar();
                            this.sendMessage(msg, `\\${this.curChar()} do not represent any char.`, MessageType.warning);

                    }
                    this.move();
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

                let result = this.matchLabel();
                this.mergeMessage(msg, result.messages);
                if (!result.success) {
                    this.sendMessage(msg, "Match label failed.");
                    return new Result(false, node, msg);
                }
                node.children.push(result.content);
            }
            else {
                text += this.curChar();
                this.move();
            }
        }
        if (text !== "") {
            node.children.push(new Node(this.textType, text));
        }

        return new Result(true, node, msg);
    }

    private matchParagraph(): MatchResult {
        let preIndex = this.index;
        let result = this.myMatchParagraph();
        this.end();
        result.content.end = this.index;
        if (!result.success) {
            this.index = preIndex;
        }
        return result;
    }

    // MatchInteriorParagraph
    // Lex:  ... ]
    // Result: type: paragraph, content: [unused], children: [type: text, content: (text), children: [unused]], [type: label]]
    // Only use the children!
    private myMatchInteriorParagraph(): MatchResult {

        let node = new Node(this.paragraphType);
        let msg: Message[] = [];
        this.begin("interior-paragraph");

        let text = "";
        let count = 0;
        while (this.notEnd()) {
            let blankRes = this.matchBlank();
            if (blankRes.success) {
                if(blankRes.content >= 2) {
                    this.sendMessage(msg, "Interior paragraph should not have two or more newline.", MessageType.warning);
                }
                text += " ";
            }

            else if (this.is("\\")) {
                this.move();
                if (this.notEnd()) {
                    switch (this.curChar()) {
                        case "\"": case "\\": case "[": case "]": case "{": case "}": case "'":
                            text += this.curChar();
                            break;
                        /*
                        case "t":
                            text += "\t";
                            break;
                        case "n":
                            text += "\n";
                            break;
                        case "r":
                            text += "\r";
                            break;
                        */
                        default:
                            text += "\\";
                            text += this.curChar();
                            this.sendMessage(msg, `\\${this.curChar()} do not represent any char.`, MessageType.warning);

                    }
                    this.move();
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
                
                let result = this.matchLabel();
                this.mergeMessage(msg, result.messages);
                if (!result.success) {
                    this.sendMessage(msg, "Match label failed.");
                    return new Result(false, node, msg);
                }

                node.children.push(result.content);
            }

            else if (this.is("]")) {
                this.move();
                if (text !== "") {
                    node.children.push(new Node(this.textType, text));
                }
                return new Result(true, node, msg);

            }
            else {
                text += this.curChar();
                this.move();
            }
        }

        if (text !== "") {
            node.children.push(new Node(this.textType, text));
        }

        this.sendMessage(msg, "Missing ']' in interior paragraph.", MessageType.warning);
        return new Result(true, node, msg);
    }

    private matchInteriorParagraph(): MatchResult {
        let preIndex = this.index;
        let result = this.myMatchInteriorParagraph();
        this.end();
        if (!result.success) {
            this.index = preIndex;
        }
        return result;
    }

    // MatchLabel
    // Lex: [ name ... ]
    // Result: type: (depends on label), content: (depens on label), children: (depends on the label)
    private myMatchLabel(): MatchResult {
        let node = new Node(this.labelType);
        let msg: Message[] = [];
        this.begin("label");

        this.move();
        this.skipBlank();

        let name = this.matchName();
        if (!name.success) {
            this.sendMessage(msg, "Missing name.");
            return new Result(false, node, msg);
        }
        node.content = name.content;

        this.skipBlank();

        let handle = this.labelHandlerTable.getHandler(name.content);
        if (handle === undefined) {
            this.sendMessage(msg, `Label name '${name.content}' not found.`);
            return new Result(false, node, msg);
        }

        let result = handle();
        this.mergeMessage(msg, result.messages);
        if (!result.success) {
            this.sendMessage(msg, `'${name.content}' label failed.`);
            return new Result(false, node, msg);
        }

        return new Result(true, result.content, msg);
    }

    private matchLabel(): MatchResult {
        let preIndex = this.index;
        let result = this.myMatchLabel();
        this.end();
        result.content.begin = preIndex;
        result.content.end = this.index;
        if (!result.success) {
            this.index = preIndex;
        }
        return result;
    }

    // MatchLabelDefault (Temporarily!!)
    // Lex: title | author | section ...
    // Result: type: label, content: (name of label), children: (depends on the label)
    private matchLabelDefault(id: number): MatchResult {
        let res = this.matchInteriorParagraph();
        res.content.type = this.labelType;
        let label = "";
        switch(id) {
            case 1:
                label = "title";
                break;
            case 2:
                label = "author";
                break;
            case 3:
                label = "section";
                break;
            case 4:
                label = "subsection";
                break;
            default:
                res.success = false;
                this.sendMessage(res.messages, "Label (default) name not found.")
                return res;
        }
        res.content.content = label;
        return res;
    }

    // MatchName
    // Lex: text char
    // Result: string

    matchName(): Result<string> {
        let preIndex = this.index;
        if (!this.notEnd()) {
            return new Result(false, "", []);
        }
        if (this.is(Parser.nameChar)) {
            var temp = this.curChar();
            while (this.nextIs(Parser.nameChar)) {
                this.move();
                temp += this.curChar();
            }
            this.move();
            return new Result(true, temp, []);
        }
        else {
            this.index = preIndex;
            return new Result(false, "", []);
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
        for(let i = 0; i < length; i++, this.move()) {
            if(this.curChar() != text[i]) {
                result = false;
                break;
            }
        }
        return result;
    }

    matchBlank(): Result<number> {
        let count = 0;
        let success = false;
        while(this.notEnd()) {
            if(this.is(Parser.blank)) {
                success = true;
                do {
                    if (this.is(Parser.newline)) {
                        count++;
                    }
                    this.move();
                } while(this.notEnd() && this.is(Parser.blank));
            }
            else if(this.is("/") && this.nextIs("/")) {
                success = true;
                this.move(2);
                while(this.notEnd()) {
                    if(this.is(Parser.newline)) {
                        this.move();
                        break;
                    }
                    this.move();
                }
            }
            else if(this.is("/") && this.nextIs("*")) {
                success = true;
                this.move(2);
                while(this.notEnd()) {
                    if(this.is("*") && this.nextIs("/")) {
                        this.move(2);
                        break;
                    }
                    this.move();
                }
            }
            else {
                break;
            }
        }
        return new Result(success, count, []);
    }

    // SkipBlank
    // Lex: all the blank char
    // Result: null
    skipBlank() {
        while(this.notEnd()) {
            if(this.is(Parser.blank)) {
                do {
                    this.move();
                } while(this.notEnd() && this.is(Parser.blank));
            }
            else if(this.is("/") && this.nextIs("/")) {
                this.move(2);
                while(this.notEnd()) {
                    if(this.is(Parser.newline)) {
                        this.move();
                        break;
                    }
                    this.move();
                }
            }
            else if(this.is("/") && this.nextIs("*")) {
                this.move(2);
                while(this.notEnd()) {
                    if(this.is("*") && this.nextIs("/")) {
                        this.move(2);
                        break;
                    }
                    this.move();
                }
            }
            else {
                break;
            }
        }
    }

    // Line and position

    generateLineRanges() {
        let range: [number, number] = [0, 0]; // [begin, end)
        for(let i = 0; i < this.text.length; i++, this.move()) {
            if(this.is(Parser.newline)) {
                range[1] = i + 1;
                this.lineRanges.push(range);
                range = [0, 0];
                range[0] = i + 1;
            }
        }
        if(range[0] < this.text.length) {
            range[1] = this.text.length;
        }
        this.lineRanges.push(range);
        this.index = 0;
    }

    getLineAndPosition(): {line: number, position: number} | undefined {
        for(let i = 0; i < this.lineRanges.length; i++) {
            if(this.lineRanges[i][0] <= this.index && this.index < this.lineRanges[i][1]) {
                return {line: i + 1, position: this.index - this.lineRanges[i][0] + 1};
            }
        }
        return undefined;
    }

    getIndex(line: number, position: number): number | undefined {
        if(0 <= line - 1 && line -1 < this.lineRanges.length) {
            if(position >= 0 && position + this.lineRanges[line][0] - 1 < this.lineRanges[line][1]) {
                return position + this.lineRanges[line][0] - 1;
            }
        }
        return undefined;
    }

    // process

    begin(process: string) {
        this.process.push(process);
    }

    end() {
        this.process.pop();
    }

    // message

    sendMessage(messageList: Message[], message: string, type: MessageType = MessageType.error, code: number = -1) {
        let lp = this.getLineAndPosition() ?? {line: -1, position: -1};
        let pro = this.process.slice();
        messageList.push(new Message(message, type, code, lp.line, lp.position, pro));
    }

    mergeMessage(list: Message[], preList: Message[]) {
        for(let msg of preList) {
            list.push(msg);
        }
    }
    // Fundamental methods of parser

    // current char

    curChar(): string {
        return this.text[this.index];
    }

    // 'is' series functions

    static nameChar = /[A-Za-z0-9-]/;
    static blank = /[\t \v\f\r\n]/;
    static newline = /[\r\n]/;

    // must ensure not end.
    is(char: string): boolean;
    is(exp: RegExp): boolean;
    is(condition: string | RegExp): boolean;
    is(condition: string | RegExp): boolean {
        if (typeof (condition) === "string") {
            return this.curChar() === condition;
        }
        else {
            return condition.exec(this.curChar()) !== null;
        }

    }

    nextIs(char: string): boolean;
    nextIs(exp: RegExp): boolean;
    nextIs(condition: string | RegExp) {
        if (this.notEnd(1)) {
            this.move();
            var res = this.is(condition);
            this.move(-1);
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

    /*
    private moveTo(index: number) {
        this.index = index;
    }
    */

    move(offset: number = 1) {
        this.index += offset;
    }

    /*
    moveForward() {
        this.move(1);
    }

    moveBackward() {
        this.move(-1);
    }
    */
}