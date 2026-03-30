import { Node } from "../../syntax-tree/node";
import { Type } from "../../syntax-tree/type";
import { Module } from "../module";
import { MatchResult, Parser } from "../parser";
import { BasicResult, HighlightType, NodeResult, Result } from "../result";
import { MessageType } from "../message";
import { OperatorTable, OperatorPattern, OperatorPatternType } from "./operator-table";
import { Heap } from "../../foundation/heap"
import { Ref } from "../../foundation/ref";
import { ArgumentType, BlockType } from "../block-table";
import "../../foundation/union"
import { parserExceptionTexts } from "../texts";
import { error } from "../../foundation/error";

type getCachedFormula = () => Node;

export class Math extends Module {

    // Types of syntax tree node

    private formulaType: Type;

    private elementType: Type;
    private escapeElementType: Type;
    private inlineTextType: Type;
    private operatorTextType: Type;

    private infixType: Type;
    private prefixType: Type;
    private postfixType: Type;
    private matrixType: Type;

    // Operator, symbols & notations

    operatorTable: OperatorTable; // 参与表达式解析的符号, 包括 PrefixOperator 字段和 InfixOperator 字段

    // Symbol 唯一, Notation 不唯一, 一个 Symbol 可以对应多个 Notation

    notationsToSymbols: Map<string, string>; // Unicode 符号和记号, UnicodeSymbolsAndNotations 字段
    symbols: Set<string>; // 符号, 包括 Symbols 字段 (ASCII 符号) 和 UnicodeSymbolsAndNotations 字段的 Unicode 符号部分
    private maxSymbolLength: number;
    notations: Set<string>; // 字母记号, 包括 Notations 字段和 UnicodeSymbolsAndNotations 字段的字母记号部分

    constructor(parser: Parser) {
        super(parser);

        // **************** Types ****************

        this.formulaType = this.typeTable.add("formula");
        this.elementType = this.typeTable.add("element");
        this.escapeElementType = this.typeTable.add("escape-element");
        this.inlineTextType = this.typeTable.add("inline-text");
        this.operatorTextType = this.typeTable.add("operator-text");
        this.infixType = this.typeTable.add("infix");
        this.prefixType = this.typeTable.add("prefix");
        this.postfixType = this.typeTable.add("postfix");
        this.matrixType = this.typeTable.add("matrix");

        // **************** Block & Insertion ****************

        // Init block handler
        this.parser.blockTable.add("formula", this.formulaBlockHandler, this, {
            type: BlockType.basic,
            argumentOptions: new Map([
                ["style", { type: ArgumentType.enumeration, options: ["numbered", "unnumbered"], default: "unnumbered" }],
                ["line", { type: ArgumentType.enumeration, options: ["single", "multi"], default: "single" }],
            ]),
            allowReference: true
        });

        // Init insertion handler
        this.parser.insertionTable.add("/", this.formulaInsertionHandler, this);

        // **************** Notations, Symbols & Operators ****************

        this.symbols = new Set();
        this.maxSymbolLength = 0;
        this.notations = new Set();
        this.notationsToSymbols = new Map();

        // Init from math.json
        let json = this.config.get("math");
        let config: {
            UnicodeSymbolsAndNotations: string[][],
            LongSymbolsAndNotations: string[][],
            Notations: string[],
            Symbols: string,
            PrefixOperator: { pattern: { type: string, options: string[] }[] }[],
            InfixOperator: { symbols: string, patterns: string[] }[],
            PostfixOperator: { patterns: { type: string, options: string[] }[] }[],
        } = JSON.parse(json);

        // 字母记号
        for (let notation of config.Notations) {
            this.notations.add(notation);
        }

        // ASCII 符号
        for (let sym of config.Symbols) {
            this.symbols.add(sym);
            this.maxSymbolLength = (sym.length > this.maxSymbolLength) ? sym.length : this.maxSymbolLength;
        }

        // Unicode 符号
        for (let tmp of config.UnicodeSymbolsAndNotations) {
            this.symbols.add(tmp[0]);
            this.maxSymbolLength = (tmp[0].length > this.maxSymbolLength) ? tmp[0].length : this.maxSymbolLength;
            for (let i = 1; i < tmp.length; i++) {
                this.notations.add(tmp[i]);
                this.notationsToSymbols.set(tmp[i], tmp[0]);
            }
        }

        this.operatorTable = new OperatorTable();

        // Prefix operator
        for (let prefix of config.PrefixOperator) {
            let patterns: OperatorPattern[] = [];
            for (let pattern of prefix.pattern) {
                switch (pattern.type) {
                    case "enumeration":
                        patterns.push(new OperatorPattern(OperatorPatternType.enumeration, new Set(pattern.options)));
                        break;
                    case "term":
                        patterns.push(new OperatorPattern(OperatorPatternType.term, new Set(pattern.options)));
                        break;
                    case "expression":
                        patterns.push(new OperatorPattern(OperatorPatternType.expression, new Set(pattern.options)));
                        break;
                    case "matrix":
                        patterns.push(new OperatorPattern(OperatorPatternType.matrix, new Set(pattern.options)));
                        break;
                    default:
                        error(parserExceptionTexts.PrefixOperatorTypeInvalid);
                }
            }
            this.operatorTable.addPrefixOperator(patterns);
        }

        // Postfix operator
        for (let postfix of config.PostfixOperator) {
            let patterns: OperatorPattern[] = [];
            for (let pattern of postfix.patterns) {
                switch (pattern.type) {
                    case "enumeration":
                        patterns.push(new OperatorPattern(OperatorPatternType.enumeration, new Set(pattern.options)));
                        break;
                    case "term":
                        patterns.push(new OperatorPattern(OperatorPatternType.term, new Set(pattern.options)));
                        break;
                    case "expression":
                        patterns.push(new OperatorPattern(OperatorPatternType.expression, new Set(pattern.options)));
                        break;
                    case "matrix":
                        patterns.push(new OperatorPattern(OperatorPatternType.matrix, new Set(pattern.options)));
                        break;
                    default:
                        error(parserExceptionTexts.PostfixOperatorTypeInvalid);
                }
            }
            this.operatorTable.addPostfixOperator(patterns);
        }

        // Infix operator
        let medium = 0;
        for (medium = 0; medium < config.InfixOperator.length; medium++) {
            if (config.InfixOperator[medium].symbols === "") {
                this.operatorTable.addInfixOperator("", new Set(), 0);
                break;
            }
        }
        for (let i = medium - 1; i >= 0; i--) {
            this.operatorTable.insertInfixOperatorAtTop(config.InfixOperator[i].symbols, new Set(config.InfixOperator[i].patterns));
        }
        for (let i = medium + 1; i < config.InfixOperator.length; i++) {
            this.operatorTable.insertInfixOperatorAtBottom(config.InfixOperator[i].symbols, new Set(config.InfixOperator[i].patterns));
        }

    }

