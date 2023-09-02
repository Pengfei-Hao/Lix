
import exp = require("constants");
import { Node } from "../../sytnax-tree/node";
import { Type } from "../../sytnax-tree/type";
import { Module } from "../module";
import { MatchResult, Parser, Result } from "../parser";
import { SymbolTable } from "./symbol-table";


export class Math extends Module {

    blockHandlerTable: SymbolTable;

    // types of syntax tree node
    formulaType: Type;
    symbolType: Type;
    definationType: Type;
    fractionType: Type;
    matrixType: Type;
    sqrtType: Type;
    sumType: Type;
    limitType: Type;
    integralType: Type;
    scriptType: Type;
    bracketsType: Type;

    constructor(parser: Parser) {
        super(parser);

        // Init label handle function
        this.parser.labelHandlerTable.add("formula", this.matchFormula, this);
        this.parser.labelHandlerTable.add("$", this.matchFormula, this);

        // Init syntax tree node type
        this.formulaType = this.parser.typeTable.add("formula")!;
        this.symbolType = this.parser.typeTable.add("symbol")!;
        this.definationType = this.parser.typeTable.add("defination")!;

        // Init math block handle function and init syntax tree node
        this.blockHandlerTable = new SymbolTable(parser);
        this.fractionType = this.blockHandlerTable.addBlock("fraction", this.frac, this)!;
        this.sqrtType = this.blockHandlerTable.addBlock("sqrt", this.sqrt, this)!;
        this.sumType = this.blockHandlerTable.addBlock("sum", this.sum, this)!;
        this.limitType = this.blockHandlerTable.addBlock("limit", this.limit, this)!;
        this.integralType = this.blockHandlerTable.addBlock("integral", this.integral, this)!;
        this.scriptType = this.blockHandlerTable.addBlock("script", this.script, this)!;
        this.bracketsType = this.blockHandlerTable.addBlock("brackets", this.brackets, this)!;
        this.matrixType = this.blockHandlerTable.addBlock("matrix", this.matrix, this)!;

        // Init math symbols from math.json
        let json = parser.configs.get("math");
        let config: { symbols: string[] } = JSON.parse(json);
        for(let symbol of config.symbols) {
            this.blockHandlerTable.addSymbol(symbol);

        }
        
    }

