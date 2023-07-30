import { Node, Type } from "./AST";
import { MatchResult } from "./label";
import { blank, curChar, is, moveForward, newline, notEnd, skipBlank, tryToMatchName } from "./parser";

export function matchEquation(): MatchResult {
    let result = myMatchEquation();

    if(!result.success) {
        return result;
    }

    let analysisResult = analysis(result.node);

    return new MatchResult(analysisResult, result.node);
}

function myMatchEquation(): MatchResult {
    var text = "";
    var node = new Node(Type.equation);

    while (notEnd()) {
        if (is(blank)) {

            if (text !== "") {
                node.children.push(new Node(Type.symbol, text));
            }
            text = "";
            var count = 0;
            do {
                if (is(newline)) {
                    count++;
                }
                moveForward();
            } while (notEnd() && is(blank));

            // if(count >= 2) {
            //     text += "\n\n";
            //     break;
            // }
            // else {
            //     text += " ";
            // }
        }
        else if (is("'")) {
            let result = matchDefination();
            node.children.push(result.node);

            if(!result.success) {
                return new MatchResult(false, node);
            }

            
        }
        else if (is("[")) {
            if (text !== "") {
                node.children.push(new Node(Type.symbol, text));
            }
            text = "";
            moveForward();
            var result = matchSymbols();
            if (!result.success) {
                return new MatchResult(false, node);
            }

            node.children.push(result.node);

        }
        else if (is("]")) {
            moveForward();
            if (text !== "") {
                node.children.push(new Node(Type.symbol, text));
            }
            return new MatchResult(true, node);

        }
        else {
            text += curChar();
            moveForward();

        }
    }

    if (text !== "") {
        node.children.push(new Node(Type.symbol, text));
    }
    return new MatchResult(false, node);
}

function matchDefination(): MatchResult {
    moveForward();
    skipBlank();
    let subtext = "";
    let subnode = new Node(Type.defination);
    while (notEnd()) {
        if (is(blank)) {

            if (subtext !== "") {
                subnode.children.push(new Node(Type.symbol, subtext));
                subtext = "";
            }


            var count = 0;
            do {
                if (is(newline)) {
                    count++;
                }
                moveForward();
            } while (notEnd() && is(blank));
            if (count >= 2) {

            }
        }
        else if (is("[")) {
            if (subtext !== "") {
                subnode.children.push(new Node(Type.symbol, subtext));
            }
            subtext = "";
            moveForward();
            var result = matchSymbols();
            if (!result.success) {
                return new MatchResult(false, subnode);
            }

            subnode.children.push(result.node);

        }
        else if (is("'")) {
            moveForward();
            if (subtext !== "") {
                subnode.children.push(new Node(Type.symbol, subtext));
            }
            return new MatchResult(true, subnode);

        }
        else {
            subtext += curChar();
            moveForward();

        }
       
    }
    if (subtext !== "") {
        subnode.children.push(new Node(Type.symbol, subtext));
    }
    return new MatchResult(false, subnode);
}


function matchSymbols(): MatchResult {
    var text = "";
    var node = new Node(Type.equation);
    while (notEnd()) {
        if (is(blank)) {

            if (text !== "") {
                node.children.push(new Node(Type.symbol, text));
            }
            text = "";
            var count = 0;
            do {
                if (is(newline)) {
                    count++;
                }
                moveForward();
            } while (notEnd() && is(blank));

            // if(count >= 2) {
            //     text += "\n\n";
            //     break;
            // }
            // else {
            //     text += " ";
            // }
        }
        
        else if (is("[")) {
            if (text !== "") {
                node.children.push(new Node(Type.symbol, text));
            }
            text = "";
            moveForward();
            var result = matchSymbols();
            if (!result.success) {
                return new MatchResult(false, node);
            }

            node.children.push(result.node);

        }
        else if (is("]")) {
            moveForward();
            if (text !== "") {
                node.children.push(new Node(Type.symbol, text));
            }
            return new MatchResult(true, node);

        }
        else {
            text += curChar();
            moveForward();

        }
    }

    if (text !== "") {
        node.children.push(new Node(Type.symbol, text));
    }
    return new MatchResult(false, node);
}

