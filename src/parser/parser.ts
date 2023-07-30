 /**
 * Parser: analyise the document, generate the nodes
 */

import { integer } from "vscode-languageclient";
import * as AST from './AST';
import { Node, Type } from "./AST";
import * as label from './label';
import { MatchFunction, MatchResult } from "./label";
import { notebooks } from "vscode";
import * as math from './math';
var text: string = "";

export function init(source: string) {
    AST.init();
    label.init();
    math.init();

    text = source;
    ast = new Node(Type.document);
}

let ast: Node;

export function getAST(): Node {
    return ast;
}

// parse and 'match' series function

export function parse() {
    //initParser("line1 .// a中文bc \nline2 ... /* aaa \nline3*  / xxx */\n\nline4 // abc\nlint5/* aa中文 */");
    
    //initParser("  #paper : a4\n\n #size\t: 500\nline1   is  [bold a] nt r \nline 2\n \t \t [LiX] is [delete very]   good.\t\n   \t\n   \n\t\n line3 [emph[bold comes]].\n\n */");

    //initParser("#paper:a4\n [title LiX Document]\n\n[author Mateo Hao]\n\n [date 2023.4.22]\n\n[section Introduction]\n\n This is a short Introduction to LiX.\n");

    // 统一行尾
    text = text.replace(/\r\n/g, "\n");
    text = text.replace(/\r/g, "\n");

    // 去除注释
    text = text.replace(/\/\/.*\n/g, "\n").replace(/\/\*[^]*?\*\//g, " ");

    // parse
    index = 0;
    skipBlank();
    while(notEnd()) {
        let result = tryTo(matchSetting);
        if(result.success) {
            ast.children.push(result.node);
            continue;
        }
        
        result = tryTo(matchParagraph);
        if(result.success) {
            ast.children.push(result.node);
            continue;
        }
        
        // failed
        ast.children.push(new Node(Type.paragraph, "[[[Parse Failed!!!]]]"));
        return;
    }
    // success
    
}


function myToString(node: Node, level: string): string {
    /*
    if(node.type === Type.paragraph) {
        return `${level}"${node.content}"`;
    }
    else if(node.type === Type.setting) {
        return `#${level}${node.content}`;
    }
    else {
        let res = `${level}${node.content}`;
        for(let n of node.children) {
            res += "\n";
            res += myToString(n, level + "\t");
        }
        return res;
    }
    */
    let res = `${level}${AST.getName(node.type)}: "${node.content}"`
    if(node.children.length === 0) {
        return res;
    }
    else {
        for(let n of node.children) {
            res += "\n";
            res += myToString(n, level + "\t");
        }
        return res;
    }
}

export function toString(node: Node): string {
    return myToString(node, "");
}

function matchSetting(): MatchResult {
    let node = new Node(Type.setting);

    if (!(notEnd() && is("#"))) {
        return new MatchResult(false, node);
    }

    moveForward();
    skipBlank();

    var name = tryToMatchName();
    if (name === undefined) {
        return new MatchResult(false, node);
    }
    node.content = name;

    skipBlank();
    if (!(notEnd() && is(":"))) {
        return new MatchResult(false, node);
    }

    moveForward();

    var command = "";
    while (notEnd() && !is("\n")) {
        command += curChar();
        moveForward();
    }

    skipBlank();
    node.children.push(new Node(Type.settingParameter, command));
    return new MatchResult(true, node);
}

function matchParagraph(): MatchResult {
    var text = "";
    var node = new Node(Type.paragraph);

    if (!(notEnd() && !is(blank))) {
        return new MatchResult(false, node);
    }

    while (notEnd()) {
        if (is(blank)) {
            let count = 0;
            do {
                if (is(newline)) {
                    count++;
                }
                moveForward();
            } while (notEnd() && is(blank));


            if (count >= 2) {
                break;
            }
            else {
                text += " ";
            }
        }

        else if (is("\\")) {
            moveForward();
            if (notEnd()) {
                switch (curChar()) {
                    case "\"": case "\\": case "[": case "]": case "{": case "}": case "'":
                        text += curChar();
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
                        text += curChar();

                }
                moveForward();
            }
            else {
                text += "\\";
            }
        }

        else if (is("[")) {
            if (text !== "") {
                node.children.push(new Node(Type.text, text));
            }

            text = "";
            let result = tryTo(matchLabel);
            if (!result.success) {
                return new MatchResult(false, node);
            }

            node.children.push(result.node);
        }
        else {
            text += curChar();
            moveForward();
        }
    }
    if (text !== "") {
        node.children.push(new Node(Type.text, text));
    }
    return new MatchResult(true, node);
}

export function matchParagraphInside(): MatchResult {
    var text = "";
    var node = new Node(Type.paragraph);
    while (notEnd()) {
        if (is(blank)) {
            var count = 0;
            do {
                if (is(newline)) {
                    count++;
                }
                moveForward();
            } while (notEnd() && is(blank));

            if (count >= 2) {
                break;
            }
            else {
                text += " ";
            }
        }

        else if (is("\\")) {
            moveForward();
            if (notEnd()) {
                switch (curChar()) {
                    case "\"": case "\\": case "[": case "]": case "{": case "}": case "'":
                        text += curChar();
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
                        text += curChar();

                }
                moveForward();
            }
            else {
                text += "\\";
            }
        }
        else if (is("[")) {
            if (text !== "") {
                node.children.push(new Node(Type.text, text));
            }
            text = "";
            var result = tryTo(matchLabel);
            if (!result.success) {

                return new MatchResult(false, node);
            }

            node.children.push(result.node);

        }

        else if (is("]")) {
            moveForward();
            if (text !== "") {
                node.children.push(new Node(Type.text, text));
            }
            return new MatchResult(true, node);

        }
        else {
            text += curChar();
            moveForward();
        }
    }

    if (text !== "") {
        node.children.push(new Node(Type.text, text));
    }

    return new MatchResult(false, node);
}

export function matchLabel(): MatchResult {
    let node = new Node(Type.label);

    moveForward();
    skipBlank();

    let name = tryToMatchName();
    if (name === undefined) {
        return new MatchResult(false, node);
    }
    node.content = name;

    skipBlank();

    let result: MatchResult;
   
    let match = label.getMatchFunction(name);
    if (match === undefined) {
        return new MatchResult(false, node);
    }

    result = tryTo(match);

    if (!result.success) {
        return new MatchResult(false, node);
    }

    node.children = result.node.children;
    return new MatchResult(true, node);
}

export function tryToMatchName(): string | undefined {
    let preIndex = index;
    if(!notEnd()) {
        return undefined;
    }
    if(is(name)) {
        var temp = curChar();
        while(nextIs(name)) {
            moveForward();
            temp += curChar();
        }
        moveForward();
        return temp;
    }
    else {
        index = preIndex;
        return undefined;
    }
}

export function skipBlank() {
    if(is(blank)) {
        while(nextIs(blank)) {
            moveForward();
        }
        moveForward();
    }
}

// try function

export function tryTo(match: MatchFunction): MatchResult {
    let preIndex = index;
    let result = match();
    if(!result.success) {
        index = preIndex;
    }
    return result;
}

// current char

export function curChar(): string {
    return text[index];
}

// 'is' series functions

export const name = /[A-Za-z0-9-]/;
export const blank = /[\t \v\f\r\n]/;
export const newline = /[\r\n]/;

export function is(char: string): boolean;
export function is(exp: RegExp): boolean;
export function is(condition: string | RegExp): boolean;
export function is(condition: string | RegExp): boolean {
    if(typeof(condition) === "string") {
        return text[index] === condition;
    }
    else {
        return condition.exec(text[index]) !== null;
    }
    
}

export function nextIs(char: string): boolean;
export function nextIs(exp: RegExp): boolean;
export function nextIs(condition: string | RegExp) {
    moveForward();
    if(notEnd()) {
        var res = is(condition);
        moveBackward();
        return res;
    }
    else {
        moveBackward();
        return false;
    }
}

// index control

var index: number = 0;

export function notEnd(): boolean {
    return index < text.length;
}

export function moveTo(pos: number) {
    index = pos;
}

export function move(length: number) {
    index += length;
}

export function moveForward() {
    move(1);
}

export function moveBackward() {
    move(-1);
}