    matchFormula(): MatchResult {
        let result = this.myMatchFormula();

        if (!result.success) {
            return result;
        }

        let analysisResult = this.analyse(result.content);

        return new Result(analysisResult, result.content);
    }

// Part 1: scan the text and construct the syntax tree. This part will use types of node as follows:
// 1. type: formula, content: [unused], children: (contents symbol nodes and formula nodes 1. & 2.)
// 2. type: symbol, content: (name of this symbol), children: [unused]
// 3. type: defination, content: [unused], children: (contents symbol nodes and formula nodes 1. & 2.)

private myMatchFormula(): MatchResult {
    var node = new Node(this.formulaType);

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
    let node = new Node(this.formulaType);
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

// Part 2: analyse the syntax tree that constructed in Part 1, replace defination nodes with its content, and find out the correct math label function to handle the formula nodes. This part will use types of node as follows:
// 1. type: formula, content: [unused], children: (contents symbol nodes and formula nodes 1. & 2.)
// 2. type: symbol, content: "${name of symbol}", children: [unused]
// 3. type: fraction, content: [unused], children: (firstNode 1. secondNode 1.)
// 4. type: matrix, content: [unused], children: (nodes 1.)
// 5. type: (some math label name), content: (depends on math label), children: (depends on math label)

analyse(node: Node): boolean {

    // filter the defination, i.e. the symbols surrounded by the ' '.
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

            let newNode = new Node(this.formulaType);
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

    // analyse symbols

    return this.formula(node);
}

find(node: Node): boolean {
    let result = false;
    for(let handle of this.blockHandlerTable.blockHandleFunctions) {
        result = handle(node);
        if(result) {
            break;
        }
    }
    if(!result) {
        result = this.formula(node);
    }
    return result;
}

formula(node: Node): boolean {
    for (let i = 0; i < node.children.length; i++) {
        let subnode = node.children[i];

        if (subnode.type === this.symbolType) {
            let resultOfMath = this.blockHandlerTable.symbols.get(subnode.content);
            if (resultOfMath != undefined) {
                //subnode.content += `__${resultOfMath}__`;
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
        else if (subnode.type === this.formulaType) {
            let result = this.find(subnode);
            if (!result) {
                return false;
            }

        }
    }
    return true;
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

    let firstNode = new Node(this.formulaType);
    let secondNode = new Node(this.formulaType);
    for (let i = 0; i < pos; i++) {
        firstNode.children.push(node.children[i]);
    }
    for (let i = pos + 1; i < node.children.length; i++) {
        secondNode.children.push(node.children[i]);
    }
    node.children = [firstNode, secondNode];
    node.type = this.fractionType;

    let result = this.formula(firstNode);
    let secResult = this.formula(secondNode);

    return result && secResult;
}

matrix(node: Node): boolean {
    let isMatch = false;
    isMatch = true;

    if (!isMatch) {
        return false;
    }

    let newChildren: Node[] = [new Node(this.formulaType)];
    let count = 0;
    for (let i = 0; i < node.children.length; i++) {
        if (node.children[i].content === ";") {
            count++;
            newChildren.push(new Node(this.formulaType));
        }
        else {
            newChildren[count].children.push(node.children[i]);
        }
    }

    let res = true;

    for (let i = 0; i < newChildren.length; i++) {
        res = res && this.formula(newChildren[i]);
    }

    node.children = newChildren;
    node.type = this.matrixType;

    return res;
}

sqrt(node: Node): boolean {
    let lastNode;
    if(node.children.length === 0) {
        return false;
    }
    lastNode = node.children[node.children.length -1];
    if(lastNode.type !== this.symbolType || lastNode.content !== "^2") {
        return false;
    }

    
    node.children.splice(node.children.length - 1);
    let res1 = this.formula(node);
    node.type = this.sqrtType;
    return res1;
}

sum(node: Node): boolean {

    let length = node.children.length;
    if(length === 0) {
        return false;
    }
    if(!this.isSymbol(node.children[0], "sum")) {
        return false;
    }

    let from = new Node(this.formulaType);
    let to = new Node(this.formulaType);
    let expr = new Node(this.formulaType);
    
    let i = 1;
    for(; i < length; i++) {
        if(!(this.isSymbol(node.children[i], "to") || this.isSymbol(node.children[i], ":"))) {
            from.children.push(node.children[i]);
        }
        else {
            break;
        }
    }

    if(i < length && this.isSymbol(node.children[i], "to")) {
        i++;
        for(; i < length; i++) {
            if(!(this.isSymbol(node.children[i], ":"))) {
                to.children.push(node.children[i]);
            }
            else {
                break;
            }
        }
    }
    if(i < length && this.isSymbol(node.children[i], ":")) {
        i++;
        for(; i < length; i++) {
            if(!(this.isSymbol(node.children[i], "to"))) {
                expr.children.push(node.children[i]);
            }
            else {
                break;
            }
        }
    }

    if(i < length && this.isSymbol(node.children[i], "to")) {
        i++;
        for(; i < length; i++) {
            if(!(this.isSymbol(node.children[i], ":"))) {
                to.children.push(node.children[i]);
            }
            else {
                break;
            }
        }
    }
    if(i < length && this.isSymbol(node.children[i], ":")) {
        i++;
        for(; i < length; i++) {
            if(!(this.isSymbol(node.children[i], "to"))) {
                expr.children.push(node.children[i]);
            }
            else {
                break;
            }
        }
    }

    let res1 = this.formula(from);
    let res2 = this.formula(to);
    let res3 = this.formula(expr);

    node.type = this.sumType;
    node.children = [from, to, expr];
    return res1 && res2 && res3;
}

limit(node: Node): boolean {
    let length = node.children.length;
    if(length === 0) {
        return false;
    }
    if(!this.isSymbol(node.children[0], "lim")) {
        return false;
    }

    let lim = new Node(this.formulaType);
    let expr = new Node(this.formulaType);
    
    let i = 1;
    for(; i < length; i++) {
        if(!(this.isSymbol(node.children[i], ":"))) {
            lim.children.push(node.children[i]);
        }
        else {
            break;
        }
    }

    if(i < length && this.isSymbol(node.children[i], ":")) {
        i++;
        for(; i < length; i++) {
            expr.children.push(node.children[i]);
            
        }
    }

    let res1 = this.formula(lim);
    let res2 = this.formula(expr);

    node.type = this.limitType;
    node.children = [lim, expr];
    return res1 && res2;
}

integral(node: Node): boolean {
    let length = node.children.length;
    if(length === 0) {
        return false;
    }
    if(!this.isSymbol(node.children[0], "int")) {
        return false;
    }

    let from = new Node(this.formulaType);
    let to = new Node(this.formulaType);
    let expr = new Node(this.formulaType);
    
    let i = 1;
    for(; i < length; i++) {
        if(!(this.isSymbol(node.children[i], "to") || this.isSymbol(node.children[i], ":"))) {
            from.children.push(node.children[i]);
        }
        else {
            break;
        }
    }

    if(i < length && this.isSymbol(node.children[i], "to")) {
        i++;
        for(; i < length; i++) {
            if(!(this.isSymbol(node.children[i], ":"))) {
                to.children.push(node.children[i]);
            }
            else {
                break;
            }
        }
    }
    if(i < length && this.isSymbol(node.children[i], ":")) {
        i++;
        for(; i < length; i++) {
            if(!(this.isSymbol(node.children[i], "to"))) {
                expr.children.push(node.children[i]);
            }
            else {
                break;
            }
        }
    }

    if(i < length && this.isSymbol(node.children[i], "to")) {
        i++;
        for(; i < length; i++) {
            if(!(this.isSymbol(node.children[i], ":"))) {
                to.children.push(node.children[i]);
            }
            else {
                break;
            }
        }
    }
    if(i < length && this.isSymbol(node.children[i], ":")) {
        i++;
        for(; i < length; i++) {
            if(!(this.isSymbol(node.children[i], "to"))) {
                expr.children.push(node.children[i]);
            }
            else {
                break;
            }
        }
    }

    let res1 = this.formula(from);
    let res2 = this.formula(to);
    let res3 = this.formula(expr);

    node.type = this.integralType;
    node.children = [from, to, expr];
    return res1 && res2 && res3;
}

script(node: Node): boolean {
    let length = node.children.length;

    let sub = new Node(this.formulaType);
    let sup = new Node(this.formulaType);
    let expr = new Node(this.formulaType);
    
    let match = false;
    let i = 0;
    for(; i < length; i++) {
        if(!(this.isSymbol(node.children[i], "_") || this.isSymbol(node.children[i], "^"))) {
            expr.children.push(node.children[i]);
        }
        else {
            match = true;
            break;
        }
    }
    if(!match) {
        return false;
    }

    if(i < length && this.isSymbol(node.children[i], "^")) {
        i++;
        for(; i < length; i++) {
            if(!(this.isSymbol(node.children[i], "_"))) {
                sup.children.push(node.children[i]);
            }
            else {
                break;
            }
        }
    }
    if(i < length && this.isSymbol(node.children[i], "_")) {
        i++;
        for(; i < length; i++) {
            if(!(this.isSymbol(node.children[i], "^"))) {
                sub.children.push(node.children[i]);
            }
            else {
                break;
            }
        }
    }

    if(i < length && this.isSymbol(node.children[i], "&")) {
        i++;
        for(; i < length; i++) {
            sup.children.push(node.children[i]);
        }
    }
    if(i < length && this.isSymbol(node.children[i], "_")) {
        i++;
        for(; i < length; i++) {
            sub.children.push(node.children[i]);
        }
    }

    let res1 = this.formula(expr);
    let res2 = this.formula(sub);
    let res3 = this.formula(sup);

    node.type = this.scriptType;
    node.children = [expr, sup, sub];
    return res1 && res2 && res3;
}

brackets(node: Node): boolean {
    let length = node.children.length;
    if(length < 2) {
        return false;
    }

    let left = node.children[0].content;
    let right = node.children[length - 1].content;
    let leftBrackets = new Set(["(", "{", "<", "|", "."]);
    let rightBrackets = new Set([")", "}", ">", "|", "."]);
    if(leftBrackets.has(left) && rightBrackets.has(right)) {
        node.type = this.bracketsType;
        let content = node.children.slice(1, -1);
        node.children = [new Node(this.symbolType, left), new Node(this.formulaType, "", content), new Node(this.symbolType, right)];
        return this.formula(node.children[1]);
    }

    return false;
}

isSymbol(node: Node, name: string): boolean {
    return node.type === this.symbolType && node.content === name;
}

}
