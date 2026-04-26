import { Config } from "../../../common/config";
import { Path } from "../../../common/file-system/path";
import { ValueResult } from "../../../common/result/analysing-result";
import { HighlightType } from "../../../common/result/highlight";
import { MessageType } from "../../../common/result/message";
import { MatchResult, MergeStrategy, NodeResult } from "../../../common/result/parsing-result";
import { Index, SourceText } from "../../../common/source-text";
import { Node } from "../../../common/syntax-tree/node";
import { Type, TypeTable } from "../../../common/syntax-tree/type-table";
import { error } from "../../../foundation/error";
import { Heap } from "../../../foundation/heap";
import { Ref } from "../../../foundation/ref";
import "../../../foundation/union";
import { ArgumentType, BlockType } from "../../table/block-table";
import { parserExceptionTexts, ParserTexts } from "../../texts";
import { CoreModule } from "../core-module";
import { Module } from "../module";
import { ParserModule } from "../parser-module";
import { OperatorPattern, OperatorPatternType, MathTable } from "./math-table";

type getCachedFormula = () => Node;

export class MathModule extends Module {

    protected parserModule: ParserModule;
    protected coreModule: CoreModule;

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
    mathTable: MathTable;

    constructor(config: Config, path: Path, texts: ParserTexts, typeTable: TypeTable, sourceText: SourceText, parserModule: ParserModule, coreModule: CoreModule) {
        super(config, path, texts, typeTable, sourceText);
        this.parserModule = parserModule;
        this.coreModule = coreModule;

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
        this.parserModule.blockTable.add("formula", this.formulaBlockHandler, this, {
            type: BlockType.basic,
            argumentOptions: new Map([
                ["style", { type: ArgumentType.enumeration, options: ["numbered", "unnumbered"], default: "unnumbered" }],
                ["line", { type: ArgumentType.enumeration, options: ["single", "multi"], default: "single" }],
            ]),
            allowReference: true
        });

        // Init insertion handler
        this.parserModule.insertionTable.add("/", this.formulaInsertionHandler, this, {
            onlyInText: false
        });

        // **************** Notations, Symbols & Operators ****************

        // Init from math.json
        let json = this.config.get("math");
        let mathConfig: {
            SymbolsAndNotations: string[][],
            Notations: string[],
            Symbols: string[],
            PrefixOperator: { pattern: { type: string, options: string[] }[] }[],
            InfixOperator: { symbols: string[], pattern: string[] }[],
            PostfixOperator: { pattern: { type: string, options: string[] }[] }[],
        } = JSON.parse(json);

        this.mathTable = new MathTable();
        this.mathTable.init(mathConfig);
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
        return this.coreModule.prepareMatchBlock(this.formulaType, "formula-block-handler", args, this.myFormulaBlockHandler, this, (args, result) => this.cleanupInfixOperator(result.analysedNode));
    }

    private myFormulaBlockHandler(args: Node, result: NodeResult) {
        let multiline = (this.coreModule.getArgument(args, "line") === "multi");
        result.merge(this.matchFormula("]", multiline), MergeStrategy.Transfer, MergeStrategy.AppendChild);
    }

    // FormulaInsertionHandler: failing | matched | skippable | successful

    private formulaInsertionHandler(): NodeResult {
        return this.coreModule.prepareMatch(this.formulaType, "formula-insertion-handler", this.myFormulaInsertionHandler, this, result => this.cleanupInfixOperator(result.analysedNode));
    }

    private myFormulaInsertionHandler(result: NodeResult) {

        let valRes: MatchResult<null>;

        let beginIndex = this.sourceText.mark();
        valRes = result.merge(this.parserModule.match("/"));
        if (result.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }
        result.highlightList.add(HighlightType.operator, valRes.range);

        result.merge(this.matchFormula("/", false), MergeStrategy.Transfer, MergeStrategy.AppendChild);
        if (result.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }

        valRes = result.merge(this.parserModule.match("/"));
        if (result.shouldStop) {
            result.messageList.add(this.texts.InlineFormulaMissingClosingSlash, this.sourceText.computeRange(beginIndex), MessageType.error);

            result.recoverToSkippable();
            return;
        }
        result.highlightList.add(HighlightType.operator, valRes.range);
    }

    // **************** Matching ****************

    // Part 1: scan the text and construct the syntax tree. This part will use types of node as follows:
    // formula
    // inlineText
    // element
    // escapeElement

    // MatchElements: skippable | successful

    private matchFormula(endWith: string = "]", multiline: boolean): NodeResult {
        return this.coreModule.prepareMatch(this.formulaType, "elements", this.myMatchFormula.bind(this, endWith), this, this.analyseFormula.bind(this, multiline));
    }

