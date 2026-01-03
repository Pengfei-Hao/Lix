/**
 * Latex generator: translate syntax tree to latex source
 */

import { Node } from "../sytnax-tree/node";
import { Type } from "../sytnax-tree/type";
import { TypeTable } from "../sytnax-tree/type-table";
import { Generator } from "./generator";
import { Compiler } from "../compiler/compiler";
import { FileSystem } from "../compiler/file-system";
import { Config } from "../compiler/config";
import { Reference } from "../parser/result";

// markdown generate

// export class MarkdownGeneratorO extends Generator {

//     // Basic Types

//     documentType: Type;
//     paragraphType: Type;
//     textType: Type;
//     wordsType: Type;
//     nameType: Type;
//     referenceType: Type;
//     settingType: Type;
//     settingParameterType: Type;;
//     blockType: Type;
//     errorType: Type;
//     argumentsType: Type;
//     argumentType: Type;

//     // Math Types
//     formulaType: Type;
//     //definationType: Type;

//     elementType: Type;
//     //escapeElementType: Type;
//     inlineTextType: Type;

//     expressionType: Type;
//     //termType: Type;
//     infixType: Type;
//     prefixType: Type;

//     // Core Types

//     figureType: Type;
//     figureItemType: Type;
//     figureCaptionType: Type;
//     listType: Type;
//     itemType: Type;
//     tableType: Type;
//     codeType: Type;

//     emphType: Type;
//     boldType: Type;
//     italicType: Type;

//     // Article Types

//     titleType: Type;
//     authorType: Type;
//     dateType: Type;
//     sectionType: Type;
//     subsectionType: Type;
//     subsubsectionType: Type;
//     tableofcontentsType: Type;
//     newpageType: Type;
//     bibliographyType: Type;
//     bibItemType: Type;

//     definitionType: Type;
//     lemmaType: Type;
//     propositionType: Type;
//     theoremType: Type;
//     proofType: Type;
//     corollaryType: Type;

//     // Generator of specific type of node
//     //nodeGeneratorTable: Map<string, (node: Node) => string>;

//     // generator of specific math node
//     latexFormula: Map<string, string>;
//     latexOperator: Map<string, string>;

//     // generator of specific setting node
//     settingGeneratorTable: Map<string, (parameter: string) => string>;

//     //unicodeSymbolsToNotations: Map<string, string>;

//     config: Config;
//     fileOperation: FileOperation;


//     constructor(typeTable: TypeTable, compiler: Compiler) {
//         super(typeTable, compiler);
//         this.config = compiler.config;
//         this.fileOperation = compiler.fileOperation;

//         this.documentType = this.typeTable.get("document");
//         this.paragraphType = this.typeTable.get("paragraph");
//         this.textType = this.typeTable.get("text");
//         this.wordsType = this.typeTable.get("words");
//         this.nameType = this.typeTable.get("name");
//         this.referenceType = this.typeTable.get("reference");
//         this.settingType = this.typeTable.get("setting");
//         this.settingParameterType = this.typeTable.get("setting-parameter");
//         this.blockType = this.typeTable.get("block");
//         this.errorType = this.typeTable.get("error");
//         this.argumentsType = this.typeTable.get("arguments");
//         this.argumentType = this.typeTable.get("argument");

//         this.formulaType = this.typeTable.get("formula");
//         this.elementType = this.typeTable.get("element");
//         //this.definationType = this.typeTable.get("defination");
//         this.inlineTextType = this.typeTable.get("inline-text");
//         this.expressionType = this.typeTable.get("expression");
//         //this.termType = this.typeTable.get("term");
//         this.infixType = this.typeTable.get("infix");
//         this.prefixType = this.typeTable.get("prefix");

//         this.figureType = this.typeTable.get("figure");
//         this.figureItemType = this.typeTable.get("figure-item");
//         this.figureCaptionType = this.typeTable.get("figure-caption");
//         this.listType = this.typeTable.get("list");
//         this.itemType = this.typeTable.get("item");
//         this.tableType = this.typeTable.get("table");
//         this.codeType = this.typeTable.get("code");
//         this.emphType = this.typeTable.get("emph");
//         this.boldType = this.typeTable.get("bold");
//         this.italicType = this.typeTable.get("italic");

//         this.titleType = this.typeTable.get("title");
//         this.authorType = this.typeTable.get("author");
//         this.dateType = this.typeTable.get("date");
//         this.sectionType = this.typeTable.get("section");
//         this.subsectionType = this.typeTable.get("subsection");
//         this.subsubsectionType = this.typeTable.get("subsubsection");
//         this.tableofcontentsType = this.typeTable.get("tableofcontents");
//         this.newpageType = this.typeTable.get("newpage");

//         this.bibliographyType = this.typeTable.get("bibliography");
//         this.bibItemType = this.typeTable.get("bib-item");

//         this.definitionType = this.typeTable.get("definition'");
//         this.lemmaType = this.typeTable.get("lemma");
//         this.propositionType = this.typeTable.get("proposition");
//         this.theoremType = this.typeTable.get("theorem");
//         this.corollaryType = this.typeTable.get("corollary");
//         this.proofType = this.typeTable.get("proof");
//         // this.fractionType = this.typeTable.get("fraction");
//         // this.sqrtType = this.typeTable.get("sqrt");
//         // this.sumType = this.typeTable.get("sum");
//         // this.limitType = this.typeTable.get("limit");
//         // this.integralType = this.typeTable.get("integral");
//         // this.scriptType = this.typeTable.get("script");
//         // this.bracketsType = this.typeTable.get("brackets");
//         // this.matrixType = this.typeTable.get("matrix");

//         // Init node generator table
//         // this.nodeGeneratorTable = new Map([
//         //     ["title", this.generateTitleAuthorDate],
//         //     ["author", this.generateTitleAuthorDate],
//         //     ["date", this.generateTitleAuthorDate],
//         //     ["section", this.generateSectionSubsection],
//         //     ["subsection", this.generateSectionSubsection],
//         // ]);

//         // Init setting generator table
//         this.settingGeneratorTable = new Map([
//             ["paper", this.generatePaperSetting]
//         ]);

//         // Init math symbols
//         this.latexFormula = new Map();
//         this.latexOperator = new Map();
//         let json: { map: [string, string], operator: [string, string] } = JSON.parse(this.config.get("latex"));
//         for (let [key, value] of json.map) {
//             this.latexFormula.set(key, value);
//         }
//         for (let [key, value] of json.operator) {
//             this.latexOperator.set(key, value);
//         }
//     }

//     // **************** Generate ****************

//     // generate

//     async generate(syntaxTree: Node, references: Reference[]) {
//         this.syntaxTree = syntaxTree;
//         this.references = references;

//         this.output = "";

//         this.output = await this.generateDocument(this.syntaxTree);
//     }

//     // GenerateDocument
//     // Syntax Tree type: document
//     // (other blocks)
//     async generateDocument(node: Node): Promise<string> {
//         let res = "";
//         let flag = false;

