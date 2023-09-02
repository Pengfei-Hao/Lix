/**
 * Latex generator: convert nodes to latex source
 */

import { Config } from "../config";
import { Parser } from "../parser/parser";
import { Node } from "../sytnax-tree/node";
import { Type } from "../sytnax-tree/type";
import { TypeTable } from "../sytnax-tree/type-table";
import { Generator } from "./generator";

// latex generate

export class LatexGenerator extends Generator {

    // Types
    type: TypeTable;
    documentType: Type;
    paragraphType: Type;
    textType: Type;
    settingType: Type;
    settingParameterType: Type;
    labelType: Type;

    // Math Types
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

    constructor(syntaxTree: Node, typeTable: TypeTable, config: Config) {
        super(syntaxTree);
        this.type = typeTable;

        this.introduction = "";
        this.document = "";

        this.hasMakedTitle = false;

        this.documentType = this.type.get("document")!;
        this.paragraphType = this.type.get("paragraph")!;
        this.textType = this.type.get("text")!;
        this.settingType = this.type.get("setting")!;
        this.settingParameterType = this.type.get("setting-parameter")!;
        this.labelType = this.type.get("label")!;


        this.formulaType = this.type.get("formula")!;
        this.symbolType = this.type.get("symbol")!;
        this.definationType = this.type.get("defination")!;

        this.fractionType = this.type.get("fraction")!;
        this.sqrtType = this.type.get("sqrt")!;
        this.sumType = this.type.get("sum")!;
        this.limitType = this.type.get("limit")!;
        this.integralType = this.type.get("integral")!;
        this.scriptType = this.type.get("script")!;
        this.bracketsType = this.type.get("brackets")!;
        this.matrixType = this.type.get("matrix")!;


        // Init node generator table
        this.nodeGeneratorTable = new Map([
            ["title", this.generateTitleAuthorDate],
            ["author", this.generateTitleAuthorDate],
            ["date", this.generateTitleAuthorDate],
            ["section", this.generateSectionSubsection],
            ["subsection", this.generateSectionSubsection],
        ]);

        // Init setting generator table
        this.settingGeneratorTable = new Map([
            ["paper", this.generatePaperSetting]
        ]);

        // Init math symbols
        this.mathSymbols = new Map();
        let json: {map: [string, string]} = JSON.parse(config.get("latex"));
        for(let [key, value] of json.map) {
            this.mathSymbols.set(key, value);
        }

    }

    // introduction and document of latex source

    introduction: string;
    document: string;

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

    // generate

    generate(): string {

        this.introduction = "";
        this.document = "";
        this.hasMakedTitle = false;

        this.addIntrodunction(this.line(this.command("usepackage", "xeCJK")));
        this.addIntrodunction(this.line(this.command("usepackage", "geometry")));
        this.addIntrodunction(this.line(this.command("usepackage", "amsmath")));
        this.addContent(this.generateDocument(this.syntaxTree));

        return `\\documentclass{article}\n${this.introduction}\n\\begin{document}\n${this.document}\n\\end{document}`;
    }

    
    // Generator of specific type of node

    nodeGeneratorTable: Map<string, (node: Node) => string>;

    // GenerateDocument
    // Syntax Tree type: document
    generateDocument(node: Node): string {
        var res = "";
        for (var n of node.children) {
            if (n.type === this.settingType) {
                this.generateSetting(n);
            }
            else {
                res += this.generateParagraph(n);
            }
        }
        return res;
    }

    // GenerateSetting
    // Syntax Tree type: setting
    generateSetting(node: Node): string {
        var func = this.settingGeneratorTable.get(node.content);
        if (func !== undefined) {
            func.bind(this)(node.children[0].content);
        }
        return "[[[setting failure]]]";
    }

    // GenerateParagraph
    // Syntax Tree type: paragraph
    generateParagraph(node: Node): string {
        return this.generateChildrenNode(node) + "\n";
    }

    // GenerateNode: Assistant function to generateParagraph
    // Syntax Tree type: text | label | formula
    generateNode(node: Node): string {
        if (node.type === this.textType) {
            return node.content;
        }
        else if(node.type === this.formulaType) {
            return this.generateFormula(node);
        }
        else if(node.type === this.labelType) {
            var func = this.nodeGeneratorTable.get(node.content);
            if (func !== undefined) {
                return func.bind(this)(node);
            }
            else {
                // todo
                return "[[[failure]]]";
            }
        }
        else {
            return "[[[failure]]]";
        }
    }

    generateChildrenNode(node: Node): string {
        var res = "";
        for (var n of node.children) {
            res += this.generateNode(n);
        }
        return res;
    }


    hasMakedTitle;

    // GenerateTitleAuthorDate
    // Syntax Tree type: title | author | date (Use label type and its content to represent temporarily)
    generateTitleAuthorDate(node: Node): string {
        var t = this.generateChildrenNode(node);
        var res = "";
        if (!this.hasMakedTitle) {
            res = this.line(this.command("maketitle"));
            this.hasMakedTitle = !this.hasMakedTitle;
        }
        this.addIntrodunction(this.line(this.command(node.content, t)));
        return res;
    }

