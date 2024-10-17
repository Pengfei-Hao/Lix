/**
 * Latex generator: translate syntax tree to latex source
 */

import { Config } from "../foundation/config";
import { Parser } from "../parser/parser";
import { Node } from "../sytnax-tree/node";
import { Type } from "../sytnax-tree/type";
import { TypeTable } from "../sytnax-tree/type-table";
import { Generator } from "./generator";

// latex generate

export class LatexGenerator extends Generator {

    // Basic Types

    documentType: Type;;
    paragraphType: Type;;
    textType: Type;;
    wordsType: Type;;
    nameType: Type;
    referenceType: Type;;
    settingType: Type;;
    settingParameterType: Type;;
    blockType: Type;
    errorType: Type;
    argumentsType: Type;
    argumentItemType: Type;

    // Math Types
    formulaType: Type;
    elementType: Type;
    definationType: Type;
    mathTextType: Type;

    expressionType: Type;
    termType: Type;
    infixType: Type;
    prefixType: Type;

    // Core Types

    figureType: Type;
    figureInfoType: Type;
    listType: Type;
    tableType: Type;
    codeType: Type;
    
    emphType: Type;;
    boldType: Type;;
    italicType: Type;;


    // fractionType: Type;
    // matrixType: Type;
    // sqrtType: Type;
    // sumType: Type;
    // limitType: Type;
    // integralType: Type;
    // scriptType: Type;
    // bracketsType: Type;

    // Introduction & Document
    introduction: string;
    document: string;

    hasMakedTitle: boolean;

    // Generator of specific type of node
    nodeGeneratorTable: Map<string, (node: Node) => string>;

    // generator of specific math node
    mathSymbols: Map<string, string>;

    // generator of specific setting node
    settingGeneratorTable: Map<string, (parameter: string) => string>;



    constructor(typeTable: TypeTable, config: Config) {
        super(typeTable, config);

        this.introduction = "";
        this.document = "";

        this.hasMakedTitle = false;

        this.documentType = this.typeTable.get("document")!;
        this.paragraphType = this.typeTable.get("paragraph")!;
        this.textType = this.typeTable.get("text")!;
        this.wordsType = this.typeTable.get("words")!;
        this.nameType = this.typeTable.get("name")!;
        this.referenceType = this.typeTable.get("reference")!;
        this.settingType = this.typeTable.get("setting")!;
        this.settingParameterType = this.typeTable.get("setting-parameter")!;
        this.blockType = this.typeTable.get("block")!;
        this.errorType = this.typeTable.get("error")!;
        this.argumentsType = this.typeTable.get("arguments")!;
        this.argumentItemType = this.typeTable.get("argument-item")!;

        this.formulaType = this.typeTable.get("formula")!;
        this.elementType = this.typeTable.get("element")!;
        this.definationType = this.typeTable.get("defination")!;
        this.mathTextType = this.typeTable.get("math-text")!;
        this.expressionType = this.typeTable.get("expression")!;
        this.termType = this.typeTable.get("term")!;
        this.infixType = this.typeTable.get("infix")!;
        this.prefixType = this.typeTable.get("prefix")!;

        this.figureType = this.typeTable.get("figure")!;
        this.figureInfoType = this.typeTable.get("figure-info")!;
        this.listType = this.typeTable.get("list")!;
        this.tableType = this.typeTable.get("table")!;
        this.codeType = this.typeTable.get("code")!;
        this.emphType = this.typeTable.get("emph")!;
        this.boldType = this.typeTable.get("bold")!;
        this.italicType = this.typeTable.get("italic")!;

        // this.fractionType = this.typeTable.get("fraction")!;
        // this.sqrtType = this.typeTable.get("sqrt")!;
        // this.sumType = this.typeTable.get("sum")!;
        // this.limitType = this.typeTable.get("limit")!;
        // this.integralType = this.typeTable.get("integral")!;
        // this.scriptType = this.typeTable.get("script")!;
        // this.bracketsType = this.typeTable.get("brackets")!;
        // this.matrixType = this.typeTable.get("matrix")!;


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
        let json: { map: [string, string] } = JSON.parse(config.get("latex"));
        for (let [key, value] of json.map) {
            this.mathSymbols.set(key, value);
        }
    }


    // generate

    generate(syntaxTree: Node) {
        this.syntaxTree = syntaxTree;

        this.introduction = "";
        this.document = "";
        this.hasMakedTitle = false;

        this.addIntrodunction(this.line(this.command("usepackage", "xeCJK")));
        this.addIntrodunction(this.line(this.command("usepackage", "geometry")));
        this.addIntrodunction(this.line(this.command("usepackage", "amsmath")));

        this.addContent(this.generateDocument(this.syntaxTree));

        return `\\documentclass{article}\n${this.introduction}\n\\begin{document}\n${this.document}\n\\end{document}`;

    }

    // introduction and document of latex source

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


