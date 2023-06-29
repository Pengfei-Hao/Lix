/**
 * Parser: analyise the document, generate the nodes
 */

var text: string = "";

export function initParser(source: string) {
    text = source;
    rootNode = new Node("document", []);
}


// parse and 'match' series function

enum NodeType {
    text,
    label,
    setting
}

class Node {
    public type: NodeType;

    public text: string;

    public children: Node[];

    constructor(text: string);
    constructor(text: string, children: Node[]);
    constructor(text: string, children?: Node[]) {
        if(children === undefined) {
            this.type = NodeType.text;
            this.text = text;
            this.children = [];
        }
        else {
            this.type = NodeType.label;
            this.text = text;
            this.children = children;
        }
    }

}

var rootNode = new Node("document", []);

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
        var res1 = matchSetting();
        if(!res1[0]) {
            var res2 = matchParagraph();
            if(!res2[0]) {
                // fail
                rootNode.children.push(new Node("[[[Parse Failed!!!]]]"));
                return;
            }
            else {
                rootNode.children.push(res2[1]);
            }
        }
        else {
            rootNode.children.push(res1[1]);
        }
    }
    // success
    
}

function matchSetting(): [boolean, Node] {
    var preIndex = index;
    var tNode = new Node("");
    tNode.type = NodeType.setting;

    if(notEnd() && is("#")) {
        moveForward();
        skipBlank();
        var tName = matchName();
        if(tName[0]) {
            tNode.text = tName[1];
            skipBlank();
            if(notEnd() && is(":")) {
                moveForward();
                var command = "";
                while(notEnd() && !is("\n")) {
                    command += curChar();
                    moveForward();
                }
                //addIntrodunctionLine("#" + tName[1] + ":" + command);
                skipBlank();
                tNode.children.push(new Node(command));
                return [true, tNode];
            }
            else {
                index = preIndex;
                return [false, tNode];
            }
        }
        else {
            index = preIndex;
            return [false, tNode];
        }
    }
    else {
        index = preIndex;
        return [false, tNode];
    }
}

