/**
 * Latex generator: translate syntax tree to latex source
 */

import { Config } from "../foundation/config";
import { Result } from "../foundation/result";
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
    definationType: Type;

    elementType: Type;
    //escapeElementType: Type;
    inlineTextType: Type;

    expressionType: Type;
    //termType: Type;
    infixType: Type;
    prefixType: Type;

    // Core Types

    figureType: Type;
    figureItemType: Type;
    figureCaptionType: Type;
    listType: Type;
    tableType: Type;
    codeType: Type;

    emphType: Type;;
    boldType: Type;;
    italicType: Type;;

    // Article Types

    titleType: Type;
    authorType: Type;
    dateType: Type;
    sectionType: Type;
    subsectionType: Type;
    subsubsectionType: Type;


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
    //nodeGeneratorTable: Map<string, (node: Node) => string>;

    // generator of specific math node
    latexFormula: Map<string, string>;

    // generator of specific setting node
    settingGeneratorTable: Map<string, (parameter: string) => string>;

    //unicodeSymbolsToNotations: Map<string, string>;



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
        this.inlineTextType = this.typeTable.get("inline-text")!;
        this.expressionType = this.typeTable.get("expression")!;
        //this.termType = this.typeTable.get("term")!;
        this.infixType = this.typeTable.get("infix")!;
        this.prefixType = this.typeTable.get("prefix")!;

        this.figureType = this.typeTable.get("figure")!;
        this.figureItemType = this.typeTable.get("figure-item")!;
        this.figureCaptionType = this.typeTable.get("figure-caption")!;
        this.listType = this.typeTable.get("list")!;
        this.tableType = this.typeTable.get("table")!;
        this.codeType = this.typeTable.get("code")!;
        this.emphType = this.typeTable.get("emph")!;
        this.boldType = this.typeTable.get("bold")!;
        this.italicType = this.typeTable.get("italic")!;

        this.titleType = this.typeTable.get("title")!;
        this.authorType = this.typeTable.get("author")!;
        this.dateType = this.typeTable.get("date")!;
        this.sectionType = this.typeTable.get("section")!;
        this.subsectionType = this.typeTable.get("subsection")!;
        this.subsubsectionType = this.typeTable.get("subsubsection")!;

        // this.fractionType = this.typeTable.get("fraction")!;
        // this.sqrtType = this.typeTable.get("sqrt")!;
        // this.sumType = this.typeTable.get("sum")!;
        // this.limitType = this.typeTable.get("limit")!;
        // this.integralType = this.typeTable.get("integral")!;
        // this.scriptType = this.typeTable.get("script")!;
        // this.bracketsType = this.typeTable.get("brackets")!;
        // this.matrixType = this.typeTable.get("matrix")!;


        // Init node generator table
        // this.nodeGeneratorTable = new Map([
        //     ["title", this.generateTitleAuthorDate],
        //     ["author", this.generateTitleAuthorDate],
        //     ["date", this.generateTitleAuthorDate],
        //     ["section", this.generateSectionSubsection],
        //     ["subsection", this.generateSectionSubsection],
        // ]);

        // Init setting generator table
        this.settingGeneratorTable = new Map([
            ["paper", this.generatePaperSetting]
        ]);

        // Init math symbols
        this.latexFormula = new Map();
        let json: { map: [string, string] } = JSON.parse(config.get("latex"));
        for (let [key, value] of json.map) {
            this.latexFormula.set(key, value);
        }

        // let jsonMath = config.get("math");
        // let configMath: { Notations: string[], UnicodeSymbolsAndNotations: string[][], Symbols: string, PrefixOperator: string[][], InfixOperator: string[][] } = JSON.parse(jsonMath);

        // this.unicodeSymbolsToNotations = new Map();
        // for (let tmp of configMath.UnicodeSymbolsAndNotations) {
        //     this.unicodeSymbolsToNotations.set(tmp[0], tmp[1]);
        // }
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
        this.addIntrodunction(this.line(this.command("usepackage", "amssymb")));
        this.addIntrodunction(this.line(this.command("usepackage", "graphicx")));
        this.addIntrodunction(this.line(this.command("usepackage", "subcaption")));
        
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
            switch (n.type) {
                case this.settingType:
                    res += this.generateSetting(n);
                    break;
                case this.paragraphType:
                    res += this.generateParagraph(n);;
                    break;
                case this.titleType:
                    res += this.generateTitle(n);;
                    break;
                case this.authorType:
                    res += this.generateAuthor(n);;
                    break;
                case this.dateType:
                    res += this.generateDate(n);;
                    break;

                case this.sectionType:
                    res += this.generateSection(n);;
                    break;
                case this.subsectionType:
                    res += this.generateSubsection(n);;
                    break;
                case this.subsubsectionType:
                    res += this.generateSubsubsection(n);;
                    break;
                default:
                    console.log("generate document error.");
                    return res;

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
        if (node.children.length == 0) {
            return "[[empty par]]";
        }
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
                    res += this.generateFigure(n);
                    break;
                case this.listType:
                case this.tableType:
                case this.codeType:
                    res += "[[Basic Block]]\n";
                    console.log("Unsupported basic block.");
                    break;
            }
            //res += "\n";
        }
        res += "\n\\hspace*{\\fill}\n\n";
        return res;
    }

    // GenerateTitle
    // Syntax Tree type: title
    generateTitle(node: Node): string {
        this.addIntrodunction(this.line(`\\title{${this.generateText(node, true)}}`));
        if (!this.hasMakedTitle) {
            this.hasMakedTitle = true;
            return "\\maketitle\n";
        }
        return "";
    }

    // GenerateAuthor
    // Syntax Tree type: author
    generateAuthor(node: Node): string {
        this.addIntrodunction(this.line(`\\author{${this.generateText(node, true)}}`));
        if (!this.hasMakedTitle) {
            this.hasMakedTitle = true;
            return "\\maketitle\n";
        }
        return "";
    }

    // GenerateDate
    // Syntax Tree type: date
    generateDate(node: Node): string {
        this.addIntrodunction(this.line(`\\date{${this.generateText(node, true)}}`));
        if (!this.hasMakedTitle) {
            this.hasMakedTitle = true;
            return "\\maketitle\n";
        }
        return "";
    }

    // GenerateSection
    // Syntax Tree type: section
    generateSection(node: Node): string {
        return `\\section{${this.generateText(node, true)}}\n`;
    }

    // GenerateSubsection
    // Syntax Tree type: subsection
    generateSubsection(node: Node): string {
        return `\\subsection{${this.generateText(node, true)}}\n`;
    }

    // GenerateSubsubection
    // Syntax Tree type: subsubsection
    generateSubsubsection(node: Node): string {
        return `\\subsubsection{${this.generateText(node, true)}}\n`;
    }


    // GenerateText
    // Syntax Tree type: text | emph | bold | italic
    generateText(node: Node, format = false): string {
        let res = "";
        if (node.children.length == 0) {
            res += "[[empty text]]";
            if (!format) {
                res += "\n";
            }
            return res;
        }

        for (let n of node.children) {
            switch (n.type) {
                case this.wordsType:
                    if (res.startsWith(" ") && res.endsWith(" ")) {
                        res += "[[blank start]]";
                        res += n.content.split(" ")[1];
                        res += "[[blank end]]";
                    }
                    else if (res.startsWith(" ")) {
                        res += "[[blank start]]";
                        res += n.content.split(" ")[1];

                    }
                    else if (res.endsWith(" ")) {
                        res += n.content.split(" ")[0];
                        res += "[[blank end]]";
                    }
                    else {
                        res += n.content;
                    }
                    break;
                case this.referenceType:
                    res += `\\ref{${n.content}}`;
                    break;
                case this.formulaType:
                    res += this.generateFormula(n, true);
                    break;
                case this.emphType:
                case this.boldType:
                case this.italicType:
                    res += this.generateText(n, true);
                    break;
            }
        }
        if (!format) {
            res += "\n";
        }
        return res;
    }

    // GenerateFigure
    // Syntax Tree type: figure
    generateFigure(node: Node): string {
        // \begin{figure}[!htbp]
        // \centering
        // \subcaptionbox{矩形区域}{
        // \includegraphics[width = 0.4\linewidth]{squ_dom.eps}
        // }
        // \subcaptionbox{网格划分}{
        // \includegraphics[width = 0.4\linewidth]{squ_mesh.eps}
        // }
        // \caption{区域和网格选取}\label{fig:squ_dom}
        // \end{figure}
        let text = `\\begin{figure}[!htbp]\n\\centering\n`;
        //let caption: Node | undefined = undefined;

        let size = "0.4";
        switch (node.content) {
            case "small":
                size = "0.2";
                break;
            case "medium":
                size = "0.4";
                break;
            case "large":
                size = "0.8";
                break;
        }
        if(node.children.length ==1) {

        }
        else if(node.children.length == 2) {
            text += `\\includegraphics[width = ${size}\\linewidth]{${node.children[1].content}}\n`;
        }
        else {
            for (let n of node.children) {
                if(n.type === this.figureCaptionType) {
                    continue;
                }
                text += `\\subcaptionbox{${n.children.length > 0 ? this.generateText(n.children[0], true) : ""}}{\n\\includegraphics[width = ${size}\\linewidth]{${n.content}}}\n`;
            }
        }
        let caption = node.children[0];
        text += `\\caption{${caption ? this.generateText(caption) : "[[nocaption]]"}}\n\\end{figure}\n`;
        
        return text;
    }

    // GenerateFormula
    // Syntax Tree type: formula
    generateFormula(node: Node, inline: boolean = false): string {
        let res = inline ? "$" : "\\[";
        if (node.children.at(-1)?.type === this.expressionType) {
            res += this.generateExpression(node.children.at(-1)!);
        }
        res += inline ? "$" : "\\]\n";

        return res;
    }

    generateExpression(node: Node): string {
        let res = "";
        for (let subnode of node.children) {
            res += this.generateTermOrOperator(subnode);
        }
        return res;
    }

    generateTerm(node: Node): string {
        let res = "";

        switch (node.type) {
            case this.inlineTextType:
                res += `\\text{${node.content}} `;
                break;

            case this.elementType:
                let sym = this.latexFormula.get(node.content);
                res += sym ?? `{[[${node.content}]]} `;
                break;

            case this.expressionType:
                res += `{${this.generateExpression(node)}} `;
                break;

            case this.prefixType:
                switch (node.content) {
                    case "lim":
                        res += `{\\lim_{${this.generateExpression(node.children[0])}}${this.generateExpression(node.children[1])}}`;
                        break;
                    case "∑":
                        res += `{\\sum_{${this.generateExpression(node.children[0])}}^{${this.generateExpression(node.children[1])}}${this.generateExpression(node.children[2])}}`;
                        break;
                    case "dot":
                        res += `{\\dot ${this.generateTerm(node.children[0])}}`;
                        break;
                    case "√":
                        res += `{\\sqrt ${this.generateTerm(node.children[0])}}`;
                        break;
                    case "cases":
                        res += `{${this.generateTerm(node.children[0])}}`;
                        break;
                    case "norm":
                        res += `{\\Vert ${this.generateTermOrOperator(node.children[0])} \\Vert}`;
                        break;
                    case "mat":
                        res += `{${this.generateExpression(node.children[0])}}`;
                        break;
                    case "(":
                        res += `{\\left(${this.generateExpression(node.children[0])}\\right)}`;
                        break;
                    case "{":
                        res += `{\\left\\{${this.generateExpression(node.children[0])}\\right\\}}`;
                        break;
                    case "⟨":
                        res += `\\left\\langle{${this.generateExpression(node.children[0])}\\right\\rangle}`;
                        break;
                }
        }

        return res;
    }

    generateOperator(node: Node): string {
        let res = "";

        switch (node.type) {
            case this.infixType:
                switch (node.content) {
                    case "⁄":
                        res += `\\frac {${this.generateTermOrOperator(node.children[0])}} {${this.generateTermOrOperator(node.children[1])}}`;
                        break;
                    default:
                        let i = 0;
                        for (let sub of node.children) {
                            res += `{${this.generateTermOrOperator(sub)}}`;
                            res += (i < node.content.length) ? node.content[i] : "";
                            i++;
                        }
                        break;

                }
        }
        return res;
    }

    generateTermOrOperator(node: Node): string {
        let res = "";
        res += this.generateTerm(node);
        res += this.generateOperator(node);
        return res;
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