//         const blockGenerator: Map<Type, (n: Node) => string> = new Map([
//             [this.titleType, this.generateTitle],
//             [this.authorType, this.generateAuthor],
//             [this.dateType, this.generateDate],
//             [this.sectionType, this.generateSection],
//             [this.subsectionType, this.generateSubsection],
//             [this.subsubsectionType, this.generateSubsubsection],
//             [this.tableofcontentsType, this.generateTableofcontents],
//             [this.newpageType, this.generateNewpage]
//         ]);

//         const blockGeneratorAsync: Map<Type, (n: Node) => Promise<string>> = new Map([
//             [this.bibliographyType, this.generateBibliography],
//             [this.theoremType, this.generateTheorem],
//             [this.definitionType, this.generateDefinition],
//             [this.lemmaType, this.generateLemma],
//             [this.corollaryType, this.generateCorollary],
//             [this.propositionType, this.generateProposition],
//             [this.proofType, this.generateProof],
//         ]);

//         for (let n of node.children) {
//             if (n.type === this.settingType) {
//                 res += this.generateSetting(n);
//                 flag = false;
//             }
//             else if (n.type === this.paragraphType) {
//                 if (!flag) {
//                     flag = true;
//                 }
//                 else {
//                     //res += "\n\\hspace*{\\fill}\n\n";
//                     res += "\n";
//                 }
//                 res += await this.generateParagraph(n);
//             }
//             else if(blockGenerator.get(n.type) !== undefined) {
//                 let gen = blockGenerator.get(n.type)!;
//                 res += gen.bind(this)(n);
//                 flag = false;
//             }
//             else if(blockGeneratorAsync.get(n.type) !== undefined) {
//                 let gen = blockGeneratorAsync.get(n.type)!;
//                 res += await gen.bind(this)(n);
//                 flag = false;
//             }
//             else {
//                 console.log("Generate other block error.");
//                 flag = false;
//             }

//         }
//         return res;
//     }

//     // **************** Generate Settings ****************

//     // GenerateSetting
//     // Syntax Tree type: setting
//     generateSetting(node: Node): string {
//         let func = this.settingGeneratorTable.get(node.content);
//         if (func !== undefined) {
//             func.bind(this)(node.children[0].content);
//         }
//         else {
//             console.log("geSetting error.");
//         }
//         return "";
//     }

//     // GeneratePaperSetting
//     // Syntax Tree type: setting
//     generatePaperSetting(parameter: string): string {
//         // if (parameter === "a4") {
//         //     this.addIntrodunction(this.line(this.command("geometry", "a4paper")));
//         // }
//         // else if (parameter === "b5") {
//         //     this.addIntrodunction(this.line(this.command("geometry", "b5paper")));
//         // }
//         return "";
//     }

//     // **************** Generate Paragraph & Text ****************

//     // GenerateParagraph
//     // Syntax Tree type: paragraph
//     // (basic blocks)
//     async generateParagraph(node: Node): Promise<string> {
//         let hasArg = false;
//         let titled = false;

//         if(node.children.at(0)?.type === this.argumentsType) {
//             hasArg = true;
//             if (this.getArgument(node, "start") === "titled") {
//                 titled = true;
//             }
//         }

//         let res = "";
//         let start = 0;

//         if(hasArg) {
//             if(titled) {
//                 res += `\\paragraph{${this.generateText(node.children[1]).slice(0, -1)}}\n`;
//                 start = 2;
//             }
//             else {
//                 start = 1;
//             }
//         }

//         let flag = false;
//         for (let n of node.children.slice(start)) {
//             switch (n.type) {
//                 case this.textType:
//                     if (!flag) {
//                         flag = true;
//                     }
//                     else {
//                         //res += "\n\\hspace*{\\fill}\n\n";
//                         res += "\n";
//                     }
//                     // switch (this.getArgument(n, "start")) {
//                     //     case "indent":
//                     //         res += `\\par `;
//                     //         break;
//                     //     case "noindent":
//                     //         res += `\\par\\noindent `;
//                     //         break;
//                     //     case "auto":
//                     //     default:
//                     //         res += flag ? `\\par\\noindent ` : `\\par `;
//                     //         flag = true;
//                     //         break;
//                     // }
//                     res += this.generateText(n);
//                     break;

//                 case this.formulaType:
//                 case this.expressionType:
//                     res += this.generateFormula(n);
//                     break;
//                 case this.figureType:
//                     res += await this.generateFigure(n);
//                     break;
//                 case this.codeType:
//                     res += this.generateCode(n);
//                     break;
//                 case this.listType:
//                     res += await this.generateList(n);
//                     break;
//                 case this.tableType:
//                     res += "[[Basic Block]]\n";
//                     console.log("Unsupported basic block.");
//                     break;
//                 default:
//                     console.log("Generate basic block error.");
//                     break;
//             }
//         }
//         return res;
//     }

//     // GenerateText
//     // Syntax Tree type: text | emph | bold | italic
//     // (format blocks, insertion)
//     generateText(node: Node, format = false): string {
//         let start = 0;
//         if(node.children.at(0)?.type === this.argumentsType) {
//             start = 1;
//         }

//         let res = "";

//         for (let n of node.children.slice(start)) {
//             switch (n.type) {
//                 case this.wordsType:
//                     for (let ch of n.content) {
//                         switch (ch) {
//                             case "#": case "%": case "{": case "}": case "&": case "_": case "~":
//                                 res += "\\";
//                                 res += ch;
//                                 break;
//                             default:
//                                 res += ch;
//                         }
//                     }
//                     break;
//                 case this.referenceType:
//                     let refnode = this.references.find(value => value.name === n.content)?.node;
//                     // if(refnode?.type === this.formulaType || refnode?.type === this.expressionType) {
//                     //     res += `\\eqref{${n.content}}`;
//                     // }
//                     // else if(refnode?.type === this.bibItemType) {
//                     //     res += `\\cite{${n.content}}`;
//                     // }
//                     // else {
//                     //     res += `\\ref{${n.content}}`;
//                     // }
//                     res += "[[ref]]";
//                     break;
//                 case this.formulaType:
//                 case this.expressionType:
//                     res += this.generateFormula(n, true);
//                     break;
//                 case this.codeType:
//                     res += this.generateCode(n, true);
//                     break;
//                 case this.emphType:
//                     res += `*${this.generateText(n, true)}*`;
//                     break;
//                 case this.boldType:
//                     res += `**${this.generateText(n, true)}**`;
//                     break;
//                 case this.italicType:
//                     res += `*${this.generateText(n, true)}*`;
//                     break;
//                 default:
//                     console.log("Generate format block or insertion error.");
//                     break;
//             }
//         }
//         if (!format) {
//             res += "\n";
//         }
//         return res;
//     }

//     // **************** Core Module ****************

