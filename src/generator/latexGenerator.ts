/**
 * Latex generator: convert nodes to latex source
 */

// latex generate

import * as parser from '../parser/parser';
import {Node, Type} from '../parser/AST';


let ast: Node;

export function init(node: Node) {
    ast = node;
}

export function getLatex(): string {
    introduction = "";
    document = "";
    hasMakedTitle = false;

    addIntrodunction(line(command("usepackage", "xeCJK")));
    addIntrodunction(line(command("usepackage", "geometry")));
    addIntrodunction(line(command("usepackage", "amsmath")));
    addContent(documentLabel(parser.getAST()));

    return `\\documentclass{article}\n${introduction}\n\\begin{document}\n${document}\n\\end{document}`;
}

function convertLabel(node: Node): string {
    if(node.type === Type.paragraph) {
        return node.content;
    }
    else {
        var func = labels.get(node.content);
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
    var func = settings.get(node.content);
    if(func !== undefined) {
        func(node.children[0].content);
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
        if(n.type === Type.setting) {
            convertSetting(n);
        }
        else {
            res += paragraphLabel(n);
        }
    }
    return res;
}


function paragraphLabel(node: Node): string {
    return convertAllChildLabel(node) + "\n";
}

var hasMakedTitle = false;

function titleAuthorDateLabel(node: Node): string {
    var t = convertAllChildLabel(node);
    var res = "";
    if(!hasMakedTitle) {
        res = line(command("maketitle"));
        hasMakedTitle = !hasMakedTitle;
    }
    addIntrodunction(line(command(node.content, t)));
    return res;
}

function sectionSubsectionLabel(node: Node): string {
    
    return line(command(node.content, convertAllChildLabel(node)));
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
        if(n.type === Type.paragraph && n.content === "/") {
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
    if(node.type === Type.paragraph) {
        return convertMathSymbol(node.content);
    }
    else {
        var func = mathLabels.get(node.content);
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