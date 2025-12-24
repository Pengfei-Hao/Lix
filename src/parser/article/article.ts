import { Node } from "../../sytnax-tree/node";
import { Type } from "../../sytnax-tree/type";
import { Module } from "../module";
import { Parser } from "../parser";
import { NodeResult, Result, ResultState } from "../result";
import { MessageType } from "../../foundation/message";
import { BlockOption, ArgumentType, BlockType } from "../block-table";

export class Article extends Module {

    private lang = this.parser.lang;

    // types of syntax tree node

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


    constructor(parser: Parser) {
        super(parser);

        // **************** Section ****************

        const sectionOption: BlockOption = {
            type: BlockType.structural,
            argumentOptions: new Map([
                ["style", { type: ArgumentType.enumeration, options: ["numbered", "unnumbered"], default: "numbered" }],
            ]),
            allowReference: true
        };
        this.parser.blockTable.add("section", this.sectionBlockHandler, this, sectionOption);
        this.parser.blockTable.add("subsection", this.subsectionBlockHandler, this, sectionOption);
        this.parser.blockTable.add("subsubsection", this.subsubsectionBlockHandler, this, sectionOption);

        this.sectionType = this.parser.typeTable.add("section");
        this.subsectionType = this.parser.typeTable.add("subsection");
        this.subsubsectionType = this.parser.typeTable.add("subsubsection");

        // **************** Document ****************

        const defaultOption: BlockOption = {
            type: BlockType.structural,
            argumentOptions: new Map(),
            allowReference: false
        };
        this.parser.blockTable.add("tableofcontents", this.tableofcontentsBlockHandler, this, defaultOption);
        this.parser.blockTable.add("newpage", this.newpageBlockHandler, this, defaultOption);
        this.parser.blockTable.add("title", this.titleBlockHandler, this, defaultOption);
        this.parser.blockTable.add("author", this.authorBlockHandler, this, defaultOption);
        this.parser.blockTable.add("date", this.dateBlockHandler, this, defaultOption);

        this.tableofcontentsType = this.parser.typeTable.add("tableofcontents");
        this.newpageType = this.parser.typeTable.add("newpage");
        this.titleType = this.parser.typeTable.add("title");
        this.authorType = this.parser.typeTable.add("author");
        this.dateType = this.parser.typeTable.add("date");

        // **************** Bibliography ****************

        // bibliography
        this.parser.blockTable.add("bibliography", this.bibliographyBlockHandler, this, defaultOption);

        // bibliography item
        this.parser.blockTable.add("bib-item", this.bibItemBlockHandler, this, {
            type: BlockType.subblock,
            argumentOptions: new Map(),
            allowReference: true
        });

        this.bibliographyType = this.parser.typeTable.add("bibliography");
        this.bibItemType = this.parser.typeTable.add("bib-item");

        // **************** Math Envirionment ****************

        const mathOption: BlockOption = {
            type: BlockType.structural,
            argumentOptions: new Map(),
            allowReference: true
        };
        // 此 definition 与 math 冲突了
        this.parser.blockTable.add("definition", this.definitionBlockHandler, this, mathOption);
        this.parser.blockTable.add("lemma", this.lemmaBlockHandler, this, mathOption);
        this.parser.blockTable.add("proposition", this.propositionBlockHandler, this, mathOption);
        this.parser.blockTable.add("theorem", this.theoremBlockHandler, this, mathOption);
        this.parser.blockTable.add("corollary", this.corollaryBlockHandler, this, mathOption);
        this.parser.blockTable.add("proof", this.proofBlockHandler, this, mathOption);

        // 此 definition 与 math 冲突了
        this.definitionType = this.parser.typeTable.add("definition'");
        this.lemmaType = this.parser.typeTable.add("lemma");
        this.propositionType = this.parser.typeTable.add("proposition");
        this.theoremType = this.parser.typeTable.add("theorem");
        this.corollaryType = this.parser.typeTable.add("corollary");
        this.proofType = this.parser.typeTable.add("proof");
    }

    init() {
    }

    // **************** Section ****************