//     // GenerateFigure
//     // Syntax Tree type: figure
//     async generateFigure(tnode: Node): Promise<string> {
//         let refLatex = this.generateReferences(tnode);

//         let node = tnode.clone();
//         node.children = node.children.slice(1);
//         // \begin{figure}[!htbp]
//         // \centering
//         // \subcaptionbox{矩形区域}{
//         // \includegraphics[width = 0.4\linewidth]{squ_dom.eps}
//         // }
//         // \subcaptionbox{网格划分}{
//         // \includegraphics[width = 0.4\linewidth]{squ_mesh.eps}
//         // }
//         // \caption{区域和网格选取}\label{fig:squ_dom}
//         // \end{figure}
//         let text = `\\begin{figure}[!htbp]\n\\centering\n\\vspace{-0.3em}\n`;
//         //let caption: Node | undefined = undefined;

//         let size = "0.4";
//         switch (node.content) {
//             case "small":
//                 size = "0.2";
//                 break;
//             case "medium":
//                 size = "0.4";
//                 break;
//             case "large":
//                 size = "0.8";
//                 break;
//         }

//         if (node.children.length == 1) {

//         }
//         else if (node.children.length == 2) {
//             let path = node.children[1].content;
//             //if(path.split(".").at(-1) === "tikz") {
//             if (this.fileOperation.getFileExtension(path) === "tikz") {
//                 await this.fileOperation.copyFile(path, "./.lix/");
//                 let file = await this.fileOperation.readFile(path);
//                 text += file ?? "";
//                 text += "\n";
//             }
//             else {
//                 text += `\\includegraphics[width = ${size}\\linewidth]{${path}}\n`;
//                 await this.fileOperation.copyFile(path, "./.lix/");
//             }
//         }
//         else {
//             for (let n of node.children) {
//                 if (n.type === this.figureCaptionType) {
//                     continue;
//                 }
//                 text += `\\subcaptionbox{${n.children.length > 0 ? this.generateText(n.children[0], true) : ""}}{\n\\includegraphics[width = ${size}\\linewidth]{${n.content}}}\n`;
//                 await this.fileOperation.copyFile(n.content, "./.lix/");
//             }
//         }
//         let caption = node.children[0];
//         text += `\\vspace{-0.3em}\n\\caption{${caption ? this.generateText(caption) : "[[nocaption]]"}}${refLatex}\\vspace{-0.7em}\n\\end{figure}\n`;

//         return text;
//     }

//     // GenerateCode
//     // Syntax Tree type: code
//     generateCode(node: Node, inline = false): string {
//         if (inline) {
//             return `\`${node.content}\``;
//         }
//         else {
//             return `\`\`\`\n${node.content}\n\`\`\`\n`
//         }

//     }

//     // GenerateList
//     // Syntax Tree type: list
//     async generateList(node: Node): Promise<string> {
//         let res = "";

//         let numbered = false;
//         if(this.getArgument(node, "style") === "numbered") {
//             numbered = true;
//         }

//         res += numbered ? "\\begin{enumerate}\n" : "\\begin{itemize}\n";
//         for (let n of node.children) {
//             switch (n.type) {
//                 case this.itemType:
//                     res += this.generateItem(n);
//                     break;
//                 case this.textType:
//                     switch (this.getArgument(n, "start")) {
//                         case "indent":
//                             res += `\\par `;
//                             break;
//                         case "noindent":
//                         case "auto":
//                         default:
//                             res += `\\par\\noindent `;
//                             break;
//                     }
//                     res += this.generateText(n);
//                     break;

//                 case this.formulaType:
//                 case this.expressionType:
//                     res += this.generateFormula(n);
//                     break;
//                 case this.figureType:
//                     res += await this.generateFigure(n);
//                     break;
//                 case this.codeType:
//                     res += this.generateCode(n);
//                     break;
//                 case this.listType:
//                     res += await this.generateList(n);
//                     break;
//                 case this.tableType:
//                     res += "[[Basic Block]]\n";
//                     console.log("Unsupported basic block in list.");
//                     break;
//             }
//         }
//         res += numbered ? "\\end{enumerate}\n" : "\\end{itemize}\n";
//         return res;
//     }

//     // GenerateItem
//     // Syntax Tree type: item
//     generateItem(node: Node): string {
//         let refLatex = this.generateReferences(node);
//         if(node.children.length === 1) {
//             return `\\item${refLatex} `;
//         }
//         return `\\item[${this.generateText(node)}]${refLatex} `;
//     }

//     // **************** Math Module ****************

//     // GenerateFormula
//     // Syntax Tree type: formula
//     generateFormula(node: Node, inline: boolean = false): string {
//         let refLatex = this.generateReferences(node);
//         let numbered = "*";
//         let multiline = false;
//         if(this.getArgument(node, "style") === "numbered") {
//             numbered = "";
//         }
//         if(this.getArgument(node, "line") === "multi") {
//             multiline = true;
//         }

//         let res = inline ? "$" : `$$\n`;

//         if (!inline && multiline) {
//             let tmp = this.generateMultilineFormula(node.children.at(-1)!);
//             res += tmp;
//         }
//         else {
//             let tmp = this.generateTermOrOperator(node.children.at(-1)!);
//             // if(tmp.startsWith("{") && tmp.endsWith("}")) {
//             //     tmp=tmp.slice(1,-1);
//             // }
//             res += tmp;
//         }

//         res += inline ? "$" : `\n$$\n`;

//         return res;
//     }


//     // 要保证为 Latex 中一项
//     generateTermOrOperator(node: Node): string {
//         let res = "";
//         let code: string | undefined;
//         let isAlphabet = (char: string) => {
//             const reg = /[a-zA-Z]/;
//             return reg.exec(char) != null;
//         }

//         switch (node.type) {
//             // Terms, 生成的 Latex 保证为 Latex 中的一项
//             case this.inlineTextType:
//                 res += `\\text{${node.content}}`;
//                 break;

//             case this.elementType:
//                 let sym = this.latexFormula.get(node.content);
//                 res += sym ?? `\\text{[[${node.content}]]}`;
//                 //res += " ";
//                 break;

//             // Terms, 生成的 Latex 保证为 Latex 中的一项或多项
//             case this.prefixType:
//                 let cases = false;
//                 if (node.content === "cases") {
//                     cases = true;
//                 }
//                 if (node.content === "mat" || cases) {
//                     if (cases) {
//                         res += `\\left\\{`
//                     }
//                     res += `\\begin{matrix}\n`;
//                     let brow = false;
//                     for (let row of node.children) {
//                         if (brow) {
//                             res += `\\\\`;
//                         }
//                         brow = true;

//                         let bcol = false;
//                         for (let col of row.children) {
//                             let ncode = this.generateTermOrOperator(col);
//                             if (bcol) {
//                                 res += `&`;
//                             }
//                             bcol = true;
//                             res += ncode;
//                         }
//                     }
//                     res += `\n\\end{matrix}`;
//                     if (cases) {
//                         res += `\\right.`
//                     }
//                     break;
//                 }
//                 code = this.latexOperator.get(node.content);
//                 if (code !== undefined) {
//                     for (let i = 0; i < node.children.length; i++) {
//                         let ncode = this.generateTermOrOperator(node.children[i]);
//                         let flag = `\${${i}}`;

