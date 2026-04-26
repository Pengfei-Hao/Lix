import { Config } from "../../common/config";
import { Path } from "../../common/file-system/path";
import { NodeResult } from "../../common/result/parsing-result";
import { SourceText } from "../../common/source-text";
import { Node } from "../../common/syntax-tree/node";
import { Type, TypeTable } from "../../common/syntax-tree/type-table";
import { ArgumentType, BlockOption, BlockType } from "../table/block-table";
import { ParserTexts } from "../texts";
import { CoreModule } from "./core-module";
import { Module } from "./module";
import { ParserModule } from "./parser-module";

export class ArticleModule extends Module {

    protected parserModule: ParserModule;
    protected coreModule: CoreModule;

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


    constructor(config: Config, path: Path, texts: ParserTexts, typeTable: TypeTable, sourceText: SourceText, parserModule: ParserModule, coreModule: CoreModule) {
        super(config, path, texts, typeTable, sourceText);
        this.parserModule = parserModule;
        this.coreModule = coreModule;

        // **************** Section ****************

        const sectionOption: BlockOption = {
            type: BlockType.structural,
            argumentOptions: new Map([
                ["style", { type: ArgumentType.enumeration, options: ["numbered", "unnumbered"], default: "numbered" }],
            ]),
            allowReference: true
        };
        this.parserModule.blockTable.add("section", this.sectionBlockHandler, this, sectionOption);
        this.parserModule.blockTable.add("subsection", this.subsectionBlockHandler, this, sectionOption);
        this.parserModule.blockTable.add("subsubsection", this.subsubsectionBlockHandler, this, sectionOption);

        this.sectionType = this.typeTable.add("section");
        this.subsectionType = this.typeTable.add("subsection");
        this.subsubsectionType = this.typeTable.add("subsubsection");

        // **************** Document ****************

        const defaultOption: BlockOption = {
            type: BlockType.structural,
            argumentOptions: new Map(),
            allowReference: false
        };
        this.parserModule.blockTable.add("tableofcontents", this.tableofcontentsBlockHandler, this, defaultOption);
        this.parserModule.blockTable.add("newpage", this.newpageBlockHandler, this, defaultOption);
        this.parserModule.blockTable.add("title", this.titleBlockHandler, this, defaultOption);
        this.parserModule.blockTable.add("author", this.authorBlockHandler, this, defaultOption);
        this.parserModule.blockTable.add("date", this.dateBlockHandler, this, defaultOption);

        this.tableofcontentsType = this.typeTable.add("tableofcontents");
        this.newpageType = this.typeTable.add("newpage");
        this.titleType = this.typeTable.add("title");
        this.authorType = this.typeTable.add("author");
        this.dateType = this.typeTable.add("date");

        // **************** Bibliography ****************

        // bibliography
        this.parserModule.blockTable.add("bibliography", this.bibliographyBlockHandler, this, defaultOption);

        // bibliography item
        this.parserModule.blockTable.add("bib-item", this.bibItemBlockHandler, this, {
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
        this.parserModule.blockTable.add("definition", this.definitionBlockHandler, this, mathOption);
        this.parserModule.blockTable.add("lemma", this.lemmaBlockHandler, this, mathOption);
        this.parserModule.blockTable.add("proposition", this.propositionBlockHandler, this, mathOption);
        this.parserModule.blockTable.add("theorem", this.theoremBlockHandler, this, mathOption);
        this.parserModule.blockTable.add("corollary", this.corollaryBlockHandler, this, mathOption);
        this.parserModule.blockTable.add("proof", this.proofBlockHandler, this, mathOption);

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
        return this.coreModule.formatLikeBlockHandler(this.sectionType, "section", args, {
            DisallowsBlocks: this.texts.FormatDisallowsNestedBlocks,
            DisallowsTextInsertion: this.texts.FormatDisallowsNestedTextInsertions
        });
    }

    private subsectionBlockHandler(args: Node): NodeResult {
        return this.coreModule.formatLikeBlockHandler(this.subsectionType, "subsection", args, {
            DisallowsBlocks: this.texts.FormatDisallowsNestedBlocks,
            DisallowsTextInsertion: this.texts.FormatDisallowsNestedTextInsertions
        });
    }

    private subsubsectionBlockHandler(args: Node): NodeResult {
        return this.coreModule.formatLikeBlockHandler(this.subsubsectionType, "subsubsection", args, {
            DisallowsBlocks: this.texts.FormatDisallowsNestedBlocks,
            DisallowsTextInsertion: this.texts.FormatDisallowsNestedTextInsertions
        });
    }

    // **************** Document ****************

    private tableofcontentsBlockHandler(args: Node): NodeResult {
        return this.coreModule.formatLikeBlockHandler(this.tableofcontentsType, "tableofcontents", args, {
            DisallowsBlocks: this.texts.FormatDisallowsNestedBlocks,
            DisallowsTextInsertion: this.texts.FormatDisallowsNestedTextInsertions
        }, (args, result) => {
            result.setDiscarded(false);
        });

    }

    private newpageBlockHandler(args: Node): NodeResult {
        let result = this.coreModule.formatLikeBlockHandler(this.newpageType, "newpage", args, {
            DisallowsBlocks: this.texts.FormatDisallowsNestedBlocks,
            DisallowsTextInsertion: this.texts.FormatDisallowsNestedTextInsertions
        }, (args, result) => {
            result.setDiscarded(false);
        });
        return result;
    }

    private titleBlockHandler(args: Node): NodeResult {
        let result = this.coreModule.formatLikeBlockHandler(this.titleType, "title", args, {
            DisallowsBlocks: this.texts.FormatDisallowsNestedBlocks,
            DisallowsTextInsertion: this.texts.FormatDisallowsNestedTextInsertions
        }, (args, result) => {
            result.setDiscarded(false);
        });
        return result;
    }

    private authorBlockHandler(args: Node): NodeResult {
        let result = this.coreModule.formatLikeBlockHandler(this.authorType, "author", args, {
            DisallowsBlocks: this.texts.FormatDisallowsNestedBlocks,
            DisallowsTextInsertion: this.texts.FormatDisallowsNestedTextInsertions
        }, (args, result) => {
            result.setDiscarded(false);
        });
        return result;
    }

    private dateBlockHandler(args: Node): NodeResult {
        let result = this.coreModule.formatLikeBlockHandler(this.dateType, "date", args, {
            DisallowsBlocks: this.texts.FormatDisallowsNestedBlocks,
            DisallowsTextInsertion: this.texts.FormatDisallowsNestedTextInsertions
        }, (args, result) => {
            result.setDiscarded(false);
        });
        return result;
    }

    // **************** Bibliography ****************

    private bibliographyBlockHandler(args: Node): NodeResult {
        return this.coreModule.subblockLikeBlockHandler(this.bibliographyType, "bibliography", args, {
            DisallowsOtherBlocks: this.texts.BibliographyDisallowsOtherBlocks
        }, () => {
            return this.coreModule.isNoneOfBlocks("bib-item")
        }, (args, result) => {
            result.setDiscarded(false);
        });
    }

    private bibItemBlockHandler(args: Node): NodeResult {
        return this.coreModule.textLikeBlockHandler(this.bibItemType, "bib-item", args, {
            DisallowsOtherBlocks: this.texts.TextDisallowsNonFormatBlocks
        }, () => {
            return this.coreModule.isNoneOfBlocks(BlockType.format);
        });
    }

    // **************** Math Envirionment ****************

    private definitionBlockHandler(args: Node): NodeResult {
        return this.coreModule.paragraphLikeBlockHandler(this.definitionType, "definition", args, {
            DisallowsOtherBlocks: this.texts.ParagraphDisallowsOtherBlocks
        }, () => {
            return this.coreModule.isNoneOfBlocks(BlockType.basic, BlockType.format);
        }, (args, result) => {
            result.setDiscarded(false);
        });
    }

    private lemmaBlockHandler(args: Node): NodeResult {
        return this.coreModule.paragraphLikeBlockHandler(this.lemmaType, "lemma", args, {
            DisallowsOtherBlocks: this.texts.ParagraphDisallowsOtherBlocks
        }, () => {
            return this.coreModule.isNoneOfBlocks(BlockType.basic, BlockType.format);
        }, (args, result) => {
            result.setDiscarded(false);
        });
    }

    private propositionBlockHandler(args: Node): NodeResult {
        return this.coreModule.paragraphLikeBlockHandler(this.propositionType, "proposition", args, {
            DisallowsOtherBlocks: this.texts.ParagraphDisallowsOtherBlocks
        }, () => {
            return this.coreModule.isNoneOfBlocks(BlockType.basic, BlockType.format);
        }, (args, result) => {
            result.setDiscarded(false);
        });
    }

    private theoremBlockHandler(args: Node): NodeResult {
        return this.coreModule.paragraphLikeBlockHandler(this.theoremType, "theorem", args, {
            DisallowsOtherBlocks: this.texts.ParagraphDisallowsOtherBlocks
        }, () => {
            return this.coreModule.isNoneOfBlocks(BlockType.basic, BlockType.format);
        }, (args, result) => {
            result.setDiscarded(false);
        });
    }

    private corollaryBlockHandler(args: Node): NodeResult {
        return this.coreModule.paragraphLikeBlockHandler(this.corollaryType, "corollary", args, {
            DisallowsOtherBlocks: this.texts.ParagraphDisallowsOtherBlocks
        }, () => {
            return this.coreModule.isNoneOfBlocks(BlockType.basic, BlockType.format);
        }, (args, result) => {
            result.setDiscarded(false);
        });
    }

    private proofBlockHandler(args: Node): NodeResult {
        return this.coreModule.paragraphLikeBlockHandler(this.proofType, "proof", args, {
            DisallowsOtherBlocks: this.texts.ParagraphDisallowsOtherBlocks
        }, () => {
            return this.coreModule.isNoneOfBlocks(BlockType.basic, BlockType.format);
        }, (args, result) => {
            result.setDiscarded(false);
        });
    }
}