export function init() {
    mathFunctions = [frac, matrix];
    mathSymbols = new Map( [["x" , "#x"], ["y", "#y"], ["z", "#z"], ["f", "#f"],
     ["1", "#1"], ["2", "#2"], ["+", "#+"], ["-", "#-"], ["(", "#("], [")", "#)"], ["=", "#="]]);

    definationSymbols = new Map();
}

type MathFunction = (node: Node) => boolean;
let mathFunctions: MathFunction[] = [];

let mathSymbols: Map<string, string> = new Map();
let definationSymbols: Map<string, Node> = new Map();

function analysis(node: Node): boolean {

    // filter the defination part, i.e. the symbols surrounded by the ' '.
    for(let subnode of node.children) {
        if(subnode.type === Type.defination) {
            if(subnode.children.length < 2) {
                return false;
            }
            if(subnode.children[0].type != Type.symbol) {
                return false;
            }
            if(subnode.children[1].type != Type.symbol || subnode.children[1].content != "=>") {
                return false;
            }

            let newNode = new Node(Type.equation);
            for(let i = 2; i < subnode.children.length; i++) {
                newNode.children.push(clone(subnode.children[i]));
            }

            definationSymbols.set(subnode.children[0].content, newNode);
        }

    }

    for(let i = node.children.length - 1; i >= 0; i--) {
        if(node.children[i].type === Type.defination) {
            node.children.splice(i, 1);
        }
    }

    // 处理标签

    return equation(node);
}

function clone(node: Node): Node {
    let newNode = new Node(node.type, node.content);
    for(let subNode of node.children) {
        newNode.children.push(clone(subNode));
    }
    return newNode;
}


function equation(node: Node): boolean {
    for(let i = 0; i < node.children.length; i++) {
        let subnode = node.children[i];
        
        if(subnode.type === Type.symbol) {
            
            
            let resultOfMath = mathSymbols.get(subnode.content);
            if(resultOfMath != undefined) {
                subnode.content += `__${resultOfMath}__`;
            }
            
            else {
                let resultOfDefination = definationSymbols.get(subnode.content);
                if(resultOfDefination != undefined) {
                    node.children.splice(i, 1);
                    for(let j = 0; j < resultOfDefination.children.length; j++) {
                        node.children.splice(i+j,0,resultOfDefination.children[j]);
                    }
                    i--;
                }

                else {
                    return false;
                }
            }
        }
        else if(subnode.type === Type.equation) {
            let result = find(subnode);
            if(!result) {
                return false;
            }

        }
    }
    return true;
}

function find(node: Node): boolean {
    // frac
    let result = frac(node);
    if(result) {
        return true;
    }

    // matrix
    result = matrix(node);
    if(result) {
        return true;
    }

    return false;
}

function frac(node: Node): boolean {
    let isMatch = false;
    let pos = -1;
    for(let i = 0; i < node.children.length; i++) {
        let subnode = node.children[i];
        if(subnode.type === Type.symbol && subnode.content === "/") {
            isMatch = true;
            pos = i;
            break;
        }
    }

    if(!isMatch) {
        return false;
    }

    let firstNode = new Node(Type.equation);
    let secondNode = new Node(Type.equation);
    for(let i = 0; i < pos; i++) {
        firstNode.children.push(node.children[i]);
    }
    for(let i = pos + 1; i < node.children.length; i++) {
        secondNode.children.push(node.children[i]);
    }
    node.children = [firstNode, secondNode];
    node.type = Type.fraction;

    let result = equation(firstNode);
    let secResult = equation(secondNode);

    return result && secResult;
}

function matrix(node: Node): boolean {
    let isMatch = false;
    isMatch = true;

    if(!isMatch) {
        return false;
    }

    let newChildren: Node[] = [new Node(Type.equation)];
    let count = 0;
    for(let i = 1; i < node.children.length; i++) {
        if(node.children[i].content === ";") {
            count++;
            newChildren.push(new Node(Type.equation));
        }
        else {
            newChildren[count].children.push(node.children[i]);
        }
    }

    let res = true;

    for(let i = 0; i < newChildren.length; i++) {
        res = res && equation(newChildren[i]);
    }
    
    node.children = newChildren;
    node.type = Type.matrix;

    return res;
}

/*
function matchMathLabel(): MatchResult {
    var preIndex = index;
    var tNode = new Node(Type.equation);
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