//                         let pos = code.indexOf(flag);
//                         if (pos >= 1 && pos < code.length && isAlphabet(code.at(pos - 1)!) && ncode.length >= 1 && isAlphabet(ncode.at(0)!)) {
//                             ncode = " " + ncode;
//                         }
//                         if (pos >= 0 && pos + flag.length < code.length && isAlphabet(code.at(pos + flag.length)!) && ncode.length >= 1 && isAlphabet(ncode.at(-1)!)) {
//                             ncode = ncode + " ";
//                         }

//                         code = code.replace(flag, ncode);
//                     }
//                     res += code;
//                 }
//                 else {
//                     res += `\\text{[[Prefix Error]]}`;
//                 }
//                 // switch (node.content) {
//                 //     case "lim":
//                 //         res += `{\\lim_${this.generateTermOrOperator(node.children[0])}${this.generateTermOrOperator(node.children[1])}}`;
//                 //         break;
//                 //     case "⋃":
//                 //         res += `{\\bigcup_${this.generateTermOrOperator(node.children[0])}^${this.generateTermOrOperator(node.children[1])}${this.generateTermOrOperator(node.children[2])}}`;
//                 //         break;
//                 //     case "⋂":
//                 //         res += `{\\bigcap_${this.generateTermOrOperator(node.children[0])}^${this.generateTermOrOperator(node.children[1])}${this.generateTermOrOperator(node.children[2])}}`;
//                 //         break;
//                 //     case "∑":
//                 //         res += `{\\sum_${this.generateTermOrOperator(node.children[0])}^${this.generateTermOrOperator(node.children[1])}${this.generateTermOrOperator(node.children[2])}}`;
//                 //         break;
//                 //     case "dot":
//                 //         res += `{\\dot{${this.generateTermOrOperator(node.children[0])}}}`;
//                 //         break;
//                 //     case "hat":
//                 //         res += `{\\hat{${this.generateTermOrOperator(node.children[0])}}}`;
//                 //         break;
//                 //     case "vec":
//                 //         res += `{\\vec{${this.generateTermOrOperator(node.children[0])}}}`;
//                 //         break;
//                 //     case "√":
//                 //         res += `{\\sqrt ${this.generateTermOrOperator(node.children[0])}}`;
//                 //         break;
//                 //     case "cases":
//                 //         res += `{${this.generateTermOrOperator(node.children[0])}}`;
//                 //         break;
//                 //     case "norm":
//                 //         res += `{\\Vert ${this.generateTermOrOperator(node.children[0])} \\Vert}`;
//                 //         break;
//                 //     case "tilde":
//                 //         res += `{\\widetilde{${this.generateTermOrOperator(node.children[0])}}}`;
//                 //         break;
//                 //     case "mat":
//                 //         res += `{${this.generateTermOrOperator(node.children[0])}}`;
//                 //         break;
//                 //     case "(":
//                 //         res += `{\\left(${this.generateTermOrOperator(node.children[0])}\\right)}`;
//                 //         break;
//                 //     case "{":
//                 //         res += `{\\left\\{${this.generateTermOrOperator(node.children[0])}\\right\\}}`;
//                 //         break;
//                 //     case "⟨":
//                 //         res += `{\\left\\langle${this.generateTermOrOperator(node.children[0])}\\right\\rangle}`;
//                 //         break;
//                 // }
//                 break;

//             case this.infixType:
//                 code = this.latexOperator.get(node.content);

//                 if (code !== undefined) {
//                     if (code === "${default}") {
//                         let blank = false;
//                         if (node.content === "") {
//                             blank = true;
//                         }
//                         let lastIsAlphabet = false;

//                         let i = 0;
//                         //res += "{";
//                         for (let sub of node.children) {
//                             let ncode = this.generateTermOrOperator(sub);


//                             if (blank && lastIsAlphabet && ncode.length >= 1 && isAlphabet(ncode[0])) {
//                                 res += " ";
//                             }
//                             if (blank && ncode.length >= 1 && isAlphabet(ncode.at(-1)!)) {
//                                 lastIsAlphabet = true;
//                             }
//                             else {
//                                 lastIsAlphabet = false;
//                             }

//                             res += `${ncode}`;
//                             res += (i < node.content.length) ? node.content[i] : "";
//                             i++;
//                         }
//                         //res += "}";
//                     }
//                     else {
//                         for (let i = 0; i < node.children.length; i++) {
//                             let ncode = this.generateTermOrOperator(node.children[i]);
//                             let flag = `\${${i}}`;

//                             let pos = code.indexOf(flag);
//                             if (pos >= 1 && pos < code.length && isAlphabet(code.at(pos - 1)!) && ncode.length >= 1 && isAlphabet(ncode.at(0)!)) {
//                                 ncode = " " + ncode;
//                             }
//                             if (pos >= 0 && pos + flag.length < code.length && isAlphabet(code.at(pos + flag.length)!) && ncode.length >= 1 && isAlphabet(ncode.at(-1)!)) {
//                                 ncode = ncode + " ";
//                             }

//                             code = code.replace(flag, ncode);
//                         }
//                         res += code;
//                     }
//                 }
//                 else {
//                     res += `\\text{[[Infix Error]]}`;
//                 }
//                 // switch (node.content) {
//                 //     case "⁄":
//                 //         res += `{\\frac${this.generateTermOrOperator(node.children[0])}${this.generateTermOrOperator(node.children[1])}}`;
//                 //         break;
//                 //     default:
//                 //         let i = 0;
//                 //         res += "{";
//                 //         for (let sub of node.children) {
//                 //             res += `${this.generateTermOrOperator(sub)}`;
//                 //             res += (i < node.content.length) ? node.content[i] : "";
//                 //             i++;
//                 //         }
//                 //         res += "}";
//                 //         break;

//                 // }
//                 break;

//         }

//         return res;
//     }

//     generateMultilineFormula(node: Node): string {
//         let res = "";
//         switch (node.type) {
//             case this.prefixType:
//                 if (node.content === "mat") {
//                     res += `\\begin{aligned}`;
//                     let brow = false;
//                     for (let row of node.children) {
//                         if (brow) {
//                             res += `\\\\`;
//                         }
//                         brow = true;

//                         let bcol = false;
//                         for (let col of row.children) {
//                             let ncode = this.generateTermOrOperator(col);
//                             if (bcol) {
//                                 res += `&`;
//                             }
//                             bcol = true;
//                             res += ncode;
//                         }
//                     }
//                     res += `\\end{aligned}`;
//                 }
//                 return res;
//         }
//         res = this.generateTermOrOperator(node.children.at(-1)!);
//         // if (res.startsWith("{") && res.endsWith("}")) {
//         //     res = res.slice(1, -1);
//         // }
//         return res;
//     }

