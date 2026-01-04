/**
 * Latex generator: translate syntax tree to latex source
 */

import { Node } from "../syntax-tree/node";
import { Type } from "../syntax-tree/type";
import { TypeTable } from "../syntax-tree/type-table";
import { Generator } from "./generator";
import { Compiler } from "../compiler/compiler";
import { FileSystem } from "../compiler/file-system";
import { Config } from "../compiler/config";
import { Reference } from "../parser/result";

// latex generate

export class LatexGenerator extends Generator {

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

    // Introduction & Document
    introduction: string;
    document: string;

    hasMakedTitle: boolean;

    // generator of settings
    settingGeneratorTable: Map<string, (parameter: string) => string>;

    // generator of blocks and insertions
    structuralBlockGeneratorTable: Map<Type, (node: Node) => string | Promise<string>>;
    basicBlockGeneratorTable: Map<Type, (node: Node) => string | Promise<string>>;
    formatBlockGeneratorTable: Map<Type, (node: Node) => string | Promise<string>>;
    subBlockGeneratorTable: Map<Type, (node: Node) => string | Promise<string>>;
    InsertionGeneratorTable: Map<Type, (node: Node) => string | Promise<string>>;

    // latex template
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
        DefaultImage: string,
        SingleImage: string,
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
        MakeTitleAuthorDate: string,
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

    constructor(compiler: Compiler, mathGenerator: Generator) {
        super(compiler);
        this.mathGenerator = mathGenerator;

        this.introduction = "";
        this.document = "";
        this.hasMakedTitle = false;
        this.references = [];
        this.json = JSON.parse(this.config.get("latex"));

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
            ["paper", this.generatePaperSetting]
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
        this.introduction = "";
        this.document = "";
        this.hasMakedTitle = false;
        this.references = [];
    }

    // **************** Generate ****************
    // 下面的 generate 类函数行尾没有换行

    // Generate
    generate(syntaxTree: Node, references: Reference[]) {

        this.init();

        this.references = references;

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
        this.addIntrodunction(`\\newtheorem{theorem}{Theorem}[section]\n\\newtheorem{definition}[theorem]{Definition}\n\\newtheorem{lemma}[theorem]{Lemma}\n\\newtheorem{corollary}[theorem]{Corollary}\n\\newtheorem{proposition}[theorem]{Proposition}\n`);

        this.addIntrodunction(`\\usepackage{hyperref}\n\\hypersetup{hypertex=true, colorlinks=true, linkcolor=blue, anchorcolor=blue, citecolor=blue}`);

        this.addContent(this.generateDocument(syntaxTree));

        this.output = `\\documentclass{article}\n${this.introduction}\n\\begin{document}\n${this.document}\n\\end{document}`;

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
        let refLatex = this.generateLatexReferences(node);

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
        if (imageCount === 1) {
            for (let n of node.children) {
                if (n.type === this.imageType) {
                    res += this.generateImage(true, n);
                    break;
                }
            }
        }
        else if (imageCount > 1) {
            for (let n of node.children) {
                if (n.type === this.imageType) {
                    res += this.generateImage(false, n);
                }
            }
        }

        return this.json.Figure.format({ content: res, caption: caption === undefined ? "" : this.generateCaption(caption), reference: refLatex });
    }

    // GenerateImage
    // Syntax Tree type: image
    generateImage(single: boolean, node: Node): string {
        let path = this.getArgument(node, "path")!;
        let content = path;
        if (this.fileSystem.path.extname(path) === ".tikz") {
            content = this.fileSystem.readTextFileByRecord(this.fileSystem.pathToUri(path)) ?? "";
        }
        else {
            this.fileSystem.copyByRecord(this.fileSystem.pathToUri(path), this.fileSystem.cacheDirectoryUri);
        }

        if (single) {
            return this.json.SingleImage.format({ size: this.getArgument(node, "size")!, path: content });
        }
        return this.json.DefaultImage.format({ caption: this.generateFormatLike(node), size: this.getArgument(node, "size")!, path: content });
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
        return this.json.Item.format({ reference: this.generateLatexReferences(node), content: this.generateParagraphLike(node) });
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
        let refLatex = this.generateLatexReferences(node);
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
        this.addIntrodunction(this.line(this.json.Title.format(this.generateFormatLike(node))));
        if (!this.hasMakedTitle) {
            this.hasMakedTitle = true;
            return this.json.MakeTitleAuthorDate;
        }
        return "";
    }

    // GenerateAuthor
    // Syntax Tree type: author
    generateAuthor(node: Node): string {
        this.addIntrodunction(this.line(this.json.Author.format(this.generateFormatLike(node))));
        if (!this.hasMakedTitle) {
            this.hasMakedTitle = true;
            return this.json.MakeTitleAuthorDate;
        }
        return "";
    }

    // GenerateDate
    // Syntax Tree type: date
    generateDate(node: Node): string {
        this.addIntrodunction(this.line(this.json.Date.format(this.generateFormatLike(node))));
        if (!this.hasMakedTitle) {
            this.hasMakedTitle = true;
            return this.json.MakeTitleAuthorDate;
        }
        return "";
    }

    // GenerateSection
    // Syntax Tree type: section
    generateSection(node: Node): string {
        let refLatex = this.generateLatexReferences(node);
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
        let refLatex = this.generateLatexReferences(node);
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
        let refLatex = this.generateLatexReferences(node);
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
        return this.json.BibItem.format({ reference: refLatex, content: this.generateTextLike(node) })
    }

    // GenerateTheorem
    // Syntax Tree type: theorem
    generateTheorem(node: Node): string {
        return this.json.Theorem.format({ reference: this.generateLatexReferences(node), content: this.generateParagraphLike(node) })
    }

    // GenerateDefinition
    // Syntax Tree type: definition
    generateDefinition(node: Node): string {
        return this.json.Definition.format({ reference: this.generateLatexReferences(node), content: this.generateParagraphLike(node) })
    }

    // GenerateLemma
    // Syntax Tree type: lemma
    generateLemma(node: Node): string {
        return this.json.Lemma.format({ reference: this.generateLatexReferences(node), content: this.generateParagraphLike(node) })
    }

    // GenerateCorollary
    // Syntax Tree type: corollary
    generateCorollary(node: Node): string {
        return this.json.Corollary.format({ reference: this.generateLatexReferences(node), content: this.generateParagraphLike(node) })
    }

    // GenerateProposition
    // Syntax Tree type: proposition
    generateProposition(node: Node): string {
        return this.json.Proposition.format({ reference: this.generateLatexReferences(node), content: this.generateParagraphLike(node) })
    }

    // GenerateProof
    // Syntax Tree type: proof
    generateProof(node: Node): string {
        return this.json.Proof.format({ reference: this.generateLatexReferences(node), content: this.generateParagraphLike(node) })
    }

    // **************** Assistant Function ****************

    generateLatexReferences(node: Node): string {
        let refLatex = "";
        this.getReferences(node).forEach(ref => {
            refLatex += `\\label{${ref}}`;
        })
        return refLatex;
    }

    // **************** Latex Commands ****************
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
}