function matchParagraph(): [boolean, Node] {
    var preIndex = index;
    var text = "";
    var tNode = new Node("paragraph", []);
    if(notEnd() && !is(blank)) {
        while(notEnd()) {
            if(is(blank)) {
                var count = 0;
                do {
                    if(is(newline)) {
                        count++;
                    }
                    moveForward();
                }while(notEnd() && is(blank));
                
                
                if(count >= 2) {
                    text += "\n\n";
                    break;
                }
                else {
                    text += " ";
                }
            }
            else if(is("\\")) {
                moveForward();
                if(notEnd()) {
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
            else if(is("[")) {
                if(text !== "") {
                    tNode.children.push(new Node(text));
                }
                
                text = "";
                var tRes = matchLabel();
                if (!tRes[0]) {
                    index = preIndex;
                    return [false, tNode];
                }
                else {
                    tNode.children.push(tRes[1]);
                }
            }
            else {
                text += curChar();
                moveForward();
            }
        }
        if(text !== "") {
            tNode.children.push(new Node(text));
        }
        return [true, tNode];
    }
    else {
        index = preIndex;
        return [false, tNode];
    }
   
}

function matchParagraphInsideLabel(): [boolean, Node] {
    var preIndex = index;
    var text = "";
    var tNode = new Node("paragraph", []);
    while (notEnd()) {
        if (is(blank)) {
            var count = 0;
            do {
                if (is(newline)) {
                    count++;
                }
                moveForward();
            } while (notEnd() && is(blank));

            if(count >= 2) {
                text += "\n\n";
                break;
            }
            else {
                text += " ";
            }
        }
        else if(is("\\")) {
            moveForward();
            if(notEnd()) {
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
            if(text !== "") {
                tNode.children.push(new Node(text));
            }
            text = "";
            var tRes = matchLabel();
            if (!tRes[0]) {
                index = preIndex;
                return [false, tNode];
            }
            else {
                tNode.children.push(tRes[1]);
            }
        }
        else if (is("]")) {
            moveForward();
            if(text !== "") {
                tNode.children.push(new Node(text));
            }
            return [true, tNode];

        }
        else {
            text += curChar();
            moveForward();
        }
    }

    if(text !== "") {
        tNode.children.push(new Node(text));
    }
    index = preIndex;
    return [false, tNode];


}

function matchLabel(): [boolean, Node] {
    var preIndex = index;
    var tNode = new Node("", []);
    moveForward();
    skipBlank();
    var tName = matchName();
    if (tName[0]) {
        tNode.text = tName[1];
        skipBlank();
        
        var tRes;
        if(tName[1] === "equation") {
            tRes = matchEquation();
        }
        else {
            tRes = matchParagraphInsideLabel();
        }

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

function matchEquation(): [boolean, Node] {
    var preIndex = index;

    var text = "";
    var tNode = new Node("equation", []);
    while (notEnd()) {
        if (is(blank)) {

            if(text !== "") {
                tNode.children.push(new Node(text));
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
            if(text !== "") {
                tNode.children.push(new Node(text));
            }
            text = "";
            var tRes = matchMathLabel();
            if (!tRes[0]) {
                index = preIndex;
                return [false, tNode];
            }
            else {
                tNode.children.push(tRes[1]);
            }
        }
        else if (is("]")) {
            moveForward();
            if(text !== "") {
                tNode.children.push(new Node(text));
            }
            return [true, tNode];

        }
        else {
                text += curChar();
                moveForward();
            
        }
    }

    if(text !== "") {
        tNode.children.push(new Node(text));
    }
    index = preIndex;
    return [false, tNode];
}

function matchMathLabel(): [boolean, Node] {
    var preIndex = index;
    var tNode = new Node("", []);
    moveForward();
    skipBlank();
    var tName = matchName();
    if (tName[0]) {
        tNode.text = tName[1];
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

function matchName(): [boolean, string] {
    var preIndex = index;
    if(!notEnd()) {
        return [false, ""];
    }
    if(is(name)) {
        var temp = curChar();
        while(nextIs(name)) {
            moveForward();
            temp += curChar();
        }
        moveForward();
        return [true, temp];
    }
    else {
        index = preIndex;
        return [false, ""];
    }
}

function skipBlank() {
    if(is(blank)) {
        while(nextIs(blank)) {
            moveForward();
        }
        moveForward();
    }
}

// current char

function curChar(): string {
    return text[index];
}

// 'is' series functions

var name = /[A-Za-z0-9-]/;
var blank = /[\t \v\f\r\n]/;
var newline = /[\r\n]/;

function is(char: string): boolean;
function is(exp: RegExp): boolean;
function is(condition: string | RegExp): boolean;
function is(condition: string | RegExp): boolean {
    if(typeof(condition) === "string") {
        return text[index] === condition;
    }
    else {
        return condition.exec(text[index]) !== null;
    }
    
}

function nextIs(char: string): boolean;
function nextIs(exp: RegExp): boolean;
function nextIs(condition: string | RegExp) {
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

function notEnd(): boolean {
    return index < text.length;
}

function moveTo(pos: number) {
    index = pos;
}

function move(length: number) {
    index += length;
}

function moveForward() {
    move(1);
}

function moveBackward() {
    move(-1);
}

/**
 * Latex generator: convert nodes to latex source
 */

// latex generate

export function exportLatex(): string {
    introduction = "";
    document = "";
    hasMakedTitle = false;

    addIntrodunction(line(command("usepackage", "xeCJK")));
    addIntrodunction(line(command("usepackage", "geometry")));
    addIntrodunction(line(command("usepackage", "amsmath")));
    addContent(documentLabel(rootNode));

    return `\\documentclass{article}\n${introduction}\n\\begin{document}\n${document}\n\\end{document}`;
}

function convertLabel(node: Node): string {
    if(node.type === NodeType.text) {
        return node.text;
    }
    else {
        var func = labels.get(node.text);
        if(func !== undefined) {
            return func(node);
        }
        else {
            // todo
            return "[[[failure]]]";
        }
    }
}

function convertAllChildLabel(node: Node): string {
    var res = "";
    for(var n of node.children) {
        res += convertLabel(n);
    }
    return res;
}

function convertSetting(node: Node): string {
    var func = settings.get(node.text);
    if(func !== undefined) {
        func(node.children[0].text);
    }
    return "";
}

// label manager

var labels: Map<string, (node: Node) => string> = new Map([
    ["document", documentLabel],
    ["paragraph", paragraphLabel],
    ["title", titleAuthorDateLabel],
    ["author", titleAuthorDateLabel],
    ["date", titleAuthorDateLabel],
    ["section", sectionSubsectionLabel],
    ["subsection", sectionSubsectionLabel],
    ["equation", equationLabel]
]);

function documentLabel(node: Node): string {
    var res = "";
    for(var n of node.children) {
        if(n.type === NodeType.setting) {
            convertSetting(n);
        }
        else {
            res += paragraphLabel(n);
        }
    }
    return res;
}


function paragraphLabel(node: Node): string {
    return convertAllChildLabel(node);
}

var hasMakedTitle = false;

function titleAuthorDateLabel(node: Node): string {
    var t = convertAllChildLabel(node);
    var res = "";
    if(!hasMakedTitle) {
        res = line(command("maketitle"));
        hasMakedTitle = !hasMakedTitle;
    }
    addIntrodunction(line(command(node.text, t)));
    return res;
}

function sectionSubsectionLabel(node: Node): string {
    
    return line(command(node.text, convertAllChildLabel(node)));
}

// math label manager

var mathLabels: Map<string, (node: Node) => string> = new Map([
    ["frac", fracLabel],
    ["matrix", matrixLabel]
]);

var mathSymbols: Map<string, string> = new Map([
    ["x", "\\cdot{}"],
    ["x1", "x_{1}"],
    ["x2", "x_{2}"],
    ["x3", "x_{3}"],
    ["y1", "y_{1}"],
    ["y2", "y_{2}"],
    ["y3", "y_{3}"]
]);

function fracLabel(node: Node): string {
    var a = "", b = ""; // a/b
    for(var n of node.children) {
        if(n.type === NodeType.text && n.text === "/") {
            a = b;
            b = "";
        }
        else {
            b += convertMathLabel(n);
        }
    }

    return `\\frac{${a}}{${b}}`;
}

function matrixLabel(node: Node): string {
    return `\\begin{matrix}${convertAllChildMathLabel(node)}\\end{matrix}`;
}

function equationLabel(node: Node): string {
    var res = "\\[";

    res += convertAllChildMathLabel(node);

    res += "\\]";
    return res;
}

function convertMathLabel(node: Node): string {
    if(node.type === NodeType.text) {
        return convertMathSymbol(node.text);
    }
    else {
        var func = mathLabels.get(node.text);
        if(func !== undefined) {
            return func(node);
        }
        else {
            return "[[[failure]]]";
        }
    }
}

function convertAllChildMathLabel(node: Node): string {
    var res = "";
    for(var n of node.children) {
        res += convertMathLabel(n);
    }
    return res;
}

function convertMathSymbol(symbol: string): string {
    var res = mathSymbols.get(symbol);
    if(res !== undefined) {
        return res;
    }
    else {
        return symbol;
    }
}

// settings manager

var settings: Map<string, (parameter: string)=> string> = new Map([
    ["paper", paperSetting]
]);

function paperSetting(parameter: string): string {
    if(parameter === "a4") {
        addIntrodunction(line(command("geometry", "a4paper")));
    }
    else if(parameter === "b5") {
        addIntrodunction(line(command("geometry", "b5paper")));
    }
    return "";
}


// introduction and document of latex source

var introduction: string = "";
var document: string = "";

function addIntrodunction(intr: string) {
    introduction += intr;
}

function line(text: string) {
    return text + "\n";
}
function command(name: string, content: string = "") {
    return `\\${name}{${content}}`;
}

function addContent(text: string) {
    document += text;
}

/* function processLabel(name: string, onlyRead : boolean = false): [boolean, string] {
    var res = "";
    switch (name) {
        case "section":
        case "subsection":
            res += "\\";
            res += name;
            res += "{"; 
            if(!onlyRead) {
                document += res;
            }
            
            var subRes = content();
            if (subRes[0] === true) {
                res += subRes[1];
                res += "}";
                if(!onlyRead) {
                    document += "}";
                }
            }
            else {
                res += subRes[1];
                if(!onlyRead) {
                    document += subRes[1];
                }
                return [false, res];
            }
            break;

        case "title":
        case "author":
        case "date":
            res += "\\";
            res += name;
            res += "\n";
            if(!onlyRead) {
                document += res;
            }
            var subRes = content(true);
            if(subRes[0]) {
                introduction += "\\";
                introduction += name;
                introduction += "{";
                introduction += subRes[1];
                introduction += "}\n";
            }
            else {
                return [false, res];
            }
            
    }

    return [true, res];
} */