//     // **************** Article Moudle ****************

//     // GenerateTitle
//     // Syntax Tree type: title
//     generateTitle(node: Node): string {
//         return `\n# ${this.generateText(node, true)}\n\n`;
//     }

//     // GenerateAuthor
//     // Syntax Tree type: author
//     generateAuthor(node: Node): string {
//         return `Author: ${this.generateText(node, true)}\n\n`;
//     }

//     // GenerateDate
//     // Syntax Tree type: date
//     generateDate(node: Node): string {
//         return `Date: ${this.generateText(node, true)}\n\n`;
//     }

//     // GenerateSection
//     // Syntax Tree type: section
//     generateSection(node: Node): string {
//         let refLatex = this.generateReferences(node);
//         let numbered = "*";
//         if(this.getArgument(node, "style") === "numbered") {
//             numbered = "";
//         }
//         return `\n## ${this.generateText(node, true)}\n\n`;
//     }

//     // GenerateSubsection
//     // Syntax Tree type: subsection
//     generateSubsection(node: Node): string {
//         let refLatex = this.generateReferences(node);
//         let numbered = "*";
//         if(this.getArgument(node, "style") === "numbered") {
//             numbered = "";
//         }
//         return `\n### ${this.generateText(node, true)}\n\n`;
//     }

//     // GenerateSubsubection
//     // Syntax Tree type: subsubsection
//     generateSubsubsection(node: Node): string {
//         let refLatex = this.generateReferences(node);
//         let numbered = "*";
//         if(this.getArgument(node, "style") === "numbered") {
//             numbered = "";
//         }
//         return `\n#### ${this.generateText(node, true)}\n\n`;
//     }

//     // GenerateTableofcontents
//     // Syntax Tree type: tableofcontents
//     generateTableofcontents(node: Node): string {
//         return ``;
//     }

//     // GenerateNewpage
//     // Syntax Tree type: newpage
//     generateNewpage(node: Node): string {
//         return ``;
//     }


//     // GenerateBibliography
//     // Syntax Tree type: bibliography
//     async generateBibliography(node: Node): Promise<string> {
//         let res = "";

//         res += `## References\n`;
//         for (let n of node.children) {
//             switch (n.type) {
//                 case this.bibItemType:
//                     res += this.generateBibItem(n);
//                     break;
//                 case this.textType:
//                     switch (this.getArgument(n, "start")) {
//                         case "indent":
//                             res += `\\par `;
//                             break;
//                         case "noindent":
//                         case "auto":
//                         default:
//                             res += `\\par\\noindent `;
//                             break;
//                     }
//                     res += this.generateText(n);
//                     break;
//                 default:
//                     console.log("Unsupported basic block in bibliography.");
//                     break;
//             }
//         }
//         res += `\n\n`;
//         return res;
//     }

//     // GenerateBibItem
//     // Syntax Tree type: bib-item
//     generateBibItem(node: Node): string {
//         let refLatex = "";
//         refLatex += this.getReferences(node).at(0) ?? "";
//         return `\\bibitem{${refLatex}} `;
//     }

//     // GenerateTheorem
//     // Syntax Tree type: theorem
//     async generateTheorem(node: Node): Promise<string> {
//         let refLatex = this.generateReferences(node);

//         return `\\begin{theorem}${refLatex}${await this.generateParagraph(node)}\\end{theorem}\n`;
//     }

//     // GenerateDefinition
//     // Syntax Tree type: definition
//     async generateDefinition(node: Node): Promise<string> {
//         let refLatex = this.generateReferences(node);

//         return `\\begin{definition}${refLatex}${await this.generateParagraph(node)}\\end{definition}\n`;
//     }

//     // GenerateLemma
//     // Syntax Tree type: lemma
//     async generateLemma(node: Node): Promise<string> {
//         let refLatex = this.generateReferences(node);

//         return `\\begin{lemma}${refLatex}${await this.generateParagraph(node)}\\end{lemma}\n`;
//     }

//     // GenerateCorollary
//     // Syntax Tree type: corollary
//     async generateCorollary(node: Node): Promise<string> {
//         let refLatex = this.generateReferences(node);

//         return `\\begin{corollary}${refLatex}${await this.generateParagraph(node)}\\end{corollary}\n`;
//     }

//     // GenerateProposition
//     // Syntax Tree type: proposition
//     async generateProposition(node: Node): Promise<string> {
//         let refLatex = this.generateReferences(node);

//         return `\\begin{proposition}${refLatex}${await this.generateParagraph(node)}\\end{proposition}\n`;
//     }

//     // GenerateProof
//     // Syntax Tree type: proof
//     async generateProof(node: Node): Promise<string> {
//         let refLatex = this.generateReferences(node);

//         return `\\begin{proof}${refLatex}${await this.generateParagraph(node)}\\end{proof}\n`;
//     }

//     // **************** Assistant Function ****************

//     getArgument(node: Node, name: string): string {
//         if(node.children.length === 0) {
//             return "";
//         }
//         let args = node.children[0];

//         let found: string | undefined;
//         args.children.forEach(argNode => {
//             if(argNode.type === this.argumentType && argNode.content === name) {
//                 found = argNode.children[0].content;
//             }
//         });

//         return found ?? "";
//     }

//     getReferences(node: Node): string[] {
//         if(node.children.length === 0) {
//             return [];
//         }
//         let args = node.children[0];

//         let refs: string[] = [];
//         args.children.forEach(argNode => {
//             if(argNode.type === this.referenceType) {
//                 refs.push(argNode.content);
//             }
//         });

//         return refs;
//     }

//     generateReferences(node: Node): string {
//         let refLatex = "";
//         this.getReferences(node).forEach(ref => {
//             refLatex += `\\label{${ref}}`;
//         })
//         return refLatex;
//     }

//     // **************** Latex Commands ****************
//     // introduction and document of latex source

//     line(text: string) {
//         return text + "\n";
//     }
// }

export class MarkdownGenerator extends Generator {

    references: Reference[];

    // **************** Types ****************

    // Math Module

    mathGenerator: Generator;
    formulaType: Type;

    // Core Module

    coreModule: boolean;

    figureType: Type;
    imageType: Type;
    codeType: Type;
    listType: Type;
    itemType: Type;
    tableType: Type;
    cellType: Type;
    captionType: Type;

    emphType: Type;
    boldType: Type;
    italicType: Type;

    // Article Module

    articleModule: boolean;

    titleType: Type;
    authorType: Type;
    dateType: Type;
    sectionType: Type;
    subsectionType: Type;
    subsubsectionType: Type;
    tableofcontentsType: Type;
    newpageType: Type;

    bibliographyType: Type;
    bibItemType: Type;

    definitionType: Type;
    lemmaType: Type;
    propositionType: Type;
    theoremType: Type;
    proofType: Type;
    corollaryType: Type;