    init() {
    }

    // **************** Block & Insertion ****************

    // 合并 a[bc[d]e] 这种表达式为 abcde
    private cleanupInfixOperator(node: Node) {
        for (let subnode of node.children) {
            this.cleanupInfixOperator(subnode);
        }

        if (node.type === this.infixType && node.content === "") {
            for (let i = 0; i < node.children.length; i++) {
                let subnode = node.children[i];
                if (subnode.type === this.infixType && subnode.content === "") {
                    node.children.splice(i, 1, ...subnode.children);
                    i += subnode.children.length - 1;
                }
            }
        }
    }

    // FormulaBlockHandler: failing | skippable | successful

    private formulaBlockHandler(args: Node): NodeResult {

        return this.parser.prepareMatch(this.formulaType, "formula-block-handler", this.myFormulaBlockHandler.bind(this, args), this, result => this.cleanupInfixOperator(result.analysedNode));
    }

    private myFormulaBlockHandler(args: Node, result: NodeResult) {
        let multiline = (this.parser.inlineModule.getArgument(args, "line") === "multi");
        let nodeRes = this.matchFormula("]", multiline);
        result.merge(nodeRes);
        result.mergeNodeByTransferringAndAnalysedNodeWithChild(nodeRes);
    }

    // FormulaInsertionHandler: failing | matched | skippable | successful

    private formulaInsertionHandler(): MatchResult {
        return this.parser.prepareMatch(this.formulaType, "formula-insertion-handler", this.myFormulaInsertionHandler, this, result => this.cleanupInfixOperator(result.analysedNode));
    }

