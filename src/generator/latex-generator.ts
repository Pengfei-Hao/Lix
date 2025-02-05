/**
 * Latex generator: translate syntax tree to latex source
 */

import { Node } from "../sytnax-tree/node";
import { Type } from "../sytnax-tree/type";
import { TypeTable } from "../sytnax-tree/type-table";
import { Generator } from "./generator";
import { Compiler } from "../compiler/compiler";
import { FileOperation } from "../compiler/file-operation";
import { Config } from "../compiler/config";

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

    lemmaType: Type;
    propositionType: Type;
    theoremType: Type;
    proofType: Type;
    corollaryType: Type;

    // Introduction & Document
    introduction: string;
    document: string;

    hasMakedTitle: boolean;

    // Generator of specific type of node
    //nodeGeneratorTable: Map<string, (node: Node) => string>;

    // generator of specific math node
    latexFormula: Map<string, string>;
    latexOperator: Map<string, string>;

    // generator of specific setting node
    settingGeneratorTable: Map<string, (parameter: string) => string>;

    //unicodeSymbolsToNotations: Map<string, string>;

    config: Config;
    fileOperation: FileOperation;


    constructor(typeTable: TypeTable, compiler: Compiler) {
        super(typeTable, compiler);
        this.config = compiler.config;
        this.fileOperation = compiler.fileOperation;

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

        this.lemmaType = this.typeTable.get("lemma")!;
        this.propositionType = this.typeTable.get("proposition")!;
        this.theoremType = this.typeTable.get("theorem")!;
        this.corollaryType = this.typeTable.get("corollary")!;
        this.proofType = this.typeTable.get("proof")!;
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
        this.latexOperator = new Map();
        let json: { map: [string, string], operator: [string, string] } = JSON.parse(this.config.get("latex"));
        for (let [key, value] of json.map) {
            this.latexFormula.set(key, value);
        }
        for (let [key, value] of json.operator) {
            this.latexOperator.set(key, value);
        }
    }


    // generate

    async generate(syntaxTree: Node) {
        this.syntaxTree = syntaxTree;

        this.introduction = "";
        this.document = "";
        this.hasMakedTitle = false;

        this.output = "";

        this.addIntrodunction(this.line(this.command("usepackage", "xeCJK")));
        this.addIntrodunction(this.line(this.command("usepackage", "geometry")));
        this.addIntrodunction(this.line(this.command("usepackage", "amsmath")));
        this.addIntrodunction(this.line(this.command("usepackage", "amssymb")));
        this.addIntrodunction(this.line(this.command("usepackage", "amsthm")));
        this.addIntrodunction(this.line(this.command("usepackage", "graphicx")));
        this.addIntrodunction(this.line(this.command("usepackage", "subcaption")));
        this.addIntrodunction(this.line(this.command("usepackage", "circuitikz")));
        this.addIntrodunction(this.line(this.command("usepackage", "listings")));
        this.addIntrodunction(`\\lstset{
	basicstyle          =   \\ttfamily,          % 基本代码风格
	keywordstyle        =   \\bfseries,          % 关键字风格
	commentstyle        =   \\rmfamily\\itshape,  % 注释的风格，斜体
	stringstyle         =   \\ttfamily,  % 字符串风格
	flexiblecolumns,                % 别问为什么，加上这个
	numbers             =   left,   % 行号的位置在左边
	showspaces          =   false,  % 是否显示空格，显示了有点乱，所以不现实了
	numberstyle         =   \\ttfamily,    % 行号的样式，小五号，tt等宽字体
	showstringspaces    =   false,
	captionpos          =   t,      % 这段代码的名字所呈现的位置，t指的是top上面
	frame               =   lrtb,   % 显示边框
    breaklines          =   true,
}\n`);
        this.addIntrodunction(`\\newtheorem{theorem}{Theorem}[section]\n\\newtheorem{lemma}[theorem]{Lemma}\n\\newtheorem{corollary}[theorem]{Corollary}\n\\newtheorem{proposition}[theorem]{Proposition}\n`);

        this.addContent(await this.generateDocument(this.syntaxTree));

        this.output = `\\documentclass{article}\n${this.introduction}\n\\begin{document}\n${this.document}\n\\end{document}`;

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
    async generateDocument(node: Node): Promise<string> {
        let res = "";
        let flag = false;
        for (let n of node.children) {
            switch (n.type) {
                case this.settingType:
                    res += this.generateSetting(n);
                    flag = false;
                    break;
                case this.paragraphType:
                    if (!flag) {
                        flag = true;
                    }
                    else {
                        //res += "\n\\hspace*{\\fill}\n\n";
                        res += "\\vspace{10pt}\n";
                    }
                    res += await this.generateParagraph(n);

                    break;
                case this.titleType:
                    res += this.generateTitle(n);
                    flag = false;
                    break;
                case this.authorType:
                    res += this.generateAuthor(n);
                    flag = false;
                    break;
                case this.dateType:
                    res += this.generateDate(n);
                    flag = false;
                    break;

                case this.sectionType:
                    res += this.generateSection(n);
                    flag = false;
                    break;
                case this.subsectionType:
                    res += this.generateSubsection(n);
                    flag = false;
                    break;
                case this.subsubsectionType:
                    res += this.generateSubsubsection(n);
                    flag = false;
                    break;
                case this.theoremType:
                    res += await this.generateTheorem(n);
                    flag = false;
                    break;
                case this.lemmaType:
                    res += await this.generateLemma(n);
                    flag = false;
                    break;
                case this.corollaryType:
                    res += await this.generateCorollary(n);
                    flag = false;
                    break;
                case this.propositionType:
                    res += await this.generateProposition(n);
                    flag = false;
                    break;
                case this.proofType:
                    res += await this.generateProof(n);
                    flag = false;
                    break;
                default:
                    console.log("generate document error.");
                    flag = false;
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
    async generateParagraph(node: Node): Promise<string> {
        if (node.children.length == 0) {
            console.log("[[empty par]]");
            //return "[[empty par]]";
        }
        let res = "";

        let titled = false;
        if (node.content === "titled") {
            titled = true;
            res += `\\paragraph{${this.generateText(node.children[1]).slice(0, -1)}}\n`;
        }

        let flag = false;
        for (let n of (!titled ? node.children : node.children.slice(2))) {

            switch (n.type) {
                case this.textType:
                    if (flag) {
                        if (n.content === "indent") {
                            res += `\\par `;
                        }
                        else {
                            res += `\\par\\noindent `;
                        }
                        //res += `\\newline `;
                    }
                    else {
                        if (n.content === "noindent") {
                            res += `\\par\\noindent `;
                        }
                        else {
                            res += `\\par `;
                        }
                        flag = true;
                    }
                    res += this.generateText(n);
                    break;

                case this.formulaType:
                    res += this.generateFormula(n);
                    break;
                case this.figureType:
                    res += await this.generateFigure(n);
                    break;
                case this.codeType:
                    res += this.generateCode(n);
                    break;
                case this.listType:
                    res += await this.generateList(n);
                    break;
                case this.tableType:
                    res += "[[Basic Block]]\n";
                    console.log("Unsupported basic block.");
                    break;
            }
            //res += "\n";
        }
        // if(flag) {
        //     res = res.slice(0, -1);
        // }
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
        let num = "";
        if(node.content === "unnumbered") {
            num = "*";
        }
        return `\\section${num}{${this.generateText(node, true)}}\n`;
    }

    // GenerateSubsection
    // Syntax Tree type: subsection
    generateSubsection(node: Node): string {
        let num = "";
        if(node.content === "unnumbered") {
            num = "*";
        }
        return `\\subsection${num}{${this.generateText(node, true)}}\n`;
    }

    // GenerateSubsubection
    // Syntax Tree type: subsubsection
    generateSubsubsection(node: Node): string {
        let num = "";
        if(node.content === "unnumbered") {
            num = "*";
        }
        return `\\subsubsection${num}{${this.generateText(node, true)}}\n`;
    }

    // GenerateTheorem
    // Syntax Tree type: theorem
    async generateTheorem(node: Node): Promise<string> {
        return `\\begin{theorem}${await this.generateParagraph(node)}\\end{theorem}\n`;
    }

    // GenerateLemma
    // Syntax Tree type: lemma
    async generateLemma(node: Node): Promise<string> {
        return `\\begin{lemma}${await this.generateParagraph(node)}\\end{lemma}\n`;
    }

    // GenerateCorollary
    // Syntax Tree type: corollary
    async generateCorollary(node: Node): Promise<string> {
        return `\\begin{corollary}${await this.generateParagraph(node)}\\end{corollary}\n`;
    }

    // GenerateProposition
    // Syntax Tree type: proposition
    async generateProposition(node: Node): Promise<string> {
        return `\\begin{proposition}${await this.generateParagraph(node)}\\end{proposition}\n`;
    }

    // GenerateProof
    // Syntax Tree type: proof
    async generateProof(node: Node): Promise<string> {
        return `\\begin{proof}${await this.generateParagraph(node)}\\end{proof}\n`;
    }


    // GenerateText
    // Syntax Tree type: text | emph | bold | italic
    generateText(node: Node, format = false): string {
        let res = "";
        if (node.children.length == 0) {
            //res += "[[empty text]]";
            console.log("[[empty text]]");
            if (!format) {
                res += "\n";
            }
            return res;
        }
        let flag = false;
        for (let n of node.children) {
            if (flag) {
                //res += " ";
            }
            flag = true;
            switch (n.type) {
                case this.wordsType:
                    // if (n.content.startsWith(" ") && n.content.endsWith(" ")) {
                    //     //res += "[[blank start]]";
                    //     res += n.content.slice(1, -1);
                    //     //res += "[[blank end]]";
                    // }
                    // else if (n.content.startsWith(" ")) {
                    //     //res += "[[blank start]]";
                    //     res += n.content.slice(1);

                    // }
                    // else if (n.content.endsWith(" ")) {
                    //     res += n.content.slice(0,-1);
                    //     //res += "[[blank end]]";
                    // }
                    // else {
                    for (let ch of n.content) {
                        switch (ch) {
                            case "#": case "%": case "{": case "}": case "&": case "_": case "~":
                                res += "\\";
                                res += ch;
                                break;
                            default:
                                res += ch;
                        }
                    }
                    //}
                    break;
                case this.referenceType:
                    res += `\\ref{${n.content}}`;
                    break;
                case this.formulaType:
                    res += this.generateFormula(n, true);
                    break;
                case this.codeType:
                    res += this.generateCode(n, true);
                    break;
                case this.emphType:
                    res += `\\emph{${this.generateText(n, true)}}`;
                    break;
                case this.boldType:
                    res += `\\textbf{${this.generateText(n, true)}}`;
                    break;
                case this.italicType:
                    res += `\\textit{${this.generateText(n, true)}}`;
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
    async generateFigure(node: Node): Promise<string> {
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
        let text = `\\begin{figure}[!htbp]\n\\centering\n\\vspace{-0.3em}\n`;
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
        if (node.children.length == 1) {

        }
        else if (node.children.length == 2) {
            let path = node.children[1].content;
            //if(path.split(".").at(-1) === "tikz") {
            if (this.fileOperation.getFileExtension(path) === "tikz") {
                await this.fileOperation.copyFile(path, "./.lix/");
                let file = await this.fileOperation.readFile(path);
                text += file ?? "";
                text += "\n";
            }
            else {
                text += `\\includegraphics[width = ${size}\\linewidth]{${path}}\n`;
                await this.fileOperation.copyFile(path, "./.lix/");
            }
        }
        else {
            for (let n of node.children) {
                if (n.type === this.figureCaptionType) {
                    continue;
                }
                text += `\\subcaptionbox{${n.children.length > 0 ? this.generateText(n.children[0], true) : ""}}{\n\\includegraphics[width = ${size}\\linewidth]{${n.content}}}\n`;
                await this.fileOperation.copyFile(n.content, "./.lix/");
            }
        }
        let caption = node.children[0];
        text += `\\vspace{-0.6em}\n\\caption{${caption ? this.generateText(caption) : "[[nocaption]]"}}\\vspace{-0.7em}\n\\end{figure}\n`;

        return text;
    }

    // GenerateCode
    // Syntax Tree type: code
    generateCode(node: Node, inline = false): string {
        if (inline) {
            return `\\verb|${node.content}|`;
        }
        else {
            return `\\begin{lstlisting}\n${node.content}\n\\end{lstlisting}\n`
        }

    }

    // GenerateList
    // Syntax Tree type: list
    async generateList(node: Node): Promise<string> {
        if (node.children.length == 0) {
            console.log("[[empty par]]");
            //return "[[empty par]]";
        }
        let res = "";

        res += "\\begin{enumerate}";
        for (let n of node.children) {

            switch (n.type) {
                case this.textType:
                    res += `\\item `;
                    res += this.generateText(n);
                    break;

                case this.formulaType:
                    res += this.generateFormula(n);
                    break;
                case this.figureType:
                    res += await this.generateFigure(n);
                    break;
                case this.codeType:
                    res += this.generateCode(n);
                    break;
                case this.listType:
                    res += await this.generateList(n);
                    break;
                case this.tableType:
                    res += "[[Basic Block]]\n";
                    console.log("Unsupported basic block.");
                    break;
            }
        }
        res += "\\end{enumerate}\n";

        return res;
    }

    // GenerateFormula
    // Syntax Tree type: formula
    generateFormula(node: Node, inline: boolean = false): string {
        let res = inline ? "$" : "\\begin{equation*}\\setlength\\abovedisplayskip{4pt}\\setlength\\belowdisplayskip{4pt}";
        if (node.children.at(-1)?.type === this.expressionType) {
            res += this.generateTermOrOperator(node.children.at(-1)!.children[0]);
        }
        res += inline ? "$" : "\\end{equation*}\\par\n";

        return res;
    }

    // generateExpression(node: Node): string {
    //     let res = "";
    //     for (let subnode of node.children) {
    //         res += this.generateTermOrOperator(subnode);
    //     }
    //     return res;
    // }

    // 要保证为 Latex 中一项
    generateTermOrOperator(node: Node): string {
        let res = "";
        let code: string | undefined;

        switch (node.type) {
            case this.inlineTextType:
                res += `{\\text{${node.content}}}`;
                break;

            case this.elementType:
                let sym = this.latexFormula.get(node.content);
                res += sym ?? `{[[${node.content}]]}`;
                //res += " ";
                break;

            case this.prefixType:
                let cases = false;
                if (node.content === "cases") {
                    cases = true;
                }
                if (node.content === "mat" || cases) {
                    if (cases) {
                        res += `{\\left\\{`
                    }
                    res += `\\begin{matrix}`;
                    let brow = false;
                    for (let row of node.children) {
                        if (brow) {
                            res += `\\\\`;
                        }
                        brow = true;

                        let bcol = false;
                        for (let col of row.children) {
                            let ncode = this.generateTermOrOperator(col);
                            if (bcol) {
                                res += `&`;
                            }
                            bcol = true;
                            res += ncode;
                        }
                    }
                    res += `\\end{matrix}`;
                    if (cases) {
                        res += `\\right.}`
                    }
                    break;
                }
                code = this.latexOperator.get(node.content);
                if (code !== undefined) {
                    for (let i = 0; i < node.children.length; i++) {
                        let ncode = this.generateTermOrOperator(node.children[i]);
                        let flag = `\${${i}}`;
                        code = code.replace(flag, ncode);
                    }
                    res += code;
                }
                else {
                    res += `{[[Prefix Error]]}`;
                }
                // switch (node.content) {
                //     case "lim":
                //         res += `{\\lim_${this.generateTermOrOperator(node.children[0])}${this.generateTermOrOperator(node.children[1])}}`;
                //         break;
                //     case "⋃":
                //         res += `{\\bigcup_${this.generateTermOrOperator(node.children[0])}^${this.generateTermOrOperator(node.children[1])}${this.generateTermOrOperator(node.children[2])}}`;
                //         break;
                //     case "⋂":
                //         res += `{\\bigcap_${this.generateTermOrOperator(node.children[0])}^${this.generateTermOrOperator(node.children[1])}${this.generateTermOrOperator(node.children[2])}}`;
                //         break;
                //     case "∑":
                //         res += `{\\sum_${this.generateTermOrOperator(node.children[0])}^${this.generateTermOrOperator(node.children[1])}${this.generateTermOrOperator(node.children[2])}}`;
                //         break;
                //     case "dot":
                //         res += `{\\dot{${this.generateTermOrOperator(node.children[0])}}}`;
                //         break;
                //     case "hat":
                //         res += `{\\hat{${this.generateTermOrOperator(node.children[0])}}}`;
                //         break;
                //     case "vec":
                //         res += `{\\vec{${this.generateTermOrOperator(node.children[0])}}}`;
                //         break;
                //     case "√":
                //         res += `{\\sqrt ${this.generateTermOrOperator(node.children[0])}}`;
                //         break;
                //     case "cases":
                //         res += `{${this.generateTermOrOperator(node.children[0])}}`;
                //         break;
                //     case "norm":
                //         res += `{\\Vert ${this.generateTermOrOperator(node.children[0])} \\Vert}`;
                //         break;
                //     case "tilde":
                //         res += `{\\widetilde{${this.generateTermOrOperator(node.children[0])}}}`;
                //         break;
                //     case "mat":
                //         res += `{${this.generateTermOrOperator(node.children[0])}}`;
                //         break;
                //     case "(":
                //         res += `{\\left(${this.generateTermOrOperator(node.children[0])}\\right)}`;
                //         break;
                //     case "{":
                //         res += `{\\left\\{${this.generateTermOrOperator(node.children[0])}\\right\\}}`;
                //         break;
                //     case "⟨":
                //         res += `{\\left\\langle${this.generateTermOrOperator(node.children[0])}\\right\\rangle}`;
                //         break;
                // }
                break;

            case this.infixType:
                code = this.latexOperator.get(node.content);
                if (code !== undefined) {
                    if (code === "${default}") {
                        let blank = false;
                        if (node.content === "") {
                            blank = true;
                        }
                        let lastIsAlphabet = false;

                        let i = 0;
                        res += "{";
                        for (let sub of node.children) {
                            let ncode = this.generateTermOrOperator(sub);

                            const reg = /[a-zA-Z]/;
                            if (blank && lastIsAlphabet && ncode.length >= 1 && reg.exec(ncode[0]) != null) {
                                res += " ";
                            }
                            if (blank && ncode.length >= 1 && reg.exec(ncode.at(-1)!) != null) {
                                lastIsAlphabet = true;
                            }
                            else {
                                lastIsAlphabet = false;
                            }

                            res += `${ncode}`;
                            res += (i < node.content.length) ? node.content[i] : "";
                            i++;
                        }
                        res += "}";
                    }
                    else {
                        for (let i = 0; i < node.children.length; i++) {
                            let ncode = this.generateTermOrOperator(node.children[i]);
                            let flag = `\${${i}}`;
                            code = code.replace(flag, ncode);
                        }
                        res += code;
                    }
                }
                else {
                    res += `{[[Infix Error]]}`;
                }
                // switch (node.content) {
                //     case "⁄":
                //         res += `{\\frac${this.generateTermOrOperator(node.children[0])}${this.generateTermOrOperator(node.children[1])}}`;
                //         break;
                //     default:
                //         let i = 0;
                //         res += "{";
                //         for (let sub of node.children) {
                //             res += `${this.generateTermOrOperator(sub)}`;
                //             res += (i < node.content.length) ? node.content[i] : "";
                //             i++;
                //         }
                //         res += "}";
                //         break;

                // }
                break;

        }

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