    // **************** Latex ****************

    // generator of settings
    settingGeneratorTable: Map<string, (parameter: string) => string>;

    // generator of blocks and insertions
    structuralBlockGeneratorTable: Map<Type, (node: Node) => string | Promise<string>>;
    basicBlockGeneratorTable: Map<Type, (node: Node) => string | Promise<string>>;
    formatBlockGeneratorTable: Map<Type, (node: Node) => string | Promise<string>>;
    subBlockGeneratorTable: Map<Type, (node: Node) => string | Promise<string>>;
    InsertionGeneratorTable: Map<Type, (node: Node) => string | Promise<string>>;

    // markdown template
    json: {
        ParagraphTitled: string,
        BetweenParagraphs: string,
        BetweenStructuralBlocks: string,

        TextIndent: string,
        TextNoindent: string,
        BetweenTexts: string,
        BetweenBasicBlocks: string,

        EquationReference: string,
        BibliographyReference: string,
        DefaultReference: string,

        InlineFormula: string,
        NumberedFormula: string,
        UnnumberedFormula: string,
        MultilineFormula: string,

        Figure: string,
        Image: string,
        Caption: string,
        BetweenImagesAndCaption: string,

        InlineCode: string,
        DefaultCode: string,
        NumberedList: string,
        UnnumberedList: string,
        Item: string,
        BetweenItems: string,
        Table: string,
        TableRowSeparator: string,
        TableColumnSeparator: string,
        Cell: string,
        Emph: string,
        Bold: string,
        Italic: string,

        Title: string,
        Author: string,
        Date: string,
        Section: string,
        Subsection: string,
        Subsubsection: string,
        UnnumberedSection: string,
        UnnumberedSubsection: string,
        UnnumberedSubsubsection: string,
        Tableofcontents: string,
        Newpage: string,

        Bibliography: string,
        BibItem: string,
        BetweenBibItems: string,

        Theorem: string,
        Definition: string,
        Lemma: string,
        Corollary: string,
        Proposition: string,
        Proof: string,
    }

    constructor(compiler: Compiler, mathGenerator: Generator, template: string) {
        super(compiler);
        this.mathGenerator = mathGenerator;

        this.references = [];
        this.json = JSON.parse(this.config.get(template));

        // **************** Types ****************

        this.coreModule = true;
        this.articleModule = true;

        // math
        this.formulaType = this.typeTable.get("formula");

        // core
        this.figureType = this.typeTable.get("figure");
        this.imageType = this.typeTable.get("image");
        this.codeType = this.typeTable.get("code");
        this.listType = this.typeTable.get("list");
        this.itemType = this.typeTable.get("item");
        this.tableType = this.typeTable.get("table");
        this.cellType = this.typeTable.get("cell");
        this.captionType = this.typeTable.get("caption");
        this.emphType = this.typeTable.get("emph");
        this.boldType = this.typeTable.get("bold");
        this.italicType = this.typeTable.get("italic");

        // article
        this.titleType = this.typeTable.get("title");
        this.authorType = this.typeTable.get("author");
        this.dateType = this.typeTable.get("date");
        this.sectionType = this.typeTable.get("section");
        this.subsectionType = this.typeTable.get("subsection");
        this.subsubsectionType = this.typeTable.get("subsubsection");
        this.tableofcontentsType = this.typeTable.get("tableofcontents");
        this.newpageType = this.typeTable.get("newpage");
        this.bibliographyType = this.typeTable.get("bibliography");
        this.bibItemType = this.typeTable.get("bib-item");
        this.definitionType = this.typeTable.get("definition'");
        this.lemmaType = this.typeTable.get("lemma");
        this.propositionType = this.typeTable.get("proposition");
        this.theoremType = this.typeTable.get("theorem");
        this.corollaryType = this.typeTable.get("corollary");
        this.proofType = this.typeTable.get("proof");

        this.settingGeneratorTable = new Map([
        ]);

        this.structuralBlockGeneratorTable = new Map([
            // article
            [this.titleType, this.generateTitle],
            [this.authorType, this.generateAuthor],
            [this.dateType, this.generateDate],
            [this.sectionType, this.generateSection],
            [this.subsectionType, this.generateSubsection],
            [this.subsubsectionType, this.generateSubsubsection],
            [this.tableofcontentsType, this.generateTableofcontents],
            [this.newpageType, this.generateNewpage],
            [this.bibliographyType, this.generateBibliography],
            [this.theoremType, this.generateTheorem],
            [this.definitionType, this.generateDefinition],
            [this.lemmaType, this.generateLemma],
            [this.corollaryType, this.generateCorollary],
            [this.propositionType, this.generateProposition],
            [this.proofType, this.generateProof],
        ]);

        this.basicBlockGeneratorTable = new Map([
            // math
            [this.formulaType, this.generateFormula.bind(this, false)],
            // core
            [this.figureType, this.generateFigure],
            [this.codeType, this.generateCode.bind(this, false)],
            [this.listType, this.generateList],
            [this.tableType, this.generateTable],
        ]);

        this.formatBlockGeneratorTable = new Map([
            // core
            [this.emphType, this.generateEmph],
            [this.boldType, this.generateBold],
            [this.italicType, this.generateItalic]
        ]);

        this.subBlockGeneratorTable = new Map([
            // core
            [this.imageType, this.generateImage.bind(this, false)],
            [this.itemType, this.generateItem],
            [this.cellType, this.generateCell],
            [this.captionType, this.generateCaption],
            // article
            [this.bibItemType, this.generateBibItem]
        ]);

        this.InsertionGeneratorTable = new Map([
            [this.referenceType, this.generateReference],
            // math
            [this.formulaType, this.generateFormula.bind(this, true)],
            // core
            [this.codeType, this.generateCode.bind(this, true)],
        ]);
    }

    init(): void {
        this.output = "";
        this.references = [];
    }

    // **************** Generate ****************
    // 下面的 generate 类函数行尾没有换行

    // Generate
    generate(syntaxTree: Node, references: Reference[]) {
        this.init();
        this.references = references;

        this.output = this.generateDocument(syntaxTree);
    }

    // GenerateDocument
    // Syntax Tree type: document
    // (structural blocks)
    generateDocument(node: Node): string {
        let res = "";

        let count = 0;
        let preIsPar = false;
        for (let n of node.children) {
            count++;
            if (n.type === this.settingType) {
                if (count > 1) {
                    res += this.json.BetweenStructuralBlocks;
                }
                res += this.generateSetting(n);
                preIsPar = false;
            }
            else if (n.type === this.paragraphType) {
                if (count > 1) {
                    res += preIsPar ? this.json.BetweenParagraphs : this.json.BetweenStructuralBlocks;
                }
                preIsPar = true;
                res += this.generateParagraph(n);
            }
            else if (this.structuralBlockGeneratorTable.has(n.type)) {
                if (count > 1) {
                    res += this.json.BetweenStructuralBlocks;
                }
                res += this.structuralBlockGeneratorTable.get(n.type)!.bind(this)(n);
                preIsPar = false;
            }
            else {
                console.log("Generate document error.");
                preIsPar = false;
            }
        }
        return res;
    }

