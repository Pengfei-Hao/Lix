import { Node } from "../../sytnax-tree/node";
import { Type } from "../../sytnax-tree/type";
import { Module } from "../module";
import { MatchResult, Parser, Result } from "../parser";
import { BlockHandlerTable } from "./block-handler-table";


export class Math extends Module {

    blockHandlerTable: BlockHandlerTable;

    equationType: Type;
    symbolType: Type;
    definationType: Type;
    fractionType: Type;
    matrixType: Type;

    constructor(parser: Parser) {
        super(parser);

        this.equationType = this.parser.typeTable.add("equation")!;
        this.symbolType = this.parser.typeTable.add("symbol")!;
        this.definationType = this.parser.typeTable.add("defination")!;
        //this.fractionType = this.parser.typeTable.add("fraction")!;
        //this.matrixType = this.parser.typeTable.add("matrix")!;

        this.parser.labelHandlerTable.add("formula", this.matchFormula, this);
        this.parser.labelHandlerTable.add("$", this.matchFormula, this);

        this.blockHandlerTable = new BlockHandlerTable(parser);
        this.fractionType = this.blockHandlerTable.addBlock("frac", this.frac, this)!;
        this.matrixType = this.blockHandlerTable.addBlock("matrix", this.matrix, this)!;
        
        let symbols = ["x", "y", "z", "f", "1", "2", "+", "-", "(", ")", "="];
        for(let symbol of symbols) {
            this.blockHandlerTable.addSymbol(symbol);
        }
        //[["x", "#x"], ["y", "#y"], ["z", "#z"], ["f", "#f"],
        //["1", "#1"], ["2", "#2"], ["+", "#+"], ["-", "#-"], ["(", "#("], [")", "#)"], ["=", "#="]]
    }

