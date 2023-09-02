/**
 * Latex generator: convert nodes to latex source
 */

import { Parser } from "../parser/parser";
import { Node } from "../sytnax-tree/node";
import { Type } from "../sytnax-tree/type";
import { TypeTable } from "../sytnax-tree/type-table";
import { Generator } from "./generator";

// latex generate

export class LatexGenerator extends Generator {

    // Types
    documentType: Type;
    paragraphType: Type;
    textType: Type;
    settingType: Type;
    settingParameterType: Type;
    labelType: Type;

    equationType: Type;
    symbolType: Type;
    definationType: Type;
    fractionType: Type;
    matrixType: Type;

    constructor(parser: Parser) {
        super(parser.syntaxTree);

        this.documentType = parser.documentType;
        this.paragraphType = parser.paragraphType;
        this.textType = parser.textType;
        this.settingType = parser.settingType;
        this.settingParameterType = parser.settingParameterType;
        this.labelType = parser.labelType;

        this.equationType = parser.mathModule.formulaType;
        this.symbolType = parser.mathModule.symbolType;
        this.definationType = parser.mathModule.definationType;
        this.fractionType = parser.mathModule.fractionType;
        this.matrixType = parser.mathModule.matrixType;
    }

    generate(): string {

        this.introduction = "";
        this.document = "";
        this.hasMakedTitle = false;

        this.addIntrodunction(this.line(this.command("usepackage", "xeCJK")));
        this.addIntrodunction(this.line(this.command("usepackage", "geometry")));
        this.addIntrodunction(this.line(this.command("usepackage", "amsmath")));
        this.addContent(this.documentLabel(this.syntaxTree));

        return `\\documentclass{article}\n${this.introduction}\n\\begin{document}\n${this.document}\n\\end{document}`;
    }

    convertLabel(node: Node): string {
        if (node.type === this.paragraphType) {
            return node.content;
        }
        else {
            var func = this.labels.get(node.content);
            if (func !== undefined) {
                return func(node);
            }
            else {
                // todo
                return "[[[failure]]]";
            }
        }
    }

    convertAllChildLabel(node: Node): string {
        var res = "";
        for (var n of node.children) {
            res += this.convertLabel(n);
        }
        return res;
    }

    convertSetting(node: Node): string {
        var func = this.settings.get(node.content);
        if (func !== undefined) {
            func(node.children[0].content);
        }
        return "";
    }

    // label manager

    labels: Map<string, (node: Node) => string> = new Map([
        ["document", this.documentLabel],
        ["paragraph", this.paragraphLabel],
        ["title", this.titleAuthorDateLabel],
        ["author", this.titleAuthorDateLabel],
        ["date", this.titleAuthorDateLabel],
        ["section", this.sectionSubsectionLabel],
        ["subsection", this.sectionSubsectionLabel],
        ["equation", this.equationLabel]
    ]);

    documentLabel(node: Node): string {
        var res = "";
        for (var n of node.children) {
            if (n.type === this.settingType) {
                this.convertSetting(n);
            }
            else {
                res += this.paragraphLabel(n);
            }
        }
        return res;
    }


    paragraphLabel(node: Node): string {
        return this.convertAllChildLabel(node) + "\n";
    }

    hasMakedTitle = false;

    titleAuthorDateLabel(node: Node): string {
        var t = this.convertAllChildLabel(node);
        var res = "";
        if (!this.hasMakedTitle) {
            res = this.line(this.command("maketitle"));
            this.hasMakedTitle = !this.hasMakedTitle;
        }
        this.addIntrodunction(this.line(this.command(node.content, t)));
        return res;
    }

    sectionSubsectionLabel(node: Node): string {

        return this.line(this.command(node.content, this.convertAllChildLabel(node)));
    }

    // math label manager

    mathLabels: Map<string, (node: Node) => string> = new Map([
        ["frac", this.fracLabel],
        ["matrix", this.matrixLabel]
    ]);

    mathSymbols: Map<string, string> = new Map([
        ["x", "\\cdot{}"],
        ["x1", "x_{1}"],
        ["x2", "x_{2}"],
        ["x3", "x_{3}"],
        ["y1", "y_{1}"],
        ["y2", "y_{2}"],
        ["y3", "y_{3}"]
    ]);

    fracLabel(node: Node): string {
        var a = "", b = ""; // a/b
        for (var n of node.children) {
            if (n.type === this.paragraphType && n.content === "/") {
                a = b;
                b = "";
            }
            else {
                b += this.convertMathLabel(n);
            }
        }

        return `\\frac{${a}}{${b}}`;
    }

    matrixLabel(node: Node): string {
        return `\\begin{matrix}${this.convertAllChildMathLabel(node)}\\end{matrix}`;
    }

    equationLabel(node: Node): string {
        var res = "\\[";

        res += this.convertAllChildMathLabel(node);

        res += "\\]";
        return res;
    }

    convertMathLabel(node: Node): string {
        if (node.type === this.paragraphType) {
            return this.convertMathSymbol(node.content);
        }
        else {
            var func = this.mathLabels.get(node.content);
            if (func !== undefined) {
                return func(node);
            }
            else {
                return "[[[failure]]]";
            }
        }
    }

    convertAllChildMathLabel(node: Node): string {
        var res = "";
        for (var n of node.children) {
            res += this.convertMathLabel(n);
        }
        return res;
    }

    convertMathSymbol(symbol: string): string {
        var res = this.mathSymbols.get(symbol);
        if (res !== undefined) {
            return res;
        }
        else {
            return symbol;
        }
    }

    // settings manager

    settings: Map<string, (parameter: string) => string> = new Map([
        ["paper", this.paperSetting]
    ]);

    paperSetting(parameter: string): string {
        if (parameter === "a4") {
            this.addIntrodunction(this.line(this.command("geometry", "a4paper")));
        }
        else if (parameter === "b5") {
            this.addIntrodunction(this.line(this.command("geometry", "b5paper")));
        }
        return "";
    }


    // introduction and document of latex source

    introduction: string = "";
    document: string = "";

    addIntrodunction(intr: string) {
        this.introduction += intr;
    }

    line(text: string) {
        return text + "\n";
    }
    command(name: string, content: string = "") {
        return `\\${name}{${content}}`;
    }

    addContent(text: string) {
        this.document += text;
    }

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