    // **************** Generate Settings ****************

    // GenerateSetting
    // Syntax Tree type: setting
    generateSetting(node: Node): string {
        let func = this.settingGeneratorTable.get(node.content);
        if (func !== undefined) {
            func.bind(this)(node.children[0].content);
        }
        else {
            console.log("Generate setting error.");
        }
        return "";
    }

    // **************** Generate Paragraph & Text ****************

    // GenerateParagraph
    // Syntax Tree type: paragraph
    // (basic blocks)
    generateParagraph(node: Node): string {
        let res = "";

        let count = 0;
        let preIsText = false;
        for (let n of this.removeArguments(node)) {
            count++;
            if (n.type === this.textType) {
                if (count > 1) {
                    res += preIsText ? this.json.BetweenTexts : this.json.BetweenBasicBlocks;
                }
                preIsText = true;

                if (this.getArgument(node, "start") === "titled" && count === 1) {
                    res += this.json.ParagraphTitled.format(this.generateTextLike(n));
                }
                else {
                    res += this.generateText(n, count);
                }
            }
            else if (this.basicBlockGeneratorTable.has(n.type)) {
                if (count > 1) {
                    res += this.json.BetweenBasicBlocks;
                }
                res += this.basicBlockGeneratorTable.get(n.type)!.bind(this)(n);
                preIsText = false;
            }
            else {
                console.log("Generate paragraph error.");
                preIsText = false;
            }
        }
        return res;
    }

    // GenerateParagraphLike
    // Syntax Tree type: paragraph-like
    generateParagraphLike(node: Node): string {
        let res = "";

        let count = 0;
        let preIsText = false;
        for (let n of this.removeArguments(node)) {
            count++;
            if (n.type === this.textType) {
                if (count > 1) {
                    res += preIsText ? this.json.BetweenTexts : this.json.BetweenBasicBlocks;
                }
                preIsText = true;
                res += this.generateText(n, count);
            }
            else if (this.basicBlockGeneratorTable.has(n.type)) {
                if (count > 1) {
                    res += this.json.BetweenBasicBlocks;
                }
                res += this.basicBlockGeneratorTable.get(n.type)!.bind(this)(n);
                preIsText = false;
            }
            else {
                console.log("Generate paragraph like error.");
                preIsText = false;
            }
        }
        return res;
    }

    // GenerateText
    // Syntax Tree type: text
    // (format blocks, insertions)
    generateText(node: Node, count: number): string {
        let res = "";

        for (let n of this.removeArguments(node)) {
            if (n.type === this.wordsType) {
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
            }
            else if (this.formatBlockGeneratorTable.has(n.type)) {
                res += this.formatBlockGeneratorTable.get(n.type)!.bind(this)(n);
            }
            else if (this.InsertionGeneratorTable.has(n.type)) {
                res += this.InsertionGeneratorTable.get(n.type)!.bind(this)(n);
            }
            else {
                console.log("Generate text error.");
            }
        }
        switch (this.getArgument(node, "start")) {
            case "indent":
                return this.json.TextIndent.formatWithAutoBlank(res);
            case "noindent":
                return this.json.TextNoindent.formatWithAutoBlank(res);
            case "auto":
            default:
                return (count <= 1) ? this.json.TextIndent.formatWithAutoBlank(res) : this.json.TextNoindent.formatWithAutoBlank(res);
        }
        return res;
    }

    // GenerateTextLike
    // Syntax Tree type: text-like
    generateTextLike(node: Node): string {
        let res = "";

        for (let n of this.removeArguments(node)) {
            if (n.type === this.wordsType) {
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
            }
            else if (this.formatBlockGeneratorTable.has(n.type)) {
                res += this.formatBlockGeneratorTable.get(n.type)!.bind(this)(n);
            }
            else if (this.InsertionGeneratorTable.has(n.type)) {
                res += this.InsertionGeneratorTable.get(n.type)!.bind(this)(n);
            }
            else {
                console.log("Generate text like error.");
            }
        }
        return res;
    }

    // GenerateFormatLike
    // Syntax Tree type: format-like
    generateFormatLike(node: Node): string {
        let res = "";

        for (let n of this.removeArguments(node)) {
            if (n.type === this.wordsType) {
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
            }
            else if (this.InsertionGeneratorTable.has(n.type)) {
                res += this.InsertionGeneratorTable.get(n.type)!.bind(this)(n);
            }
            else {
                console.log("Generate format like block error.");
            }
        }
        return res;
    }

    // GenerateReference
    // Syntax Tree type: reference
    generateReference(node: Node): string {
        let refnode = this.references.find(value => value.name === node.content)?.node;
        if (refnode?.type === this.formulaType) {
            return this.json.EquationReference.format(node.content);
        }
        else if (refnode?.type === this.bibItemType) {
            return this.json.BibliographyReference.format(node.content);
        }
        else {
            return this.json.DefaultReference.format(node.content);
        }
    }

    // **************** Core Module ****************

    // GenerateFigure
    // Syntax Tree type: figure
    generateFigure(node: Node): string {
        let refLatex = this.generateMarkdownReferences(node);

        let imageCount = 0;
        let caption: Node | undefined;
        for (let n of node.children) {
            if (n.type === this.imageType) {
                imageCount++;
            }
            else if (n.type === this.captionType) {
                caption = n;
            }
        }

        let res = "";
        for (let n of node.children) {
            if (n.type === this.imageType) {
                res += this.generateImage(false, n);
            }
        }

        return this.json.Figure.format({ content: res, caption: caption === undefined ? "" : this.generateCaption(caption), reference: refLatex });
    }

    // GenerateImage
    // Syntax Tree type: image
    generateImage(single: boolean, node: Node): string {
        let path = this.getArgument(node, "path")!;
        let content = path;
        this.fileSystem.copyByRecord(this.fileSystem.pathToUri(path), this.fileSystem.cacheDirectoryUri);

        if (single) {
            return this.json.Image.format({ size: this.getArgument(node, "size")!, path: content });
        }
        return this.json.Image.format({ caption: this.generateFormatLike(node), size: this.getArgument(node, "size")!, path: content });
    }

    // GenerateCode
    // Syntax Tree type: code
    generateCode(inline: boolean, node: Node): string {
        if (inline) {
            return this.json.InlineCode.format(node.content);
        }
        else {
            return this.json.DefaultCode.format(node.content);
        }
    }

    // GenerateList
    // Syntax Tree type: list
    generateList(node: Node): string {
        let res = "";

        let count = 0;
        for (let n of this.removeArguments(node)) {
            count++;
            if (count > 1) {
                res += this.json.BetweenItems;
            }
            res += this.generateItem(n);
        }

        if (this.getArgument(node, "style") === "numbered") {
            return this.json.NumberedList.format(res);
        }
        return this.json.UnnumberedList.format(res);
    }