    private myMatchFormula(endWith: string, result: NodeResult) {

        let beginIndex: Index;

        let res: MatchResult<null>;
        let valRes: MatchResult<string>;
        let nodeRes: NodeResult;

        while (true) {
            beginIndex = this.sourceText.mark();

            if (this.sourceText.isEOF()) {
                break;
            }

            else if ((nodeRes = this.matchEscapeElement()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.None);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if (this.parserModule.isMultilineBlankGtOne()) {
                break;
            }

            // endWith 优先级比 escape element 低
            else if (this.sourceText.isText(endWith)) {
                break;
            }

            else if ((res = this.parserModule.matchMultilineBlankLeqOne()).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((res = this.parserModule.match("[")).matched) {
                result.merge(res);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.highlightList.add(HighlightType.operator, res.range);

                nodeRes = result.merge(this.matchFormula("]", false), MergeStrategy.AppendChild, MergeStrategy.AppendChild);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }

                res = result.merge(this.parserModule.match("]"));
                if (result.shouldStop) {
                    result.messageList.add(this.texts.FormulaMissingRightBracket, this.sourceText.computeRange(beginIndex), MessageType.error);
                    result.recoverToSkippable();
                    return;
                }
                result.highlightList.add(HighlightType.operator, res.range);
            }

            else if ((nodeRes = this.matchInlineText()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.None);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchOperatorText()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.None);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if ((nodeRes = this.matchElement()).matched) {
                result.merge(nodeRes, MergeStrategy.AppendChild, MergeStrategy.None);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }

            else if (this.sourceText.isName()) {
                // 如果 notation 不存在就当作单字读入
                while (true) {
                    beginIndex = this.sourceText.mark();
                    if (this.sourceText.isName()) {
                        valRes = result.merge(this.parserModule.matchChar());
                        if (result.shouldStop) {
                            error(parserExceptionTexts.LogicalUnexpectedStop);
                        }
                        if (!this.mathTable.notations.has(valRes.value)) {
                            // error(parserExceptionTexts.LogicalzMatchFormulaNameCharFailed);
                        }
                        result.addChild(this.elementType, valRes.range, valRes.value);
                    }
                    else {
                        break;
                    }
                }
            }

            else if ((valRes = this.parserModule.matchChar()).matched) {
                result.merge(valRes);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
                result.mergeFailedState();
                result.messageList.add(this.texts.FormulaUnrecognizedCharacter.format(valRes.value), valRes.range, MessageType.error);

                result.recoverToSkippable();
            }

            else {
                error(parserExceptionTexts.LogicalUnexpectedBranch);
            }
        }
    }

    // MatchElement: failing | successful

    private matchElement(): NodeResult {
        return this.coreModule.prepareMatch(this.elementType, "element", this.myMatchElement, this);
    }

    private myMatchElement(result: NodeResult) {

        let valRes: MatchResult<string>;

        let name = this.mathTable.findSymbol(this.sourceText.isOneOfTexts, this.sourceText);
        if (name !== undefined) { // 先 symbol, 有些多字符的 symbol 会含有字母, 如 a dot.
            result.merge(this.parserModule.match(name));
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.setNodeContent(name);
            if (!this.mathTable.symbols.has(name)) {
                result.mergeFailedState();
                return;
            }
        }
        else if ((valRes = this.parserModule.matchName()).matched) { // notation
            result.merge(valRes);
            if (result.shouldStop) {
                error(parserExceptionTexts.LogicalUnexpectedStop);
            }
            result.setNodeContent(valRes.value);
            if (!this.mathTable.notations.has(result.node.content)) {
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
        return this.coreModule.prepareMatch(this.escapeElementType, "escape-element", this.myMatchEscapeElement, this);
    }

    private myMatchEscapeElement(result: NodeResult) {

        let res: MatchResult<null>;
        let nodeRes: NodeResult;

        if ((res = this.parserModule.match("@")).matched) {
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
                result.messageList.add(this.texts.InlineMathAtMustFollowElement, res.range, MessageType.error);
                return;
            }
            result.setNodeContent(nodeRes.node.content);
        }
        else if ((res = this.parserModule.match("\\")).matched) {
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
                result.messageList.add(this.texts.InlineMathBackslashMustFollowElement, res.range, MessageType.error);
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
        return this.coreModule.prepareMatch(this.inlineTextType, "inline-text", this.myMatchRawInlineText.bind(this, '"'), this);
    }

    // MatchOperatorText: failing | skippable | successful

    private matchOperatorText(): NodeResult {
        return this.coreModule.prepareMatch(this.operatorTextType, "operator-text", this.myMatchRawInlineText.bind(this, '`'), this);
    }

    private myMatchRawInlineText(marker: string, result: NodeResult) {

        let valRes: MatchResult<string>;

        let beginIndex = this.sourceText.mark();
        result.merge(this.parserModule.match(marker));
        if (result.shouldStop) {
            return;
        }
        result.ensureMatched();

        while (true) {
            if (this.sourceText.isText(marker)) {
                break;
            }
            if (this.sourceText.isEOF()) {
                break;
            }
            else if (this.sourceText.isNewline()) {
                result.mergeFailedState();
                result.recoverToSkippable();
                result.messageList.add(this.texts.FormulaInlineTextEndedUnexpectedly, this.sourceText.computeRange(beginIndex), MessageType.error);
                return;
            }
            else if ((valRes = this.parserModule.matchChar()).matched) {
                result.merge(valRes);
                result.appendNodeContent(valRes.value);
                if (result.shouldStop) {
                    error(parserExceptionTexts.LogicalUnexpectedStop);
                }
            }
            else {
                error(parserExceptionTexts.LogicalUnexpectedBranch);
            }
        }

        result.merge(this.parserModule.match(marker));
        if (result.shouldStop) {
            result.recoverToSkippable();
            result.messageList.add(this.texts.FormulaInlineTextEndedUnexpectedly, this.sourceText.computeRange(beginIndex), MessageType.error);
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
    // postfix

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
        let res: ValueResult<Node>;

        let cacheIndex = -1;
        let getCached = () => {
            cacheIndex++;
            if (cacheIndex >= result.analysedNode.children.length) {
                error(parserExceptionTexts.LogicalAnalyseFormulaCacheOutOfBounds);
            }
            return result.analysedNode.children[cacheIndex];
        }

        if (multiline) {
            this.parserModule.begin("analyse-multiline-formula");
            res = this.analyseMatrix(result.node, index, new Set(), getCached);
            this.parserModule.end();
        }
        else {
            this.parserModule.begin("analyse-formula");
            res = this.analyseSubFormula(result.node, index, new Set(), getCached);
            this.parserModule.end();
        }
        result.merge(res);
        result.highlightList.push(...res.highlightList.items);;
        result.analysedNode.children.length = 0;
        res.value.transferTo(result.analysedNode);
        if (result.shouldStop) {
            error(parserExceptionTexts.LogicalUnexpectedStop);
        }
    }

    // AnalyseSubFormula: skippable | successful
    // 分析一个 formula node 的其中一段, 结果是 infix, prefix, element, inline-text, operator-text

    private analyseSubFormula(parnode: Node, index: Ref<number>, endTerm: Set<string>, getCached: getCachedFormula): ValueResult<Node> {
        let result = new ValueResult<Node>(new Node(this.infixType, this.sourceText.emptyRange));
        this.parserModule.begin("analyse-sub-formula");
        this.myAnalyseSubFormula(parnode, index, endTerm, getCached, result);
        this.parserModule.end();
        return result;
    }

    private myAnalyseSubFormula(parnode: Node, index: Ref<number>, endTerm: Set<string>, getCached: getCachedFormula, result: ValueResult<Node>) {

        let termHeap = new Heap<Node>();
        let operatorHeap = new Heap<Node>();

        let res: ValueResult<Node>;
        let curOp: Node;

        let hasInfixOperator = true;
        let constructingBlankOp = false;
        let constructing = false;

        while (true) {
            if (constructingBlankOp) {
                // cur operator = Blank operator
                let lastOp = operatorHeap.top();
                //  == undefined 必须用, 空串会被判为false
                if (lastOp === undefined || this.mathTable.leq(lastOp.content, "")) {
                    operatorHeap.push(new Node(this.elementType, this.sourceText.emptyRange));
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
                if (lastOp === undefined || this.mathTable.leq(lastOp.content, curOp!.content)) {
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
                    result.messageList.add(this.texts.ExpressionMissingLastTerm, trashOp.range, MessageType.error);
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
                    if (lastOp === undefined || this.mathTable.leq(lastOp.content, "")) {
                        operatorHeap.push(new Node(this.elementType, this.sourceText.emptyRange));
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
                    result.messageList.add(this.texts.InfixOperatorRepeated, res.value.range, MessageType.error);
                    // 直接丢弃这一项
                    continue;
                }

                let lastOp = operatorHeap.top();
                curOp = res.value;
                //  == undefined 必须用, 空串会被判为false
                if (lastOp === undefined || this.mathTable.leq(lastOp.content, curOp.content)) {
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

    private construct(termHeap: Heap<Node>, operatorHeap: Heap<Node>, result: ValueResult<Node>) {

        let lastOp = operatorHeap.top()!;

        let nNode = new Node(this.infixType, this.sourceText.emptyRange);
        nNode.children.push(termHeap.pop()!);

        let trashOp: Node[] = []; // 需要被丢弃的 operator, 用于错误提示

        let topOp: Node | undefined;
        // 必须要用 != undefined, 空字符串会被判定为 false
        while ((topOp = operatorHeap.top()) !== undefined && this.mathTable.eq(topOp.content, lastOp.content)) {
            nNode.content = topOp.content.concat(nNode.content);
            trashOp.push(operatorHeap.pop()!);
            nNode.children.push(termHeap.pop()!);
        }
        nNode.children.reverse();
        nNode.range = this.sourceText.unionRange(nNode.children[0].range, nNode.children.at(-1)!.range);
        termHeap.push(nNode);

        let pat = this.mathTable.getInfixOperator(lastOp.content)!.patterns;
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
                if (n.content !== "") {
                    result.messageList.add(this.texts.InfixOperatorPatternInvalid, n.range, MessageType.error);
                }
            }
            return;
        }
    }

    // AnalyseMatrix: skippable | successful
    // 结果是 matrix

    private analyseMatrix(node: Node, index: Ref<number>, endTerm: Set<string>, getCached: getCachedFormula): ValueResult<Node> {
        let result = new ValueResult<Node>(new Node(this.matrixType, this.sourceText.emptyRange));
        this.parserModule.begin("analyse-matrix");
        this.myAnalyseMatrix(node, index, endTerm, getCached, result);
        this.parserModule.end();
        return result;
    }

    private myAnalyseMatrix(parnode: Node, index: Ref<number>, endTerm: Set<string>, getCached: getCachedFormula, result: ValueResult<Node>) {

        let res: ValueResult<Node>;

        if (this.isEOF(parnode, index, endTerm)) {
            result.mergeSuccessfulState();
            return;
        }

        let node = parnode.children[index.value];
        let rowNode = new Node(this.matrixType, this.sourceText.emptyRange);
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
                rowNode.range = this.sourceText.unionRange(rowNode.children[0].range, rowNode.children.at(-1)!.range);
                break;
            }

            node = parnode.children[index.value];
            if (node.type === this.elementType && node.content === "&") {
                result.mergeSuccessfulState();
                result.highlightList.add(HighlightType.operator, node.range);
                index.value++;
            }
            else { // node.content == ";"
                rowNode.range = this.sourceText.unionRange(rowNode.children[0].range, rowNode.children.at(-1)!.range);
                rowNode = new Node(this.matrixType, this.sourceText.emptyRange);
                result.value.children.push(rowNode);

                result.mergeSuccessfulState();
                result.highlightList.add(HighlightType.operator, node.range);
                index.value++;
            }
        }
        result.value.range = this.sourceText.unionRange(result.value.children[0].range, result.value.children.at(-1)!.range);
    }

    // **************** Analysing Term & Operator ****************

    // AnalyseTerm: failing | skippable | successful
    // 结果是 prefix, postfix, element, inline-text, operator-text

    private analyseTerm(parnode: Node, index: Ref<number>, endTerm: Set<string>, getCached: getCachedFormula): ValueResult<Node> {
        let result = new ValueResult<Node>(new Node(this.elementType, this.sourceText.emptyRange));
        this.parserModule.begin("analyse-term");
        this.myAnalyseTerm(parnode, index, result, endTerm, getCached);
        this.parserModule.end();
        return result;
    }

    private myAnalyseTerm(parnode: Node, index: Ref<number>, result: ValueResult<Node>, endTerm: Set<string>, getCached: getCachedFormula) {

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
            result.highlightList.add(HighlightType.string, node.range);
            index.value++;
            node.transferTo(result.value);
        }
        else if (node.type === this.operatorTextType) {
            result.ensureMatched();

            result.mergeSuccessfulState();
            result.highlightList.add(HighlightType.variable, node.range);
            index.value++;
            node.transferTo(result.value);
        }
        else if (node.type === this.elementType) {
            let infixOp = this.mathTable.getInfixOperator(node.content);
            let prefixOp = this.mathTable.getPrefixOperator(node.content);
            if (infixOp !== undefined) {
                result.mergeFailedState();
                return;
            }
            else if (prefixOp !== undefined) {
                result.ensureMatched();

                result.mergeSuccessfulState();
                let prefixNode = this.readOperatorPattern(parnode, index, result, prefixOp.pattern, endTerm, getCached);
                prefixNode.type = this.prefixType;
                prefixNode.transferTo(result.value);
            }
            else {
                result.ensureMatched();

                result.mergeSuccessfulState();
                result.highlightList.add(HighlightType.variable, node.range);
                node.transferTo(result.value);
                index.value++;
            }
        }
        else if (node.type === this.escapeElementType) {
            result.ensureMatched();

            result.mergeSuccessfulState();
            result.highlightList.add(HighlightType.variable, node.range);
            node.transferTo(result.value);
            result.value.type = this.elementType;
            index.value++;
        }
        else {
            result.mergeFailedState();
            return;
        }

        // postfix operator
        while (true) {
            if (this.isEOF(parnode, index, endTerm)) {
                break;
            }
            node = parnode.children[index.value];
            if (node.type !== this.elementType) {
                break;
            }
            let postfixOp = this.mathTable.getPostfixOperator(node.content);
            if (postfixOp === undefined) {
                break;
            }
            result.mergeSuccessfulState();

            let postNode = this.readOperatorPattern(parnode, index, result, postfixOp.pattern, endTerm, getCached);
            postNode.type = this.postfixType;
            postNode.children.unshift(result.value);
            postNode.range = this.sourceText.unionRange(result.value.range, postNode.range);
            result.value = postNode;
        }
    }

    private readOperatorPattern(parnode: Node, index: Ref<number>, result: ValueResult<Node>, patterns: OperatorPattern[], endTerm: Set<string>, getCached: getCachedFormula): Node {

        let node = parnode.children[index.value];
        let nNode = new Node(this.prefixType, node.range);

        let beginTerm = node; // prefix 的第一个 term 一定能匹配, 报错报这里

        for (let i = 0; i < patterns.length; i++) {
            let res: ValueResult<Node>;
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
                    nNode.range = this.sourceText.unionRange(nNode.range, res.value.range);
                    break;

                case OperatorPatternType.term:
                    res = this.analyseTerm(parnode, index, endTerm, getCached);

                    result.merge(res);
                    if (result.shouldStop) { // 只能是遇到了 infix operator 或 EOF
                        result.messageList.add(this.texts.PrefixTermMatchFailed, beginTerm.range, MessageType.error);
                        result.recoverToSkippable();

                        nNode.children.push(new Node(this.prefixType, this.sourceText.emptyRange));
                        break;
                    }
                    nNode.children.push(res.value);
                    nNode.range = this.sourceText.unionRange(nNode.range, res.value.range);
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
                    nNode.range = this.sourceText.unionRange(nNode.range, res.value.range);
                    break;

                case OperatorPatternType.enumeration:
                    // 此处 endTerm 必须设为 [], 就近匹配, 例如 (()) 第一个右括号要跟第二个左括号结合
                    if (this.isEOF(parnode, index, new Set())) {
                        result.mergeFailedState();
                        result.recoverToSkippable();
                        result.messageList.add(this.texts.PrefixElementEndedUnexpectedly, beginTerm.range, MessageType.error);
                        break;
                    }
                    node = parnode.children[index.value];

                    if (node.type === this.elementType && patterns[i].options.has(node.content)) {
                        result.mergeSuccessfulState();
                        result.highlightList.add(HighlightType.operator, node.range);
                        index.value++;
                        nNode.content += node.content;
                        nNode.range = this.sourceText.unionRange(nNode.range, node.range);
                    }
                    else {
                        result.mergeFailedState();
                        result.recoverToSkippable();
                        result.messageList.add(this.texts.PrefixElementMatchFailed, beginTerm.range, MessageType.error);
                    }
                    break;
            }
        }

        return nNode;
    }

    // AnalyseOperator: failing | successful
    // 结果是 element

    private analyseOperator(parnode: Node, index: Ref<number>, endTerm: Set<string>): ValueResult<Node> {
        let result = new ValueResult<Node>(new Node(this.elementType, this.sourceText.emptyRange));
        this.parserModule.begin("analyse-operator");
        this.myAnalyseOperator(parnode, index, endTerm, result);
        this.parserModule.end();
        return result;
    }

    private myAnalyseOperator(parnode: Node, index: Ref<number>, endTerm: Set<string>, result: ValueResult<Node>) {
        if (this.isEOF(parnode, index, endTerm)) {
            result.mergeFailedState();
            return;
        }
        let node = parnode.children[index.value];

        if (node.type === this.elementType) {
            let infixOp = this.mathTable.getInfixOperator(node.content);
            if (infixOp !== undefined) {
                result.ensureMatched();

                result.mergeSuccessfulState();
                result.highlightList.add(HighlightType.operator, node.range);
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