    private myFormulaInsertionHandler(result: NodeResult) {
        let beginIndex = this.sourceText.getIndex();
        result.merge(this.parser.match("/"));
        if (result.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }
        result.addHighlight(HighlightType.operator, beginIndex, 0, 1);

        let nodeRes = result.merge(this.matchFormula("/", false));
        if (result.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }
        result.mergeNodeByTransferringAndAnalysedNodeWithChild(nodeRes);

        let endIndex = this.sourceText.getIndex();
        result.merge(this.parser.match("/"));
        if (result.shouldStop) {
            result.addMessage(this.texts.InlineFormulaMissingClosingSlash, MessageType.error, beginIndex, 0, endIndex - beginIndex);

            result.recoverToSkippable();
            return;
        }
        result.addHighlight(HighlightType.operator, endIndex, 0, 1);
    }

    // **************** Matching ****************

    // Part 1: scan the text and construct the syntax tree. This part will use types of node as follows:
    // formula
    // inlineText
    // element
    // escapeElement

    // MatchElements: skippable | successful

    private matchFormula(endWith: string = "]", multiline: boolean): NodeResult {
        return this.parser.prepareMatch(this.formulaType, "elements", this.myMatchFormula.bind(this, endWith), this, this.analyseFormula.bind(this, multiline));
    }