    // GenerateItem
    // Syntax Tree type: item
    generateItem(node: Node): string {
        return this.json.Item.format({ reference: this.generateMarkdownReferences(node), content: this.generateParagraphLike(node) });
    }

    // GenerateTable
    // Syntax Tree type: table
    generateTable(node: Node): string {
        let res = "";

        let rowCount = 0;
        let columnCount = 0;
        for (let rowNode of this.removeArguments(node)) {
            rowCount++;
            if (rowCount > 1) {
                res += this.json.TableRowSeparator;
            }

            columnCount = 0;
            for (let columnNode of rowNode.children) {
                columnCount++;
                if (columnCount > 1) {
                    res += this.json.TableColumnSeparator;
                }
                res += this.generateCell(columnNode);
            }

        }

        return this.json.Table.format({ args: "c".repeat(columnCount), content: res, caption: "", reference: "" });
    }

    // GenerateCell
    // Syntax Tree type: cell
    generateCell(node: Node): string {
        return this.json.Cell.format(this.generateParagraphLike(node));
    }

    // GenerateCaption
    // Syntax Tree type: caption
    generateCaption(node: Node): string {
        return this.json.Caption.format(this.generateFormatLike(node));
    }

    // GenerateEmph
    // Syntax Tree type: emph
    generateEmph(node: Node): string {
        return this.json.Emph.format(this.generateFormatLike(node));
    }

    // GenerateBold
    // Syntax Tree type: bold
    generateBold(node: Node): string {
        return this.json.Bold.format(this.generateFormatLike(node));
    }

    // GenerateItalic
    // Syntax Tree type: italic
    generateItalic(node: Node): string {
        return this.json.Italic.format(this.generateFormatLike(node));
    }

    // **************** Math Module ****************

    // GenerateFormula
    // Syntax Tree type: formula
    generateFormula(inline: boolean, node: Node): string {
        let refLatex = this.generateMarkdownReferences(node);
        this.mathGenerator.generate(node, this.references);
        let formula = this.mathGenerator.output;

        if (inline) {
            return this.json.InlineFormula.format(formula);
        }

        if (this.getArgument(node, "line") === "multi") {
            formula = this.json.MultilineFormula.format({ content: formula });
        }
        if (this.getArgument(node, "style") === "numbered") {
            return this.json.NumberedFormula.format({ reference: refLatex, content: formula })
        }
        else {
            return this.json.UnnumberedFormula.format({ reference: refLatex, content: formula })
        }

    }

    // **************** Article Module ****************

    // GenerateTitle
    // Syntax Tree type: title
    generateTitle(node: Node): string {
        return this.json.Title.format(this.generateFormatLike(node));
    }

    // GenerateAuthor
    // Syntax Tree type: author
    generateAuthor(node: Node): string {
        return this.json.Author.format(this.generateFormatLike(node));
    }

    // GenerateDate
    // Syntax Tree type: date
    generateDate(node: Node): string {
        return this.json.Date.format(this.generateFormatLike(node));
    }

    // GenerateSection
    // Syntax Tree type: section
    generateSection(node: Node): string {
        let refLatex = this.generateMarkdownReferences(node);
        if (this.getArgument(node, "style") === "numbered") {
            return this.json.Section.format({ content: this.generateFormatLike(node), reference: refLatex });
        }
        else {
            return this.json.UnnumberedSection.format({ content: this.generateFormatLike(node), reference: refLatex });
        }
    }

    // GenerateSubsection
    // Syntax Tree type: subsection
    generateSubsection(node: Node): string {
        let refLatex = this.generateMarkdownReferences(node);
        if (this.getArgument(node, "style") === "numbered") {
            return this.json.Subsection.format({ content: this.generateFormatLike(node), reference: refLatex });
        }
        else {
            return this.json.UnnumberedSubsection.format({ content: this.generateFormatLike(node), reference: refLatex });
        }
    }

    // GenerateSubsubection
    // Syntax Tree type: subsubsection
    generateSubsubsection(node: Node): string {
        let refLatex = this.generateMarkdownReferences(node);
        if (this.getArgument(node, "style") === "numbered") {
            return this.json.Subsubsection.format({ content: this.generateFormatLike(node), reference: refLatex });
        }
        else {
            return this.json.UnnumberedSubsubsection.format({ content: this.generateFormatLike(node), reference: refLatex });
        }
    }

    // GenerateTableofcontents
    // Syntax Tree type: tableofcontents
    generateTableofcontents(node: Node): string {
        return this.json.Tableofcontents;
    }

    // GenerateNewpage
    // Syntax Tree type: newpage
    generateNewpage(node: Node): string {
        return this.json.Newpage;
    }


    // GenerateBibliography
    // Syntax Tree type: bibliography
    generateBibliography(node: Node): string {
        let res = "";

        let count = 0;
        for (let n of this.removeArguments(node)) {
            count++;
            if (count > 1) {
                res += this.json.BetweenBibItems;
            }
            res += this.generateBibItem(n);
        }
        return this.json.Bibliography.format(res);
    }

    // GenerateBibItem
    // Syntax Tree type: bib-item
    generateBibItem(node: Node): string {
        let refLatex = this.getReferences(node).at(0) ?? "";
        return this.json.BibItem.format({ reference: refLatex, content: this.generateFormatLike(node) })
    }

    // GenerateTheorem
    // Syntax Tree type: theorem
    generateTheorem(node: Node): string {
        return this.json.Theorem.format({ reference: this.generateMarkdownReferences(node), content: this.generateParagraphLike(node) })
    }

    // GenerateDefinition
    // Syntax Tree type: definition
    generateDefinition(node: Node): string {
        return this.json.Definition.format({ reference: this.generateMarkdownReferences(node), content: this.generateParagraphLike(node) })
    }

    // GenerateLemma
    // Syntax Tree type: lemma
    generateLemma(node: Node): string {
        return this.json.Lemma.format({ reference: this.generateMarkdownReferences(node), content: this.generateParagraphLike(node) })
    }

    // GenerateCorollary
    // Syntax Tree type: corollary
    generateCorollary(node: Node): string {
        return this.json.Corollary.format({ reference: this.generateMarkdownReferences(node), content: this.generateParagraphLike(node) })
    }

    // GenerateProposition
    // Syntax Tree type: proposition
    generateProposition(node: Node): string {
        return this.json.Proposition.format({ reference: this.generateMarkdownReferences(node), content: this.generateParagraphLike(node) })
    }

    // GenerateProof
    // Syntax Tree type: proof
    generateProof(node: Node): string {
        return this.json.Proof.format({ reference: this.generateMarkdownReferences(node), content: this.generateParagraphLike(node) })
    }

    // **************** Assistant Function ****************

    generateMarkdownReferences(node: Node): string {
        return "";
    }
}