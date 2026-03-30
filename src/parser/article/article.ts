import { Node } from "../../syntax-tree/node";
import { Type } from "../../syntax-tree/type";
import { Module } from "../module";
import { Parser } from "../parser";
import { BasicResult, NodeResult, Result, ResultState } from "../result";
import { MessageType } from "../message";
import { BlockOption, ArgumentType, BlockType } from "../block-table";
import { error } from "../../foundation/error";
import { parserExceptionTexts } from "../texts";

export class Article extends Module {

    // types of syntax tree node

    private titleType: Type;
    private authorType: Type;
    private dateType: Type;
    private sectionType: Type;
    private subsectionType: Type;
    private subsubsectionType: Type;
    private tableofcontentsType: Type;
    private newpageType: Type;

    private bibliographyType: Type;
    private bibItemType: Type;

    private definitionType: Type;
    private lemmaType: Type;
    private propositionType: Type;
    private theoremType: Type;
    private proofType: Type;
    private corollaryType: Type;


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

        this.sectionType = this.typeTable.add("section");
        this.subsectionType = this.typeTable.add("subsection");
        this.subsubsectionType = this.typeTable.add("subsubsection");

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

        this.tableofcontentsType = this.typeTable.add("tableofcontents");
        this.newpageType = this.typeTable.add("newpage");
        this.titleType = this.typeTable.add("title");
        this.authorType = this.typeTable.add("author");
        this.dateType = this.typeTable.add("date");

        // **************** Bibliography ****************

        // bibliography
        this.parser.blockTable.add("bibliography", this.bibliographyBlockHandler, this, defaultOption);

        // bibliography item
        this.parser.blockTable.add("bib-item", this.bibItemBlockHandler, this, {
            type: BlockType.subblock,
            argumentOptions: new Map(),
            allowReference: true
        });

        this.bibliographyType = this.typeTable.add("bibliography");
        this.bibItemType = this.typeTable.add("bib-item");

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
        this.definitionType = this.typeTable.add("definition");
        this.lemmaType = this.typeTable.add("lemma");
        this.propositionType = this.typeTable.add("proposition");
        this.theoremType = this.typeTable.add("theorem");
        this.corollaryType = this.typeTable.add("corollary");
        this.proofType = this.typeTable.add("proof");
    }

    init() {
    }

    // **************** Section ****************

    private sectionBlockHandler(args: Node): NodeResult {
        return this.parser.inlineModule.formatLikeBlockHandler("section", this.sectionType, args);
    }

    private subsectionBlockHandler(args: Node): NodeResult {
        return this.parser.inlineModule.formatLikeBlockHandler("subsection", this.subsectionType, args);
    }

    private subsubsectionBlockHandler(args: Node): NodeResult {
        return this.parser.inlineModule.formatLikeBlockHandler("subsubsection", this.subsubsectionType, args);
    }

    // **************** Document ****************

    private tableofcontentsBlockHandler(args: Node): NodeResult {
        let result = this.parser.inlineModule.formatLikeBlockHandler("tableofcontents", this.tableofcontentsType, args);
        result.setDiscarded(false);
        return result;
    }

    private newpageBlockHandler(args: Node): NodeResult {
        let result = this.parser.inlineModule.formatLikeBlockHandler("newpage", this.newpageType, args);
        result.setDiscarded(false);
        return result;
    }

    private titleBlockHandler(args: Node): NodeResult {
        let result = this.parser.inlineModule.formatLikeBlockHandler("title", this.titleType, args);
        result.setDiscarded(false);
        return result;
    }

    private authorBlockHandler(args: Node): NodeResult {
        let result = this.parser.inlineModule.formatLikeBlockHandler("author", this.authorType, args);
        result.setDiscarded(false);
        return result;
    }

    private dateBlockHandler(args: Node): NodeResult {
        let result = this.parser.inlineModule.formatLikeBlockHandler("date", this.dateType, args);
        result.setDiscarded(false);
        return result;
    }

    // **************** Bibliography ****************

    private bibliographyBlockHandler(args: Node): NodeResult {
        return this.parser.prepareMatch(this.bibliographyType, "bibliography-block-handler", this.myBibliographyBlockHandler.bind(this, args), this);
    }

    private myBibliographyBlockHandler(args: Node, result: NodeResult) {

        let res: BasicResult;
        let nodeRes: NodeResult;

        let preIndex: number;
        while (true) {
            preIndex = this.sourceText.getIndex();

            if ((res = this.parser.matchMultilineBlankLeqOne()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if (this.parser.inlineModule.isNoneOfBlocks("bib-item")) {
                result.mergeFailedState();

                result.recoverToSkippable();
                let length = this.parser.skipByBrackets();
                result.addMessage(this.texts.BibliographyDisallowsOtherBlocks, MessageType.error, preIndex, 0, length);
            }

            else if ((nodeRes = this.parser.inlineModule.matchBlock()).matched) {
                // 只能是 bib-item
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeBothNodesWithChild(nodeRes);
            }

            else {
                break;
            }
        }
    }

    private bibItemBlockHandler(args: Node): NodeResult {
        let result = this.parser.inlineModule.textLikeBlockHandler("bib-item", this.bibItemType, args);
        return result;
    }

    // **************** Math Envirionment ****************

    private definitionBlockHandler(args: Node): NodeResult {
        return this.parser.inlineModule.paragraphLikeBlockHandler("definition", this.definitionType, args);
    }

    private lemmaBlockHandler(args: Node): NodeResult {
        return this.parser.inlineModule.paragraphLikeBlockHandler("lemma", this.lemmaType, args);
    }

    private propositionBlockHandler(args: Node): NodeResult {
        return this.parser.inlineModule.paragraphLikeBlockHandler("proposition", this.propositionType, args);
    }

    private theoremBlockHandler(args: Node): NodeResult {
        return this.parser.inlineModule.paragraphLikeBlockHandler("theorem", this.theoremType, args);
    }

    private corollaryBlockHandler(args: Node): NodeResult {
        return this.parser.inlineModule.paragraphLikeBlockHandler("corollary", this.corollaryType, args);
    }

    private proofBlockHandler(args: Node): NodeResult {
        return this.parser.inlineModule.paragraphLikeBlockHandler("proof", this.proofType, args);
    }
}