    private myMatchFormula(endWith: string, result: NodeResult) {

        let preIndex: number;

        let res: BasicResult;
        let valRes: Result<string>;
        let nodeRes: NodeResult;

        while (true) {
            preIndex = this.sourceText.getIndex();

            if (this.sourceText.isEOF()) {
                break;
            }

            if ((nodeRes = this.matchEscapeElement()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeNodeWithChild(nodeRes);
            }

            if (this.parser.isMultilineBlankGtOne()) {
                break;
            }

            // endWith 优先级比 escape element 低
            else if (this.sourceText.isText(endWith)) {
                break;
            }

            else if ((res = this.parser.matchMultilineBlankLeqOne()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((res = this.parser.match("[")).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.addHighlight(HighlightType.operator, preIndex, 0, 1);

                nodeRes = result.merge(this.matchFormula("]", false));
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeBothNodesWithChild(nodeRes);

                let endIndex = this.sourceText.getIndex();
                result.merge(this.parser.match("]"));
                if (result.shouldStop) {
                    result.addMessage(this.texts.FormulaMissingRightBracket, MessageType.error, preIndex, 0, endIndex - preIndex);
                    result.recoverToSkippable();
                    return;
                }
                result.addHighlight(HighlightType.operator, endIndex, 0, 1);
            }

            else if ((nodeRes = this.matchInlineText()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeNodeWithChild(nodeRes);
            }

            else if ((nodeRes = this.matchOperatorText()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeNodeWithChild(nodeRes);
            }

            else if ((nodeRes = this.matchElement()).matched) {
                result.merge(nodeRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeNodeWithChild(nodeRes);
            }

            else if (this.sourceText.isName()) {
                // 如果 notation 不存在就当作单字读入
                while (true) {
                    preIndex = this.sourceText.getIndex();
                    if (this.sourceText.isName()) {
                        valRes = result.merge(this.parser.matchChar());
                        if (result.shouldStop) {
                            error(parserExceptionTexts.LogicalUnexpectedStop);
                        }
                        result.addChild(this.elementType, valRes.value, [], preIndex, 0, 1);
                    }
                    else {
                        break;
                    }
                }
            }

            else {
                result.mergeFailedState();

                result.recoverToSkippable();
                let curChar = this.sourceText.peek();
                result.addMessage(this.texts.FormulaUnrecognizedCharacter.format(curChar), MessageType.error, preIndex, 0, curChar.length);
                this.sourceText.move();
            }
        }
    }

    // MatchElement: failing | successful

    private matchElement(): NodeResult {
        return this.parser.prepareMatch(this.elementType, "element", this.myMatchElement, this);
    }

    private myMatchElement(result: NodeResult) {

        let valRes: Result<string>;

        let name = this.sourceText.findLongestMatch(this.symbols, this.maxSymbolLength);
        if (name !== undefined) { // 先 symbol, 有些多字符的 symbol 会含有字母, 如 a dot.
            result.merge(this.parser.match(name));
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.setNodeContent(name);
            if (!this.symbols.has(name)) {
                result.mergeFailedState();
                return;
            }
        }
        else if ((valRes = this.parser.matchName()).matched) { // notation
            result.merge(valRes);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.setNodeContent(valRes.value);
            if (!this.notations.has(result.node.content)) {
                result.mergeFailedState();
                return;
            }
        }
        else {
            result.mergeFailedState();
            return;
        }
    }

    // MatchEscapeElement: failing | skippable | successful

    private matchEscapeElement(): NodeResult {
        return this.parser.prepareMatch(this.escapeElementType, "escape-element", this.myMatchEscapeElement, this);
    }

    private myMatchEscapeElement(result: NodeResult) {

        let res: BasicResult;
        let nodeRes: NodeResult;

        let beginIndex = this.sourceText.getIndex();
        if ((res = this.parser.match("@")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();

            nodeRes = result.merge(this.matchElement());
            if (result.shouldStop) {
                result.recoverToSkippable();

                result.setNodeType(this.elementType);
                result.setNodeContent("@");
                result.addMessage(this.texts.InlineMathAtMustFollowElement, MessageType.error, beginIndex, 0, 1);
                return;
            }
            result.setNodeContent(nodeRes.node.content);
        }
        else if ((res = this.parser.match("\\")).matched) {
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.ensureMatched();
            result.setNodeType(this.elementType);

            nodeRes = result.merge(this.matchElement());
            if (result.shouldStop) {
                result.recoverToSkippable();

                result.setNodeContent("\\");
                result.addMessage(this.texts.InlineMathBackslashMustFollowElement, MessageType.error, beginIndex, 0, 1);
                return;
            }
            result.setNodeContent(nodeRes.node.content);
        }
        else {
            result.mergeFailedState();
            return;
        }
    }

    // MatchInlineText: failing | skippable | successful

    private matchInlineText(): NodeResult {
        return this.parser.prepareMatch(this.inlineTextType, "inline-text", this.myMatchRawInlineText.bind(this, '"'), this);
    }

    // MatchOperatorText: failing | skippable | successful

    private matchOperatorText(): NodeResult {
        return this.parser.prepareMatch(this.operatorTextType, "operator-text", this.myMatchRawInlineText.bind(this, '`'), this);
    }

    private myMatchRawInlineText(marker: string = '"', result: NodeResult) {

        let valRes: Result<string>;

        let beginIndex = this.sourceText.getIndex();
        result.merge(this.parser.match(marker));
        if (result.shouldStop) {
            return;
        }
        result.ensureMatched();

        let preIndex: number;
        while (true) {
            preIndex = this.sourceText.getIndex();

            if (this.sourceText.isText(marker)) {
                break;
            }
            else if (this.sourceText.isNewline()) {
                result.mergeFailedState();
                result.recoverToSkippable();
                result.addMessage(this.texts.FormulaInlineTextEndedUnexpectedly, MessageType.error, beginIndex, 0, preIndex - beginIndex);
                return;
            }
            else if ((valRes = this.parser.matchChar()).matched) {
                result.merge(valRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.appendNodeContent(valRes.value);
            }
        }

        result.merge(this.parser.match(marker));
        if (result.shouldStop) {
            result.recoverToSkippable();
            result.addMessage(this.texts.FormulaInlineTextEndedUnexpectedly, MessageType.error, beginIndex, 0, preIndex - beginIndex);
            return;
        }
    }

    // **************** Analysing ****************

    // Part 2: analyse the syntax tree that constructed in Part 1, replace definition nodes with its content, and find out the correct math label function to handle the formula nodes. This part will use types of node as follows:
    // formula
    // element
    // inline-text
    // matrix
    // infix
    // prefix

    // private analyse(multiline: boolean, result: NodeResult) {
    //     // match 不会失败
    //     /*
    //     // filter the definition, i.e. the chars surrounded by the ' '.
    //     for (let subnode of node.children) {
    //         if (subnode.type === this.definitionType) {
    //             result.mergeState(ResultState.successful);

    //             if (subnode.children.length < 2) {
    //                 result.mergeState(ResultState.failing);
    //                 result.promoteToSkippable();
    //                 result.addMessage("Definition uncompleted."), MessageType.error, this.parser.index);
    //                 continue;
    //             }
    //             if (subnode.children[0].type != this.elementType) {
    //                 result.mergeState(ResultState.failing);
    //                 result.promoteToSkippable();
    //                 result.addMessage("Definition element unfounded."), MessageType.error, this.parser.index);
    //                 continue;
    //             }
    //             if (subnode.children[1].type != this.elementType || subnode.children[1].content != "↦") {
    //                 result.mergeState(ResultState.failing);
    //                 result.promoteToSkippable();
    //                 result.addMessage("Symbol '↦' unfounded."), MessageType.error, this.parser.index);
    //                 continue;
    //             }

    //             result.highlights.push({ begin: subnode.begin, end: subnode.begin + 1, type: 3 });
    //             result.highlights.push({ begin: subnode.end, end: subnode.end + 1, type: 3 });

    //             let newNode = new Node(this.formulaType);
    //             for (let i = 2; i < subnode.children.length; i++) {
    //                 newNode.children.push(Node.clone(subnode.children[i]));
    //             }

    //             this.blockHandlerTable.addDefinition(subnode.children[0].content, newNode);
    //         }

    //     }

    //     for (let i = node.children.length - 1; i >= 0; i--) {
    //         if (node.children[i].type === this.definitionType) {
    //             node.children.splice(i, 1);
    //         }
    //     }
    //         */

    //     // analyse 
    //     let analRes = this.analyseFormula(result.node, multiline);
    //     result.merge(analRes);
    //     result.analysedNode.children.push(analRes.value);
    //     result.analysedNode.type = this.formulaType;
    //     this.cleanupInfixOperator(result.analysedNode);
    // }

    // **************** Skipping ****************

    private isEOF(node: Node, index: Ref<number>, endTerm: Set<string>): boolean {
        if (index.value === node.children.length) {
            return true;
        }
        let child = node.children[index.value];
        if (child.type === this.elementType && endTerm.has(child.content)) {
            return true;
        }
        return false;
    }

    private skipToEndTerm(node: Node, index: Ref<number>, endTerm: Set<string>) {
        while (true) {
            if (this.isEOF(node, index, endTerm)) {
                return;
            }
            index.value++;
        }
    }

    private skipOneTerm(node: Node, index: Ref<number>, endTerm: Set<string>) {
        if (this.isEOF(node, index, endTerm)) {
            return;
        }
        index.value++;
    }

    // **************** Analysing Formula ****************

    // AnalyseFormula: skippable | successful
    // 分析一个 formula node 的所有子节点, 结果是 infix 或 element, inline-text, prefix, 位于 result.value

    private analyseFormula(multiline: boolean, result: NodeResult) {
        let index = new Ref<number>(0);
        let res: Result<Node>;

        let cacheIndex = -1;
        let getCached = () => {
            cacheIndex++;
            if (cacheIndex >= result.analysedNode.children.length) {
                error(parserExceptionTexts.LogicalAnalyseFormulaCacheOutOfBounds);
            }
            return result.analysedNode.children[cacheIndex];
        }

        if (multiline) {
            this.parser.begin("analyse-multiline-formula");
            res = this.analyseMatrix(result.node, index, new Set(), getCached);
            this.parser.end();
        }
        else {
            this.parser.begin("analyse-formula");
            res = this.analyseSubFormula(result.node, index, new Set(), getCached);
            this.parser.end();
        }
        result.merge(res);
        if (result.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }
        result.analysedNode.children = [];
        res.value.transferTo(result.analysedNode);
    }

    // AnalyseSubFormula: skippable | successful
    // 分析一个 formula node 的其中一段, 结果是 infix, prefix, element, inline-text, operator-text

    private analyseSubFormula(parnode: Node, index: Ref<number>, endTerm: Set<string>, getCached: getCachedFormula): Result<Node> {
        let result = new Result<Node>(new Node(this.infixType));
        this.parser.begin("analyse-sub-formula");
        this.myAnalyseSubFormula(parnode, index, endTerm, getCached, result);
        this.parser.end();
        return result;
    }

    private myAnalyseSubFormula(parnode: Node, index: Ref<number>, endTerm: Set<string>, getCached: getCachedFormula, result: Result<Node>) {

        let termHeap = new Heap<Node>();
        let operatorHeap = new Heap<Node>();

        let res: Result<Node>;
        let curOp: Node;

        let hasInfixOperator = true;
        let constructingBlankOp = false;
        let constructing = false;

        while (true) {
            if (constructingBlankOp) {
                // cur operator = Blank operator
                let lastOp = operatorHeap.top();
                //  == undefined 必须用, 空串会被判为false
                if (lastOp === undefined || this.operatorTable.leq(lastOp.content, "")) {
                    operatorHeap.push(new Node(this.elementType, ""));
                    termHeap.push(res!.value);
                    hasInfixOperator = false;
                    constructingBlankOp = false;
                }
                else {
                    this.construct(termHeap, operatorHeap, result);
                }
                continue;
            }

            if (constructing) {
                let lastOp = operatorHeap.top();
                //  == undefined 必须用, 空串会被判为false
                if (lastOp === undefined || this.operatorTable.leq(lastOp.content, curOp!.content)) {
                    operatorHeap.push(curOp!);
                    hasInfixOperator = true;
                    constructing = false;
                }
                else {
                    this.construct(termHeap, operatorHeap, result);
                }

                continue;
            }

            if (this.isEOF(parnode, index, endTerm)) {
                if (hasInfixOperator) {
                    if (termHeap.length === 0) { // subformula 为空的情况
                        result.mergeSuccessfulState();
                        return;
                    }
                    result.mergeFailedState();

                    result.recoverToSkippable();
                    // 直接扔掉多余的 infix operator
                    let trashOp = operatorHeap.pop()!;
                    result.addMessage(this.texts.ExpressionMissingLastTerm, MessageType.error, trashOp);
                    hasInfixOperator = false;
                }
                // same as above
                if (operatorHeap.length !== 0) {
                    this.construct(termHeap, operatorHeap, result);
                    continue;
                }

                if (termHeap.length !== 1 || operatorHeap.length !== 0) {
                    error(parserExceptionTexts.LogicalAnalyseSubformulaFailed);
                }

                result.value = termHeap.pop()!;
                return;
            }

            else if ((res = this.analyseTerm(parnode, index, endTerm, getCached)).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }

                if (!hasInfixOperator) { // 连续两个 term
                    let lastOp = operatorHeap.top();
                    //  == undefined 必须用, 空串会被判为false
                    // same as below
                    if (lastOp === undefined || this.operatorTable.leq(lastOp.content, "")) {
                        operatorHeap.push(new Node(this.elementType, ""));
                        termHeap.push(res.value);
                        hasInfixOperator = false;
                    }
                    else {
                        constructingBlankOp = true;
                    }
                }
                else {
                    termHeap.push(res.value);
                    hasInfixOperator = false;
                }
            }

            else if ((res = this.analyseOperator(parnode, index, endTerm)).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }

                if (hasInfixOperator) {
                    result.mergeFailedState();

                    result.recoverToSkippable();
                    result.addMessage(this.texts.InfixOperatorRepeated, MessageType.error, res.value);
                    // 直接丢弃这一项
                    continue;
                }

                let lastOp = operatorHeap.top();
                curOp = res.value;
                //  == undefined 必须用, 空串会被判为false
                if (lastOp === undefined || this.operatorTable.leq(lastOp.content, curOp.content)) {
                    operatorHeap.push(curOp);
                    hasInfixOperator = true;
                }
                else {
                    constructing = true;
                }
            }

            else {
                error(parserExceptionTexts.LogicalAnalyseFormulaFailed);
            }
        }
    }

    private construct(termHeap: Heap<Node>, operatorHeap: Heap<Node>, result: Result<Node>) {

        let lastOp = operatorHeap.top()!;

        let nNode = new Node(this.infixType);
        nNode.children.push(termHeap.pop()!);

        let trashOp: Node[] = []; // 只能用 begin 和 end 字段, 并且当 Op 为 blank 时不能使用

        let topOp: Node | undefined;
        // 必须要用 != undefined, 空字符串会被判定为 false
        while ((topOp = operatorHeap.top()) !== undefined && this.operatorTable.eq(topOp.content, lastOp.content)) {
            nNode.content = topOp.content.concat(nNode.content);
            trashOp.push(operatorHeap.pop()!);
            nNode.children.push(termHeap.pop()!);
        }
        nNode.children.reverse();
        nNode.begin = nNode.children.at(0)!.begin;
        nNode.end = nNode.children.at(-1)!.end;
        termHeap.push(nNode);

        let pat = this.operatorTable.getInfixOperator(lastOp.content)!.patterns;
        if (pat.size !== 0 && !pat.has(nNode.content)) {
            result.mergeFailedState();

            result.recoverToSkippable();
            // 如果不符合 pattern 就从后往前依次删除元素, 直到符合 pattern 或成为 blank operator.
            while (nNode.content.length > 0) {
                nNode.content = nNode.content.slice(0, -1);
                nNode.children.splice(-1, 1);
                if (pat.has(nNode.content)) {
                    break;
                }
            }
            for (let n of trashOp) {
                result.addMessage(this.texts.InfixOperatorPatternInvalid, MessageType.error, n);
            }
            return;
        }
    }

    // AnalyseMatrix: skippable | successful
    // 结果是 matrix

    private analyseMatrix(node: Node, index: Ref<number>, endTerm: Set<string>, getCached: getCachedFormula): Result<Node> {
        let result = new Result<Node>(new Node(this.matrixType));
        this.parser.begin("analyse-matrix");
        this.myAnalyseMatrix(node, index, endTerm, getCached, result);
        this.parser.end();
        return result;
    }

    private myAnalyseMatrix(parnode: Node, index: Ref<number>, endTerm: Set<string>, getCached: getCachedFormula, result: Result<Node>) {

        let res: Result<Node>;
        if (this.isEOF(parnode, index, endTerm)) {
            result.mergeSuccessfulState();
            return;
        }

        let node = parnode.children[index.value];
        result.value.begin = node.begin;
        let rowNode = new Node(this.matrixType);
        result.value.children.push(rowNode);

        const end = new Set(["&", ";"]);

        while (true) {

            res = this.analyseSubFormula(parnode, index, endTerm.union(end), getCached);
            result.merge(res);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            rowNode.children.push(res.value);

            if (this.isEOF(parnode, index, endTerm)) {
                rowNode.begin = rowNode.children[0].begin;
                rowNode.end = rowNode.children.at(-1)!.end;
                break;
            }

            node = parnode.children[index.value];
            if (node.type === this.elementType && node.content === "&") {
                result.mergeSuccessfulState();
                result.addHighlight(HighlightType.operator, node);
                index.value++;
            }
            else { // node.content == ";"
                rowNode.begin = rowNode.children[0].begin;
                rowNode.end = rowNode.children.at(-1)!.end;
                rowNode = new Node(this.matrixType);
                result.value.children.push(rowNode);

                result.mergeSuccessfulState();
                result.addHighlight(HighlightType.operator, node);
                index.value++;
            }
        }
        result.value.end = parnode.children[index.value - 1].end;

    }

    // **************** Analysing Term & Operator ****************

    // AnalyseTerm: failing | skippable | successful
    // 结果是 prefix, postfix, element, inline-text, operator-text

    private analyseTerm(parnode: Node, index: Ref<number>, endTerm: Set<string>, getCached: getCachedFormula): Result<Node> {
        let result = new Result<Node>(new Node(this.elementType));
        this.parser.begin("analyse-term");
        this.myAnalyseTerm(parnode, index, result, endTerm, getCached);
        this.parser.end();
        return result;
    }

    private myAnalyseTerm(parnode: Node, index: Ref<number>, result: Result<Node>, endTerm: Set<string>, getCached: getCachedFormula) {

        if (this.isEOF(parnode, index, endTerm)) {
            result.mergeFailedState();
            return;
        }
        let node = parnode.children[index.value];

        if (node.type === this.formulaType) {
            result.ensureMatched();
            getCached().transferTo(result.value);
            index.value++;
        }
        else if (node.type === this.inlineTextType) {
            result.ensureMatched();

            result.mergeSuccessfulState();
            result.addHighlight(HighlightType.string, node);
            index.value++;
            node.transferTo(result.value);
        }
        else if (node.type === this.operatorTextType) {
            result.ensureMatched();

            result.mergeSuccessfulState();
            result.addHighlight(HighlightType.variable, node);
            index.value++;
            node.transferTo(result.value);
        }
        else if (node.type === this.elementType) {
            let infixOp = this.operatorTable.getInfixOperator(node.content);
            let prefixOp = this.operatorTable.getPrefixOperator(node.content);
            if (infixOp !== undefined) {
                result.mergeFailedState();
                return;
            }
            else if (prefixOp !== undefined) {
                result.ensureMatched();
                result.mergeSuccessfulState();

                let prefixNode = this.readOperatorPattern(parnode, index, result, prefixOp.patterns, endTerm, getCached);
                prefixNode.type = this.prefixType;
                prefixNode.transferTo(result.value);
            }
            else {
                result.ensureMatched();
                result.mergeSuccessfulState();
                result.addHighlight(HighlightType.variable, node);
                node.transferTo(result.value);
                index.value++;
            }
        }
        else if (node.type === this.escapeElementType) {
            result.ensureMatched();
            result.mergeSuccessfulState();
            result.addHighlight(HighlightType.variable, node);
            node.transferTo(result.value);
            result.value.type = this.elementType;
            index.value++;
        }
        else {
            result.mergeFailedState();
            return;
        }

        while (true) {
            if (this.isEOF(parnode, index, endTerm)) {
                break;
            }
            node = parnode.children[index.value];
            if (node.type !== this.elementType) {
                break;
            }
            let postfixOp = this.operatorTable.getPostfixOperator(node.content);
            if (postfixOp === undefined) {
                break;
            }
            result.mergeSuccessfulState();
            let postNode = this.readOperatorPattern(parnode, index, result, postfixOp.patterns, endTerm, getCached);
            postNode.type = this.postfixType;
            postNode.children.unshift(result.value);
            result.value = postNode;
        }
    }

    private readOperatorPattern(parnode: Node, index: Ref<number>, result: Result<Node>, patterns: OperatorPattern[], endTerm: Set<string>, getCached: getCachedFormula): Node {

        let node = parnode.children[index.value];
        let nNode = new Node(this.prefixType);

        nNode.begin = node.begin;

        let beginTerm = node; // prefix 的第一个 term 一定能匹配, 报错报这里

        for (let i = 0; i < patterns.length; i++) {
            let res: Result<Node>;
            switch (patterns[i].type) {
                case OperatorPatternType.expression:
                    if (i + 1 < patterns.length && patterns[i + 1].type === OperatorPatternType.enumeration) {
                        res = this.analyseSubFormula(parnode, index, endTerm.union(patterns[i + 1].options), getCached);
                    }
                    else {
                        res = this.analyseSubFormula(parnode, index, endTerm, getCached);
                    }
                    result.merge(res);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    nNode.children.push(res.value);
                    break;

                case OperatorPatternType.term:
                    res = this.analyseTerm(parnode, index, endTerm, getCached);

                    result.merge(res);
                    if (result.shouldStop) { // 只能是遇到了 infix operator 或 EOF
                        result.addMessage(this.texts.PrefixTermMatchFailed, MessageType.error, beginTerm);
                        result.recoverToSkippable();

                        nNode.children.push(new Node(this.prefixType, ""));
                        break;
                    }
                    nNode.children.push(res.value);
                    break;

                case OperatorPatternType.matrix:
                    if (i + 1 < patterns.length && patterns[i + 1].type === OperatorPatternType.enumeration) {
                        res = this.analyseMatrix(parnode, index, endTerm.union(patterns[i + 1].options), getCached);
                    }
                    else {
                        res = this.analyseMatrix(parnode, index, endTerm, getCached);
                    }
                    result.merge(res);
                    if (result.shouldStop) {
                        error(parserExceptionTexts.LogicalUnexpectedStop);
                    }
                    nNode.children.push(res.value);
                    break;

                case OperatorPatternType.enumeration:
                    // 此处 endTerm 必须设为 [], 就近匹配, 例如 (()) 第一个右括号要跟第二个左括号结合
                    if (this.isEOF(parnode, index, new Set())) {
                        result.mergeFailedState();
                        result.recoverToSkippable();
                        result.addMessage(this.texts.PrefixElementEndedUnexpectedly, MessageType.error, beginTerm);
                        break;
                    }
                    node = parnode.children[index.value];

                    if (node.type === this.elementType && patterns[i].options.has(node.content)) {
                        result.mergeSuccessfulState();
                        result.addHighlight(HighlightType.operator, node);
                        index.value++;
                        nNode.content += node.content;
                    }
                    else {
                        result.mergeFailedState();
                        result.recoverToSkippable();
                        result.addMessage(this.texts.PrefixElementMatchFailed, MessageType.error, beginTerm);
                    }
                    break;
            }
        }
        nNode.end = parnode.children[index.value - 1].end;

        return nNode;
    }

    // AnalyseOperator: failing | successful
    // 结果是 element

    private analyseOperator(parnode: Node, index: Ref<number>, endTerm: Set<string>): Result<Node> {
        let result = new Result<Node>(new Node(this.elementType));
        this.parser.begin("analyse-operator");
        this.myAnalyseOperator(parnode, index, endTerm, result);
        this.parser.end();
        return result;
    }

    private myAnalyseOperator(parnode: Node, index: Ref<number>, endTerm: Set<string>, result: Result<Node>) {
        if (this.isEOF(parnode, index, endTerm)) {
            result.mergeFailedState();
            return;
        }
        let node = parnode.children[index.value];

        if (node.type === this.elementType) {
            let infixOp = this.operatorTable.getInfixOperator(node.content);
            if (infixOp !== undefined) {
                result.ensureMatched();

                result.mergeSuccessfulState();
                result.addHighlight(HighlightType.operator, node);
                index.value++;
                node.transferTo(result.value);
            }
        }
        else {
            result.mergeFailedState();
            return;
        }
    }
}