    sectionBlockHandler(args: Node): NodeResult {
        return this.parser.formatLikeBlockHandler("section", this.sectionType, args);
    }

    subsectionBlockHandler(args: Node): NodeResult {
        return this.parser.formatLikeBlockHandler("subsection", this.subsectionType, args);
    }

    subsubsectionBlockHandler(args: Node): NodeResult {
        return this.parser.formatLikeBlockHandler("subsubsection", this.subsubsectionType, args);
    }

    // **************** Document ****************

    tableofcontentsBlockHandler(args: Node): NodeResult {
        let result = this.parser.formatLikeBlockHandler("tableofcontents", this.tableofcontentsType, args);
        result.discarded = false;
        return result;
    }

    newpageBlockHandler(args: Node): NodeResult {
        let result = this.parser.formatLikeBlockHandler("newpage", this.newpageType, args);
        result.discarded = false;
        return result;
    }

    titleBlockHandler(args: Node): NodeResult {
        let result = this.parser.formatLikeBlockHandler("title", this.titleType, args);
        result.discarded = false;
        return result;
    }

    authorBlockHandler(args: Node): NodeResult {
        let result = this.parser.formatLikeBlockHandler("author", this.authorType, args);
        result.discarded = false;
        return result;
    }

    dateBlockHandler(args: Node): NodeResult {
        let result = this.parser.formatLikeBlockHandler("date", this.dateType, args);
        result.discarded = false;
        return result;
    }

    // **************** Bibliography ****************

    bibliographyBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.bibliographyType, "bibliography-block-handler", this.myBibliographyBlockHandler.bind(this, args), this);
    }

    private myBibliographyBlockHandler(args: Node, result: NodeResult) {
        let nodeRes: NodeResult;
        let blkRes: Result<number>;
        let preIndex: number;

        result.mergeState(ResultState.successful);

        while (true) {
            preIndex = this.parser.index;

            if (this.parser.isEOF()) {
                return;
            }
            if (this.parser.isMultilineBlankGtOne()) {
                return;
            }
            else if (this.parser.is("]")) {
                break;
            }
            else if (this.parser.isNonSomeBlock("bib-item")) {
                result.mergeState(ResultState.skippable);
                let length = this.parser.skipByBrackets();
                result.addMessage(this.lang.BibliographyDisallowsOtherBlocks, MessageType.error, preIndex, 0, length);
            }

            else if ((blkRes = this.parser.matchMultilineBlank()).matched) {
                result.merge(blkRes);
            }

            else if ((nodeRes = this.parser.matchBlock()).matched) {
                // 只能是 bib-item
                result.merge(nodeRes);
                // 不会失败
                result.mergeNodeToChildren(nodeRes);
            }

            else {
                result.addMessage(this.lang.BibliographyDisallowsText, MessageType.error, preIndex, 0, 1);
                result.mergeState(ResultState.skippable);
                this.parser.move();
            }
        }
    }

    bibItemBlockHandler(args: Node): NodeResult {
        let result = this.parser.textLikeBlockHandler("bib-item", this.bibItemType, args);
        return result;
    }

    // **************** Math Envirionment ****************

    definitionBlockHandler(args: Node): NodeResult {
        return this.parser.paragraphLikeBlockHandler("definition", this.definitionType, args);
    }

    lemmaBlockHandler(args: Node): NodeResult {
        return this.parser.paragraphLikeBlockHandler("lemma", this.lemmaType, args);
    }

    propositionBlockHandler(args: Node): NodeResult {
        return this.parser.paragraphLikeBlockHandler("proposition", this.propositionType, args);
    }

    theoremBlockHandler(args: Node): NodeResult {
        return this.parser.paragraphLikeBlockHandler("theorem", this.theoremType, args);
    }

    corollaryBlockHandler(args: Node): NodeResult {
        return this.parser.paragraphLikeBlockHandler("corollary", this.corollaryType, args);
    }

    proofBlockHandler(args: Node): NodeResult {
        return this.parser.paragraphLikeBlockHandler("proof", this.proofType, args);
    }
}