    // GenerateSectionSubsection
    // Syntax Tree type: section | subsection (Use label type and its content to represent temporarily)
    generateSectionSubsection(node: Node): string {
        return this.line(this.command(node.content, this.generateChildrenNode(node)));
    }

    // generator of specific math node

    mathSymbols: Map<string, string>;

    
    // GenerateFraction
    // Syntax Tree type: fraction
    generateFraction(node: Node): string {
        return `\\frac{${this.generateChildrenMathNode(node.children[0])}}{${this.generateChildrenMathNode(node.children[1])}}`;
    }

    // GenerateMatrix
    // Syntax Tree type: matrix
    generateMatrix(node: Node): string {
        let res = "";
        for(let subnode of node.children) {
            res += this.generateChildrenMathNode(subnode);
            res += "\\\\";
        }
        return `\\begin{matrix}${res}\\end{matrix}`;
    }

    // GenerateSqrt
    // Syntax Tree type: sqrt
    generateSqrt(node: Node): string {
        return `\\sqrt{${this.generateChildrenMathNode(node)}}`;
    }

    // GenerateSum
    // Syntax Tree type: sum
    generateSum(node: Node): string {
        return `\\sum_{${this.generateChildrenMathNode(node.children[0])}}^{${this.generateChildrenMathNode(node.children[1])}}{${this.generateChildrenMathNode(node.children[2])}}`;
    }

    // GenerateLimit
    // Syntax Tree type: limit
    generateLimit(node: Node): string {
        return `\\lim_{${this.generateChildrenMathNode(node.children[0])}}{${this.generateChildrenMathNode(node.children[1])}}`;
    }

    // GenerateIntegral
    // Syntax Tree type: integral
    generateIntegral(node: Node): string {
        return `\\int_{${this.generateChildrenMathNode(node.children[0])}}^{${this.generateChildrenMathNode(node.children[1])}}{${this.generateChildrenMathNode(node.children[2])}}`;
    }

    // GenerateScript
    // Syntax Tree type: script
    generateScript(node: Node): string {
        return `{${this.generateChildrenMathNode(node.children[0])}}^{${this.generateChildrenMathNode(node.children[1])}}_{${this.generateChildrenMathNode(node.children[2])}}`;
    }

    // GenerateBrackets
    // Syntax Tree type: brackets
    generateBrackets(node: Node): string {
        return `{\\left${node.children[0].content}{${this.generateChildrenMathNode(node.children[1])}}\\right${node.children[2].content}}`;
    }

    // GenerateFormula
    // Syntax Tree type: formula
    generateFormula(node: Node): string {
        var res = "\\[";
        res += this.generateChildrenMathNode(node);
        res += "\\]";
        return res;
    }

    // GenerateMathNode: Assistant function to generateFormula
    // Syntax Tree type: symbol | formula | fraction | ...
    generateMathNode(node: Node): string {
        if (node.type === this.symbolType) {
            return this.generateSymbol(node.content);
        }
        else if (node.type === this.formulaType) {
            let res = "\\{";
            res += this.generateChildrenMathNode(node);
            res += "\\}";
            return res;
        }
        else {
            let generate;
            switch(node.type) {
                case this.fractionType:
                    generate = this.generateFraction;
                    break;
                case this.matrixType:
                    generate = this.generateMatrix;
                    break;
                case this.sqrtType:
                    generate = this.generateSqrt;
                    break;
                case this.sumType:
                    generate = this.generateSum;
                    break;
                case this.limitType:
                    generate = this.generateLimit;
                    break;
                case this.integralType:
                    generate = this.generateIntegral;
                    break;
                case this.scriptType:
                    generate = this.generateScript;
                    break;
                case this.bracketsType:
                    generate = this.generateBrackets;
                    break;
                default:
                    return "[[[failure]]]";
            }
            return generate.bind(this)(node);
        }
    }

    generateChildrenMathNode(node: Node): string {
        let res = "";
        for (var n of node.children) {
            res += this.generateMathNode(n);
        }
        return res;
    }

    // GenerateSymbol
    // Syntax Tree type: symbol
    generateSymbol(symbol: string): string {
        let res = this.mathSymbols.get(symbol);
        if (res !== undefined) {
            return res;
        }
        else {
            return "[[[symbol failure]]]";
        }
    }

    // generator of specific setting node

    settingGeneratorTable: Map<string, (parameter: string) => string>;

    // GeneratePaperSetting
    // Syntax Tree type: setting
    generatePaperSetting(parameter: string): string {
        if (parameter === "a4") {
            this.addIntrodunction(this.line(this.command("geometry", "a4paper")));
        }
        else if (parameter === "b5") {
            this.addIntrodunction(this.line(this.command("geometry", "b5paper")));
        }
        return "";
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