    matchFormula(): MatchResult {
        let result = this.myMatchEquation();

        if (!result.success) {
            return result;
        }

        let analysisResult = this.analyse(result.content);

        return new Result(analysisResult, result.content);
    }

// Part 1: scan the text and construct the syntax tree. This part will use types of node as follows:
// 1. type: equation, content: [unused], children: (contents symbol nodes and equation nodes 1. & 2.)
// 2. type: symbol, content: (name of this symbol), children: [unused]
// 3. type: defination, content: [unused], children: (contents symbol nodes and equation nodes 1. & 2.)

private myMatchEquation(): MatchResult {
    var node = new Node(this.equationType);

    var text = "";
    while (this.parser.notEnd()) {
        if (this.parser.is(Parser.blank)) {

            if (text !== "") {
                node.children.push(new Node(this.symbolType, text));
                text = "";
            }
            
            var count = 0;
            do {
                if (this.parser.is(Parser.newline)) {
                    count++;
                }
                this.parser.moveForward();
            } while (this.parser.notEnd() && this.parser.is(Parser.blank));

            // if(count >= 2) {
            //     text += "\n\n";
            //     break;
            // }
            // else {
            //     text += " ";
            // }
        }

        else if (this.parser.is("'")) {
            let result = this.matchDefination();
            node.children.push(result.content);

            if (!result.success) {
                return new Result(false, node);
            }


        }
        else if (this.parser.is("[")) {
            if (text !== "") {
                node.children.push(new Node(this.symbolType, text));
                text = "";
            }
            
            this.parser.moveForward();
            let result = this.matchSymbols();
            if (!result.success) {
                return new Result(false, node);
            }

            node.children.push(result.content);
        }

        else if (this.parser.is("]")) {
            this.parser.moveForward();
            if (text !== "") {
                node.children.push(new Node(this.symbolType, text));
            }
            return new Result(true, node);
        }

        else {
            text += this.parser.curChar();
            this.parser.moveForward();
        }
    }

    if (text !== "") {
        node.children.push(new Node(this.symbolType, text));
    }
    return new Result(false, node);
}

private matchDefination(): MatchResult {
    this.parser.moveForward();
    this.parser.skipBlank();
    let text = "";
    let node = new Node(this.definationType);
    while (this.parser.notEnd()) {
        if (this.parser.is(Parser.blank)) {

            if (text !== "") {
                node.children.push(new Node(this.symbolType, text));
                text = "";
            }

            let count = 0;
            do {
                if (this.parser.is(Parser.newline)) {
                    count++;
                }
                this.parser.moveForward();
            } while (this.parser.notEnd() && this.parser.is(Parser.blank));
            if (count >= 2) {

            }
        }

        else if (this.parser.is("[")) {
            if (text !== "") {
                node.children.push(new Node(this.symbolType, text));
            }
            text = "";
            this.parser.moveForward();
            var result = this.matchSymbols();
            if (!result.success) {
                return new Result(false, node);
            }

            node.children.push(result.content);
        }
        else if (this.parser.is("'")) {
            this.parser.moveForward();
            if (text !== "") {
                node.children.push(new Node(this.symbolType, text));
            }
            return new Result(true, node);
        }
        else {
            text += this.parser.curChar();
            this.parser.moveForward();
        }
    }
    if (text !== "") {
        node.children.push(new Node(this.symbolType, text));
    }
    return new Result(false, node);
}

private matchSymbols(): MatchResult {
    let text = "";
    let node = new Node(this.equationType);
    while (this.parser.notEnd()) {
        if (this.parser.is(Parser.blank)) {
            if (text !== "") {
                node.children.push(new Node(this.symbolType, text));
                text = "";
            }
            
            var count = 0;
            do {
                if (this.parser.is(Parser.newline)) {
                    count++;
                }
                this.parser.moveForward();
            } while (this.parser.notEnd() && this.parser.is(Parser.blank));

            // if(count >= 2) {
            //     text += "\n\n";
            //     break;
            // }
            // else {
            //     text += " ";
            // }
        }

        else if (this.parser.is("[")) {
            if (text !== "") {
                node.children.push(new Node(this.symbolType, text));
            }
            text = "";
            this.parser.moveForward();
            var result = this.matchSymbols();
            if (!result.success) {
                return new Result(false, node);
            }

            node.children.push(result.content);

        }
        else if (this.parser.is("]")) {
            this.parser.moveForward();
            if (text !== "") {
                node.children.push(new Node(this.symbolType, text));
            }
            return new Result(true, node);

        }
        else {
            text += this.parser.curChar();
            this.parser.moveForward();
        }
    }

    if (text !== "") {
        node.children.push(new Node(this.symbolType, text));
    }
    return new Result(false, node);
}

// Part 2: analyse the syntax tree that constructed in Part 1, replace defination nodes with its content, and find out the correct math label function to handle the equation nodes. This part will use types of node as follows:
// 1. type: equation, content: [unused], children: (contents symbol nodes and equation nodes 1. & 2.)
// 2. type: symbol, content: "${name of symbol}", children: [unused]
// 3. type: fraction, content: [unused], children: (firstNode 1. secondNode 1.)
// 4. type: matrix, content: [unused], children: (nodes 1.)
// 5. type: (some math label name), content: (depends on math label), children: (depends on math label)

analyse(node: Node): boolean {

    // filter the defination part, i.e. the symbols surrounded by the ' '.
    for (let subnode of node.children) {
        if (subnode.type === this.definationType) {
            if (subnode.children.length < 2) {
                return false;
            }
            if (subnode.children[0].type != this.symbolType) {
                return false;
            }
            if (subnode.children[1].type != this.symbolType || subnode.children[1].content != "=>") {
                return false;
            }

            let newNode = new Node(this.equationType);
            for (let i = 2; i < subnode.children.length; i++) {
                newNode.children.push(Node.clone(subnode.children[i]));
            }

            this.blockHandlerTable.addDefination(subnode.children[0].content, newNode);
        }

    }

    for (let i = node.children.length - 1; i >= 0; i--) {
        if (node.children[i].type === this.definationType) {
            node.children.splice(i, 1);
        }
    }

    // analyse labels

    return this.equation(node);
}


equation(node: Node): boolean {
    for (let i = 0; i < node.children.length; i++) {
        let subnode = node.children[i];

        if (subnode.type === this.symbolType) {
            let resultOfMath = this.blockHandlerTable.symbols.get(subnode.content);
            if (resultOfMath != undefined) {
                subnode.content += `__${resultOfMath}__`;
            }
            else {
                let resultOfDefination = this.blockHandlerTable.definations.get(subnode.content);
                if (resultOfDefination != undefined) {
                    node.children.splice(i, 1);
                    for (let j = 0; j < resultOfDefination.children.length; j++) {
                        node.children.splice(i + j, 0, resultOfDefination.children[j]);
                    }
                    i--;
                }

                else {
                    return false;
                }
            }
        }
        else if (subnode.type === this.equationType) {
            let result = this.find(subnode);
            if (!result) {
                return false;
            }

        }
    }
    return true;
}

find(node: Node): boolean {
    // frac
    let result = this.frac(node);
    if (result) {
        return true;
    }

    // matrix
    result = this.matrix(node);
    if (result) {
        return true;
    }

    return false;
}

frac(node: Node): boolean {
    let isMatch = false;
    let pos = -1;
    for (let i = 0; i < node.children.length; i++) {
        let subnode = node.children[i];
        if (subnode.type === this.symbolType && subnode.content === "/") {
            isMatch = true;
            pos = i;
            break;
        }
    }

    if (!isMatch) {
        return false;
    }

    let firstNode = new Node(this.equationType);
    let secondNode = new Node(this.equationType);
    for (let i = 0; i < pos; i++) {
        firstNode.children.push(node.children[i]);
    }
    for (let i = pos + 1; i < node.children.length; i++) {
        secondNode.children.push(node.children[i]);
    }
    node.children = [firstNode, secondNode];
    node.type = this.fractionType;

    let result = this.equation(firstNode);
    let secResult = this.equation(secondNode);

    return result && secResult;
}

matrix(node: Node): boolean {
    let isMatch = false;
    isMatch = true;

    if (!isMatch) {
        return false;
    }

    let newChildren: Node[] = [new Node(this.equationType)];
    let count = 0;
    for (let i = 1; i < node.children.length; i++) {
        if (node.children[i].content === ";") {
            count++;
            newChildren.push(new Node(this.equationType));
        }
        else {
            newChildren[count].children.push(node.children[i]);
        }
    }

    let res = true;

    for (let i = 0; i < newChildren.length; i++) {
        res = res && this.equation(newChildren[i]);
    }

    node.children = newChildren;
    node.type = this.matrixType;

    return res;
}
}

/*
function matchMathLabel(): MatchResult {
    var preIndex = index;
    var tNode = new Node(this.equationType);
    moveForward(); 
    skipBlank();
    var tName = tryToMatchName();
    if (tName[0]) {
        tNode.content = tName[1];
        skipBlank();
        
        var tRes = matchEquation();

        if (!tRes[0]) {
            index = preIndex;
            return [false, tNode];
        }
        tNode.children = tRes[1].children;
        return [true, tNode];
    }
    else { 
        index = preIndex;
        return [false, tNode];
    }
}
*/