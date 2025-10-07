import { Node } from "../../sytnax-tree/node";
import { Type } from "../../sytnax-tree/type";
import { Module } from "../module";
import { MatchResult, Parser } from "../parser";
import { BasicResult, HighlightType, NodeResult, Result, ResultState } from "../result";
import { MessageType } from "../../foundation/message";
import { Message } from "../../foundation/message";
import { InfixOperator, OperatorTable, OperatorType, PrefixOperator, PrefixOperatorPattern, PrefixOperatorType } from "./operator-table";
import { Heap } from "../../foundation/heap"
import { Ref } from "../../foundation/ref";
import { BlockOption, ArgumentType, BlockType } from "../block-table";
import "../../foundation/union"
import { LixError } from "../../foundation/error";


export class Math extends Module {

    // Types of syntax tree node

    formulaType: Type;
    //definitionType: Type;

    elementType: Type;
    escapeElementType: Type;
    inlineTextType: Type;
    infixType: Type;
    prefixType: Type;
    matrixType: Type;

    // **************** Operator, symbols & notations ****************

    operatorTable: OperatorTable; // 参与表达式解析的符号, 包括 PrefixOperator 字段和 InfixOperator 字段
    notationsToUnicodeSymbols: Map<string, string>; // Unicode 符号和记号, UnicodeSymbolsAndNotations 字段
    symbols: Set<string>; // 符号, 包括 Symbols 字段 (ASCII 符号) 和 UnicodeSymbolsAndNotations 字段的 Unicode 符号部分
    notations: Set<string>; // 字母记号, 包括 Notations 字段和 UnicodeSymbolsAndNotations 字段的字母记号部分