    // GenerateDocument
    // Syntax Tree type: document
    generateDocument(node: Node): string {
        let res = "";
        for (let n of node.children) {
            if (n.type === this.settingType) {
                res += this.generateSetting(n);
            }
            else if (n.type === this.paragraphType) {
                res += this.generateParagraph(n);
            }
            else {
                console.log("geDocument error.");
                break;
            }
        }
        return res;
    }

    // GenerateSetting
    // Syntax Tree type: setting
    generateSetting(node: Node): string {
        let func = this.settingGeneratorTable.get(node.content);
        if (func !== undefined) {
            func.bind(this)(node.children[0].content);
        }
        else {
            console.log("geSetting error.");
        }
        return "";
    }

    // GenerateParagraph
    // Syntax Tree type: paragraph
    generateParagraph(node: Node): string {
        let res = "";
        for (let n of node.children) {
            switch (n.type) {
                case this.textType:
                    res += this.generateText(n);
                    break;

                case this.formulaType:
                    res += this.generateFormula(n);
                    break;
                case this.figureType:
                case this.listType:
                case this.tableType:
                case this.codeType:
                    res += "[[Basic Block]]";
                    console.log("Unsupported basic block.");
                    break;
            }
        }
        return res;
    }

    // GenerateText
    // Syntax Tree type: text | emph | bold | italic
    generateText(node: Node): string {
        let res = "";
        for (let n of node.children) {
            switch (n.type) {
                case this.wordsType:
                    res += n.content;
                    break;
                case this.referenceType:
                    res += `\ref{${n.content}}`;
                    break;
                case this.formulaType:
                    res += this.generateFormula(n, true);
                    break;
                case this.emphType:
                case this.boldType:
                case this.italicType:
                    res += this.generateText(n);
                    break;
            }
        }
        return res;
    }

    // GenerateNode: Assistant function to generateParagraph
    // Syntax Tree type: text | label | formula
    // generateNode(node: Node): string {
    //     if (node.type === this.textType) {
    //         return node.content;
    //     }
    //     else if (node.type === this.formulaType) {
    //         return this.generateFormula(node);
    //     }
    //     else if (node.type === this.labelType) {
    //         let func = this.nodeGeneratorTable.get(node.content);
    //         if (func !== undefined) {
    //             return func.bind(this)(node);
    //         }
    //         else {
    //             // todo
    //             return "[[[failure]]]";
    //         }
    //     }
    //     else {
    //         return "[[[failure]]]";
    //     }
    // }

    // generateChildrenNode(node: Node): string {
    //     let res = "";
    //     for (let n of node.children) {
    //         res += this.generateNode(n);
    //     }
    //     return res;
    // }

    // GenerateTitleAuthorDate
    // Syntax Tree type: title | author | date (Use label type and its content to represent temporarily)
    // generateTitleAuthorDate(node: Node): string {
    //     let t = this.generateChildrenNode(node);
    //     let res = "";
    //     if (!this.hasMakedTitle) {
    //         res = this.line(this.command("maketitle"));
    //         this.hasMakedTitle = !this.hasMakedTitle;
    //     }
    //     this.addIntrodunction(this.line(this.command(node.content, t)));
    //     return res;
    // }

    // GenerateSectionSubsection
    // Syntax Tree type: section | subsection (Use label type and its content to represent temporarily)
    // generateSectionSubsection(node: Node): string {
    //     return this.line(this.command(node.content, this.generateChildrenNode(node)));
    // }

    // GenerateFormula
    // Syntax Tree type: formula
    generateFormula(node: Node, inline: boolean = false): string {
        let res = "\\[";
        if(node.children.at(-1)?.type === this.expressionType) {
            res += this.generateChildrenMathNode(node);
        }
        res += "\\]";
        return res;
    }

    // GenerateFraction
    // Syntax Tree type: fraction
    generateFraction(node: Node): string {
        return `\\frac{${this.generateChildrenMathNode(node.children[0])}}{${this.generateChildrenMathNode(node.children[1])}}`;
    }

    // GenerateMatrix
    // Syntax Tree type: matrix
    generateMatrix(node: Node): string {
        let res = "";
        for (let subnode of node.children) {
            for (let n of subnode.children) {
                res += this.generateMathNode(n);
                res += "&";
            }
            res = res.substring(0, res.length - 1);
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
        let left = node.children[0].content;
        let right = node.children[2].content;
        if (left === "{") {
            left = "\\{";
        }
        if (right === "}") {
            right = "\\}";
        }
        return `{\\left${left}{${this.generateChildrenMathNode(node.children[1])}}\\right${right}}`;
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
            switch (node.type) {
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
        for (let n of node.children) {
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
    let res = "";
    switch (name) {
        case "section":
        case "subsection":
            res += "\\";
            res += name;
            res += "{"; 
            if(!onlyRead) {
                document += res;
            }
            
            let subRes = content();
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
            let subRes = content(true);
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