    constructor(parser: Parser) {
        super(parser);

        // **************** Types ****************

        this.formulaType = this.parser.typeTable.add("formula");
        this.elementType = this.parser.typeTable.add("element");
        this.escapeElementType = this.parser.typeTable.add("escape-element");
        //this.definitionType = this.parser.typeTable.add("definition");
        this.inlineTextType = this.parser.typeTable.add("inline-text");
        this.infixType = this.parser.typeTable.add("infix");
        this.prefixType = this.parser.typeTable.add("prefix");
        this.matrixType = this.parser.typeTable.add("matrix");

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

        this.notations = new Set();
        this.symbols = new Set();
        this.notationsToUnicodeSymbols = new Map();

        // Init from math.json
        let json = parser.configs.get("math");
        let config: {
            UnicodeSymbolsAndNotations: string[][],
            Notations: string[],
            Symbols: string,
            PrefixOperator: { type: string, options: string[] }[][],
            InfixOperator: { symbols: string, patterns: string[] }[]
        } = JSON.parse(json);

        // 字母记号
        for (let notation of config.Notations) {
            this.notations.add(notation);
        }

        // ASCII 符号
        for (let sym of config.Symbols) {
            this.symbols.add(sym);
        }

        // Unicode 符号
        for (let tmp of config.UnicodeSymbolsAndNotations) {
            this.symbols.add(tmp[0]);
            this.notations.add(tmp[1]);
            this.notationsToUnicodeSymbols.set(tmp[1], tmp[0]);
        }

        this.operatorTable = new OperatorTable();

        // Prefix operator
        for (let prefix of config.PrefixOperator) {
            let patterns: PrefixOperatorPattern[] = [];
            for(let pattern of prefix) {
                switch(pattern.type) {
                    case "enumeration":
                        patterns.push(new PrefixOperatorPattern(PrefixOperatorType.enumeration, new Set(pattern.options)));
                        break;
                    case "term":
                        patterns.push(new PrefixOperatorPattern(PrefixOperatorType.term, new Set(pattern.options)));
                        break;
                    case "expression":
                        patterns.push(new PrefixOperatorPattern(PrefixOperatorType.expression, new Set(pattern.options)));
                        break;
                    case "matrix":
                        patterns.push(new PrefixOperatorPattern(PrefixOperatorType.matrix, new Set(pattern.options)));
                        break;
                    default:
                        throw new LixError("Wrong prefix operator type.");
                }
            }
            this.operatorTable.addPrefixOperator(patterns);
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

    // **************** Init & handler ****************

    init() {
    }

    // FormulaBlockHandler: failing | skippable | successful

    formulaBlockHandler(args: Node): NodeResult {
        let multiline = (this.parser.getArgument(args, "line") === "multi");
        return this.parser.prepareMatch(this.formulaType, "formula-block-handler", this.myFormulaBlockHandler.bind(this, args), this, this.analyse.bind(this, multiline));
    }

    private myFormulaBlockHandler(args: Node, result: NodeResult) {
        let nodeRes = this.matchElements("]", false /* true */);
        result.merge(nodeRes);
        nodeRes.node.moveTo(result.node);
    }

    // FormulaInsertionHandler: failing | matched | skippable | successful

    formulaInsertionHandler(): MatchResult {
        return this.parser.prepareMatch(this.formulaType, "formula-insertion-handler", this.myFormulaInsertionHandler, this, this.analyse.bind(this, false));
    }

    private myFormulaInsertionHandler(result: NodeResult) {
        result.merge(this.parser.match("/"));
        if (result.shouldTerminate) {
            return;
        }
        result.addHighlight(HighlightType.operator, this.parser.index);
        result.GuaranteeMatched();

        let nodeRes = this.matchElements("/", false);
        result.merge(nodeRes);
        // 不会失败
        nodeRes.node.moveTo(result.node);

        result.merge(this.parser.match("/"));
        if (result.shouldTerminate) {
            result.addMessage(`Missing '/' in inline formula.`, MessageType.error, this.parser.index);
            result.promoteToSkippable();
            return;
        }
        result.addHighlight(HighlightType.operator, this.parser.index);
    }

    // **************** Skipping ****************

    // skipByBracketsEndWith(endWith: string) {
    //     let count = 1;
    //     while (true) {
    //         if (this.parser.isEOF()) {
    //             return;
    //         }
    //         else if (this.parser.is("[")) {
    //             count++;
    //         }
    //         else if (count === 1 && this.parser.is(endWith)) {
    //             count--;
    //             this.parser.move();
    //             break;
    //         }
    //         else if (count !== 1 && this.parser.is("]")) {
    //             count--;
    //         }
    //         this.parser.move();
    //     }
    // }

    // **************** Matching ****************

    // Part 1: scan the text and construct the syntax tree. This part will use types of node as follows:
    // formula / definition
    // inlineText
    // element
    // escapeElement

    static nameChar = /[0-9a-zA-Z]/;

    // MatchElements: skippable | successful

    matchElements(endWith: string = "]", hasDefinition = false): NodeResult {
        return this.parser.prepareMatch(this.formulaType, "elements", this.myMatchElements.bind(this, endWith, hasDefinition), this);
    }

    private myMatchElements(endWith: string, hasDefinition: boolean, result: NodeResult) {
        let node = result.node;

        let blkRes: Result<number>;
        let valRes: Result<string>;
        let nodeRes: NodeResult;
        let symRes: BasicResult;

        result.mergeState(ResultState.successful);

        while (true) {
            if (this.parser.isEOF()) {
                break;
            }

            else if ((nodeRes = this.matchEscapeElement()).matched) {
                result.merge(nodeRes);
                // 不会失败
                node.children.push(nodeRes.node);
            }

            // endWith 优先级比 escape element 低
            else if (this.parser.is(endWith)) {
                break;
            }
            else if (this.parser.isMultilineBlankGtOne()) {
                break;
            }

            else if ((blkRes = this.parser.matchMultilineBlank()).matched) {
                result.merge(blkRes);
            }

            else if ((symRes = this.parser.match("[")).matched) {
                result.merge(symRes);

                nodeRes = this.matchElements("]", false);
                result.merge(nodeRes);
                // 不会失败
                // if (result.shouldTerminate) {
                //     return;
                // }
                node.children.push(nodeRes.node);

                result.merge(this.parser.match("]"));
                if (result.shouldTerminate) {
                    result.addMessage(`Missing ']' in formula.`, MessageType.error, this.parser.index);
                    result.promoteToSkippable();
                    return;
                }
            }

            else if (hasDefinition && (symRes = this.parser.match("`")).matched) {
                result.merge(symRes);
                result.addHighlight(HighlightType.operator, this.parser.index);

                nodeRes = this.matchElements("`", false);
                result.merge(nodeRes);
                // 不会失败
                //nodeRes.node.type = this.definitionType;
                node.children.push(nodeRes.node);

                result.merge(this.parser.match("`"));
                if (result.shouldTerminate) {
                    result.addMessage(`Missing '\`' in formula.`, MessageType.error, this.parser.index);
                    result.promoteToSkippable();
                    return;
                }
                result.addHighlight(HighlightType.operator, this.parser.index);
            }

            else if ((nodeRes = this.matchInlineText()).matched) {
                result.merge(nodeRes);
                // 不会失败
                node.children.push(nodeRes.node);
            }

            else if ((nodeRes = this.matchElement()).matched) {
                result.merge(nodeRes);
                // 不会失败
                node.children.push(nodeRes.node);
            }

            else if (this.parser.is(Math.nameChar)) { // 如果 notation 不存在就当作单字读入
                while (true) {
                    if (this.parser.is(Math.nameChar)) {
                        valRes = this.parser.matchChar();
                        result.merge(valRes);
                        // 不会失败
                        node.children.push(new Node(this.elementType, valRes.value, [], this.parser.index - 1, this.parser.index));
                    }
                    else {
                        break;
                    }
                }
            }

            else {
                result.mergeState(ResultState.skippable);
                result.addMessage(`Unrecognizable character '${this.parser.curUnicodeChar()}' in formula.`, MessageType.error, this.parser.index);
                this.parser.moveUnicode();
            }
        }
    }

    // MatchElement: failing | successful

    matchElement(): NodeResult {
        return this.parser.prepareMatch(this.elementType, "element", this.myMatchElement, this);
    }

    private myMatchElement(result: NodeResult) {

        let node = result.node;
        let valRes: Result<string>;

        if (this.parser.is(Math.nameChar)) {
            while (true) {
                if (this.parser.is(Math.nameChar)) {
                    valRes = this.parser.matchChar();
                    result.merge(valRes);
                    node.content += valRes.value;
                }
                else {
                    break;
                }
            }
            if (!this.notations.has(node.content)) {
                result.mergeState(ResultState.failing);
                return;
            }
        }
        else {
            // 数学的特殊符号属于 0x10000 平面, ts 使用 utf16 编码, 因而占两个字符的位置, 要使用 matchUnicodeChar
            valRes = this.parser.matchUnicodeChar();
            result.merge(valRes);
            if(result.shouldTerminate) { // EOF
                return;
            }
            if (!this.symbols.has(valRes.value)) {
                result.mergeState(ResultState.failing);
                return;
            }
            node.content = valRes.value;
        }
    }

    // MatchEscapeElement: failing | skippable | successful

    matchEscapeElement(): NodeResult {
        return this.parser.prepareMatch(this.escapeElementType, "escape-element", this.myMatchEscapeElement, this);
    }

    private myMatchEscapeElement(result: NodeResult) {

        let nodeRes: NodeResult;
        let res: BasicResult;

        if((res = this.parser.match("@")).matched) {
            result.merge(res);
            result.GuaranteeMatched();
    
            nodeRes = this.matchElement();
            result.merge(nodeRes);
            if (result.shouldTerminate) {
                result.promoteToSkippable();
    
                result.node.type = this.elementType;
                result.node.content = "@";
                result.addMessage("'@' must be followed by an element.", MessageType.error, this.parser.index);
                return;
            }
            result.node.content = nodeRes.node.content;
        }
        else if((res = this.parser.match("\\")).matched) {
            result.merge(res);
            result.GuaranteeMatched();
            result.node.type = this.elementType;
    
            nodeRes = this.matchElement();
            result.merge(nodeRes);
            if (result.shouldTerminate) {
                result.promoteToSkippable();
    
                result.node.content = "\\";
                result.addMessage("'\\' must be followed by an element.", MessageType.error, this.parser.index);
                return;
            }
            result.node.content = nodeRes.node.content;
        }
        else {
            result.addMessage("Missing '@' or '\\' in formula.", MessageType.error, this.parser.index);
        }
    }

    // MatchInlineText: failing | skippable | successful

    matchInlineText(): NodeResult {
        return this.parser.prepareMatch(this.inlineTextType, "inline-text", this.myMatchInlineText, this);
    }

    private myMatchInlineText(result: NodeResult) {

        let node = result.node;

        result.merge(this.parser.match("\""));
        if (result.shouldTerminate) {
            result.addMessage("Missing '\"' in formula.", MessageType.error, this.parser.index);
            return;
        }
        result.GuaranteeMatched();

        let res: BasicResult;
        let valRes: Result<string>;

        while (true) {
            if ((res = this.parser.match("\"")).matched) {
                result.merge(res);
                break;
            }
            else if(this.parser.isMultilineBlankGtOne()) {
                result.addMessage("Formula inline text ended abruptly.", MessageType.error, this.parser.index);
                result.mergeState(ResultState.skippable);
                return;
            }
            else {
                valRes = this.parser.matchChar();
                result.merge(valRes);
                if (result.shouldTerminate) {
                    result.promoteToSkippable();
                    result.addMessage("Formula inline text ended abruptly.", MessageType.error, this.parser.index);
                    return;
                }
                node.content += valRes.value;
            }
        }
    }
    
    // **************** Analysing ****************

    // Part 2: analyse the syntax tree that constructed in Part 1, replace definition nodes with its content, and find out the correct math label function to handle the formula nodes. This part will use types of node as follows:
    // formula / definition
    // element
    // inline-text
    // matrix
    // infix
    // prefix

    analyse(multiline: boolean, result: NodeResult) {
        // match 不会失败
        /*
        // filter the definition, i.e. the chars surrounded by the ' '.
        for (let subnode of node.children) {
            if (subnode.type === this.definitionType) {
                result.mergeState(ResultState.successful);

                if (subnode.children.length < 2) {
                    result.mergeState(ResultState.failing);
                    result.promoteToSkippable();
                    result.addMessage("Definition uncompleted."), MessageType.error, this.parser.index);
                    continue;
                }
                if (subnode.children[0].type != this.elementType) {
                    result.mergeState(ResultState.failing);
                    result.promoteToSkippable();
                    result.addMessage("Definition element unfounded."), MessageType.error, this.parser.index);
                    continue;
                }
                if (subnode.children[1].type != this.elementType || subnode.children[1].content != "↦") {
                    result.mergeState(ResultState.failing);
                    result.promoteToSkippable();
                    result.addMessage("Symbol '↦' unfounded."), MessageType.error, this.parser.index);
                    continue;
                }

                result.highlights.push({ begin: subnode.begin, end: subnode.begin + 1, type: 3 });
                result.highlights.push({ begin: subnode.end, end: subnode.end + 1, type: 3 });

                let newNode = new Node(this.formulaType);
                for (let i = 2; i < subnode.children.length; i++) {
                    newNode.children.push(Node.clone(subnode.children[i]));
                }

                this.blockHandlerTable.addDefinition(subnode.children[0].content, newNode);
            }

        }

        for (let i = node.children.length - 1; i >= 0; i--) {
            if (node.children[i].type === this.definitionType) {
                node.children.splice(i, 1);
            }
        }
            */

        // analyse 
        let analRes = this.analyseFormula(result.node, multiline);
        result.merge(analRes);
        result.analysedNode.children.push(analRes.value);
        result.analysedNode.type = this.formulaType;
        this.cleanupInfixOperator(result.analysedNode);
    }

    // 合并 a[bc[d]e] 这种表达式为 abcde
    cleanupInfixOperator(node: Node) {
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

    // **************** Analysing Formula ****************

    isEOF(node: Node, index: Ref<number>, endTerm: Set<string>): boolean {
        if (index.value === node.children.length) {
            return true;
        }
        let child = node.children[index.value];
        if (child.type === this.elementType && endTerm.has(child.content)) {
            return true;
        }
        return false;
    }

    skipToEndTerm(node: Node, index: Ref<number>, endTerm: Set<string>) {
        while(true) {
            if(this.isEOF(node, index, endTerm)) {
                return;
            }
            index.value++;
        }
    }

    skipOneTerm(node: Node, index: Ref<number>, endTerm: Set<string>) {
        if(this.isEOF(node, index, endTerm)) {
            return;
        }
        index.value++;
    }

    // AnalyseFormula: skippable | successful
    // 分析一个 formula node 的所有子节点, 结果是 infix 或 element, inline-text, prefix, 位于 result.value

    analyseFormula(node: Node, multiline: boolean = false): Result<Node> {
        let index = new Ref<number>(0);
        if(multiline) {
            let result = new Result<Node>(new Node(this.matrixType));
            this.parser.begin("analyse-multiline-formula");
            this.myAnalyseMatrix(node, index, new Set(), result);
            this.parser.end();
            return result;
        }
        else {
            let result = new Result<Node>(new Node(this.infixType));
            this.parser.begin("analyse-formula");
            this.myAnalyseSubFormula(node, index, new Set(), result);
            this.parser.end();
            return result;
        }
    }

    // AnalyseSubFormula: skippable | successful
    // 分析一个 formula node 的其中一段, 结果是 infix 或 element, inline-text, prefix

    analyseSubFormula(node: Node, index: Ref<number>, endTerm: Set<string>): Result<Node> {
        let result = new Result<Node>(new Node(this.infixType));
        this.parser.begin("analyse-subformula");
        this.myAnalyseSubFormula(node, index, endTerm, result);
        this.parser.end();
        return result;
    }

    myAnalyseSubFormula(parnode: Node, index: Ref<number>, endTerm: Set<string>, result: Result<Node>) {

        let termHeap = new Heap<Node>();
        let operatorHeap = new Heap<string>();

        let res: Result<Node>;
        let curOp: string;

        let hasInfixOperator = true;
        let constructingBlankOp = false;
        let constructing = false;

        while (true) {
            if (constructingBlankOp) {
                // cur operator = Blank operator
                let lastOp = operatorHeap.top();
                //  == undefined 必须用, 空串会被判为false
                if (lastOp === undefined || this.operatorTable.leq(lastOp, "")) {
                    operatorHeap.push("");
                    termHeap.push(res!.value);
                    hasInfixOperator = false;
                    constructingBlankOp = false;
                }
                else {
                    if (!this.construct(termHeap, operatorHeap)) {
                        result.addMessage("Infix operator pattern failed.", MessageType.error, this.parser.index);
                        result.mergeState(ResultState.skippable);
                    }
                }
                continue;
            }

            if (constructing) {
                let lastOp = operatorHeap.top();
                //  == undefined 必须用, 空串会被判为false
                if (lastOp === undefined || this.operatorTable.leq(lastOp, curOp!)) {
                    operatorHeap.push(curOp!);
                    hasInfixOperator = true;
                    constructing = false;
                }
                else {
                    if (!this.construct(termHeap, operatorHeap)) {
                        result.addMessage("Infix operator pattern failed.", MessageType.error, this.parser.index);
                        result.mergeState(ResultState.skippable);
                    }
                }

                continue;
            }

            if (this.isEOF(parnode, index, endTerm)) {
                if (hasInfixOperator) {
                    if (termHeap.length === 0) { // subformula 为空的情况
                        result.mergeState(ResultState.successful);
                        return;
                    }
                    result.addMessage("Missing last term of expression.", MessageType.error, this.parser.index);
                    result.mergeState(ResultState.skippable);
                    // 直接扔掉多余的 infix operator
                    operatorHeap.pop();
                    hasInfixOperator = false;
                }
                // same as above
                if (operatorHeap.length !== 0) {
                    if (!this.construct(termHeap, operatorHeap)) {
                        result.addMessage("Infix operator pattern failed.", MessageType.error, this.parser.index);
                        result.mergeState(ResultState.skippable);
                    }
                    continue;
                }

                if (termHeap.length !== 1 || operatorHeap.length !== 0) {
                    throw new LixError("[[logical error]] analyse subformula failed.");
                }

                result.value = termHeap.pop()!;
                return;

            }

            else if ((res = this.analyseTerm(parnode, index, endTerm)).matched) {
                result.merge(res);
                // 不会失败

                if (!hasInfixOperator) { // 连续两个 term
                    let lastOp = operatorHeap.top();
                    //  == undefined 必须用, 空串会被判为false
                    // same as below
                    if (lastOp === undefined || this.operatorTable.leq(lastOp, "")) {
                        operatorHeap.push("");
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
                // 不会失败

                if (hasInfixOperator) {
                    result.addMessage("Infix operator repeated.", MessageType.error, res.value);
                    result.mergeState(ResultState.skippable);
                    // 直接丢弃这一项
                    continue;
                }

                let lastOp = operatorHeap.top();
                curOp = res.value.content;
                //  == undefined 必须用, 空串会被判为false
                if (lastOp === undefined || this.operatorTable.leq(lastOp, curOp)) {
                    operatorHeap.push(curOp);
                    hasInfixOperator = true;
                }
                else {
                    constructing = true;
                }
            }

            else {
                throw new LixError("[[Logical Error]] Analysing formula.");
            }
        }
    }

    construct(termHeap: Heap<Node>, operatorHeap: Heap<string>): boolean {

        let lastOp = operatorHeap.top()!;

        let nNode = new Node(this.infixType);
        nNode.children.push(termHeap.pop()!);

        let topOp: string | undefined;
        // 必须要用 != undefined, 空字符串会被判定为 false
        while ((topOp = operatorHeap.top()) !== undefined && this.operatorTable.eq(topOp, lastOp)) {
            nNode.content = topOp.concat(nNode.content);
            operatorHeap.pop();
            nNode.children.push(termHeap.pop()!);
        }

        nNode.children.reverse();
        nNode.begin = nNode.children.at(0)!.begin;
        nNode.end = nNode.children.at(-1)!.end;
        termHeap.push(nNode);

        let pat = this.operatorTable.getInfixOperator(lastOp)!.patterns;
        if (pat.size !== 0 && !pat.has(nNode.content)) {
            // 如果不符合 pattern 就从后往前依次删除元素, 直到符合 pattern 或成为 blank operator.
            while (nNode.content.length > 0) {
                nNode.content = nNode.content.slice(0, -1);
                nNode.children.splice(-1, 1);
                if (pat.has(nNode.content)) {
                    break;
                }
            }
            return false;
        }
        return true;
    }

    // **************** Analysing Term & Operator ****************

    // AnalyseTerm: failing | skippable | successful
    // 结果是 element, inline-text, prefix

    analyseTerm(node: Node, index: Ref<number>, endTerm: Set<string>): Result<Node> {
        let result = new Result<Node>(new Node(this.elementType));
        this.parser.begin("analyse-term");
        this.myAnalyseTerm(node, index, result, endTerm);
        this.parser.end();
        return result;
    }

    myAnalyseTerm(parnode: Node, index: Ref<number>, result: Result<Node>, endTerm: Set<string>) {

        if (this.isEOF(parnode, index, endTerm)) {
            return;
        }
        let node = parnode.children[index.value];

        if (node.type === this.formulaType /*|| node.type === this.definitionType */) {
            result.GuaranteeMatched();

            let nodeRes = this.analyseFormula(node);
            result.merge(nodeRes);
            // 不会失败
            nodeRes.value.moveTo(result.value);
            index.value++;
        }
        else if (node.type === this.inlineTextType) {
            result.GuaranteeMatched();

            result.mergeState(ResultState.successful);
            result.addHighlight(HighlightType.string, node);
            index.value++;
            node.copyTo(result.value);
        }
        else if (node.type === this.elementType) {

            let infixOp = this.operatorTable.getInfixOperator(node.content);
            let prefixOp = this.operatorTable.getPrefixOperator(node.content);
            if (infixOp !== undefined) {
                result.addMessage("Term should not be empty.", MessageType.error, node);
                return;
            }
            else if (prefixOp !== undefined) {
                result.GuaranteeMatched();
                result.mergeState(ResultState.successful);

                let prefixNode = this.readPrefixOperator(parnode, index, result, prefixOp.patterns, endTerm);
                prefixNode.moveTo(result.value);
            }
            else {
                result.GuaranteeMatched();
                result.mergeState(ResultState.successful);
                result.addHighlight(HighlightType.variable, node);
                node.copyTo(result.value);
                index.value++;
            }
        }
        else if (node.type === this.escapeElementType) {
            result.GuaranteeMatched();
            result.mergeState(ResultState.successful);
            result.addHighlight(HighlightType.variable, node);
            node.copyTo(result.value);
            result.value.type = this.elementType;
            index.value++;
        }
    }

    readPrefixOperator(parnode: Node, index: Ref<number>, result: Result<Node>, patterns: PrefixOperatorPattern[], endTerm: Set<string>): Node {

        let node = parnode.children[index.value];
        let nNode = new Node(this.prefixType);

        nNode.begin = node.begin;

        for (let i = 0; i < patterns.length; i++) {
            let res: Result<Node>;
            switch (patterns[i].type) {
                case PrefixOperatorType.expression:
                    if (i + 1 < patterns.length && patterns[i + 1].type === PrefixOperatorType.enumeration) {
                        res = this.analyseSubFormula(parnode, index, endTerm.union(patterns[i + 1].options));
                    }
                    else {
                        res = this.analyseSubFormula(parnode, index, endTerm);
                    }
                    result.merge(res);
                    // 不会失败
                    nNode.children.push(res.value);
                    break;

                case PrefixOperatorType.term:
                    res = this.analyseTerm(parnode, index, endTerm);

                    result.merge(res);
                    if (result.shouldTerminate) { // 只能是遇到了 infix operator 或 EOF
                        result.addMessage("Prefix match [term] failed.", MessageType.error, this.parser.index);
                        result.promoteToSkippable();

                        nNode.children.push(new Node(this.prefixType, ""));
                        break;
                    }
                    nNode.children.push(res.value);
                    break;

                case PrefixOperatorType.matrix:
                    if (i + 1 < patterns.length && patterns[i + 1].type === PrefixOperatorType.enumeration) {
                        res = this.analyseMatrix(parnode, index, endTerm.union(patterns[i + 1].options));
                    }
                    else {
                        res = this.analyseMatrix(parnode, index, endTerm);
                    }
                    result.merge(res);
                    // 不会失败
                    nNode.children.push(res.value);
                    break;

                case PrefixOperatorType.enumeration:
                    // 此处 endTerm 必须设为 [], 就近匹配, 例如 (()) 第一个右括号要跟第二个左括号结合
                    if (this.isEOF(parnode, index, new Set())) {
                        result.mergeState(ResultState.skippable);
                        result.addMessage("Prefix match element ended abruptly.", MessageType.error, this.parser.index);
                        break;
                    }
                    node = parnode.children[index.value];

                    if (node.type === this.elementType && patterns[i].options.has(node.content)) {
                        result.mergeState(ResultState.successful);
                        result.addHighlight(HighlightType.operator, node);
                        index.value++;
                        nNode.content += node.content;
                    }
                    else {
                        result.mergeState(ResultState.skippable);
                        result.addMessage("Prefix match element failed.", MessageType.error, this.parser.index);
                    }
                    break;
            }
        }
        nNode.end = parnode.children[index.value - 1].end;

        return nNode;
    }

    // AnalyseMatrix: skippable | successful
    // 结果是 matrix

    analyseMatrix(node: Node, index: Ref<number>, endTerm: Set<string>): Result<Node> {
        let result = new Result<Node>(new Node(this.matrixType));
        this.parser.begin("analyse-matrix");
        this.myAnalyseMatrix(node, index, endTerm, result);
        this.parser.end();
        return result;
    }

    myAnalyseMatrix(parnode: Node, index: Ref<number>, endTerm: Set<string>, result: Result<Node>) {

        let res: Result<Node>;
        if (this.isEOF(parnode, index, endTerm)) {
            result.mergeState(ResultState.successful);
            return;
        }

        let node = parnode.children[index.value];
        result.value.begin = node.begin;
        let rowNode = new Node(this.matrixType);
        result.value.children.push(rowNode);

        while (true) {

            res = this.analyseSubFormula(parnode, index, endTerm.union(new Set(["&", ";"])));
            result.merge(res);
            // 不会失败
            rowNode.children.push(res.value);

            if (this.isEOF(parnode, index, endTerm)) {
                rowNode.begin = rowNode.children[0].begin;
                rowNode.end = rowNode.children.at(-1)!.end;
                break;
            }

            node = parnode.children[index.value];
            if (node.type === this.elementType && node.content === "&") {
                result.mergeState(ResultState.successful);
                result.addHighlight(HighlightType.operator, node);
                index.value++;
            }
            else { // node.content == ";"
                rowNode.begin = rowNode.children[0].begin;
                rowNode.end = rowNode.children.at(-1)!.end;
                rowNode = new Node(this.matrixType);
                result.value.children.push(rowNode);

                result.mergeState(ResultState.successful);
                result.addHighlight(HighlightType.operator, node);
                index.value++;
            }
        }
        result.value.end = parnode.children[index.value - 1].end;

    }

    // AnalyseOperator: failing | successful
    // 结果是 element

    analyseOperator(node: Node, index: Ref<number>, endTerm: Set<string>): Result<Node> {
        let result = new Result<Node>(new Node(this.elementType));
        this.parser.begin("analyse-operator");
        this.myAnalyseOperator(node, index, endTerm, result);
        this.parser.end();
        return result;
    }

    myAnalyseOperator(parnode: Node, index: Ref<number>, endTerm: Set<string>, result: Result<Node>) {
        if (this.isEOF(parnode, index, endTerm)) {
            return;
        }
        let node = parnode.children[index.value];

        if (node.type === this.elementType) {
            let infixOp = this.operatorTable.getInfixOperator(node.content);
            if (infixOp !== undefined) {
                result.GuaranteeMatched();

                result.mergeState(ResultState.successful);
                result.addHighlight(HighlightType.operator, node);
                index.value++;
                node.copyTo(result.value);
            }
        }
    }
}
