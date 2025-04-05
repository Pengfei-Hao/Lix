
import exp = require("constants");
import { Node } from "../../sytnax-tree/node";
import { Type } from "../../sytnax-tree/type";
import { Module } from "../module";
import { MatchResult, Parser } from "../parser";
import { SymbolTable } from "./symbol-table";
import { HighlightType, Result, ResultState } from "../../foundation/result";
import { MessageType } from "../../foundation/message";
import { Message } from "../../foundation/message";
import { InfixOperator, OperatorTable, OperatorType, PrefixOperator } from "./operator-table";
import { Heap } from "../../foundation/heap"
import { Ref } from "../../foundation/ref";
import { format } from "path";


export class Math extends Module {

    //blockHandlerTable: SymbolTable;

    operatorTable: OperatorTable;

    // types of syntax tree node
    formulaType: Type;
    definitionType: Type;

    elementType: Type;
    escapeElementType: Type;
    inlineTextType: Type;

    expressionType: Type;
    termType: Type;
    infixType: Type;
    prefixType: Type;

    notationsToUnicodeSymbols: Map<string, string>;

    symbols: Set<string>; // 符号, 包括 Symbols 字段和 Unicode Symbols 的 Symbol
    notations: Set<string>; // 字母组合, 包括 Notations 字段和 Unicode Symbols 的 Notation

    constructor(parser: Parser) {
        super(parser);

        // Init block handler & insertion handler
        this.parser.basicBlocks.add("formula");
        this.parser.blockHandlerTable.add("formula", this.formulaBlockHandler, this);

        this.parser.insertionHandlerTable.add("/", this.formulaInsertionHandler, this);

        // Init syntax tree node type
        this.formulaType = this.parser.typeTable.add("formula")!;
        this.elementType = this.parser.typeTable.add("element")!;
        this.escapeElementType = this.parser.typeTable.add("escape-element")!;
        this.definitionType = this.parser.typeTable.add("definition")!;
        this.inlineTextType = this.parser.typeTable.add("inline-text")!;
 
        this.expressionType = this.parser.typeTable.add("expression")!;
        this.termType = this.parser.typeTable.add("term")!;
        this.infixType = this.parser.typeTable.add("infix")!;
        this.prefixType = this.parser.typeTable.add("prefix")!;

        // Init math block handle function and init syntax tree node
        //this.blockHandlerTable = new SymbolTable(parser);

        // **************** Notations & Symbols ****************

        this.notations = new Set();
        this.symbols = new Set();
        this.notationsToUnicodeSymbols = new Map();

        // Init math symbols from math.json
        let json = parser.configs.get("math");
        let config: { Notations: string[], UnicodeSymbolsAndNotations: string[][], Symbols: string, PrefixOperator: string[][], InfixOperator: string[][] } = JSON.parse(json);

        // 字母组合
        for (let notation of config.Notations) {
            //this.blockHandlerTable.addSymbol(notation);
            this.notations.add(notation);
        }

        // 键盘上能打出来的符号
        for (let sym of config.Symbols) {
            this.symbols.add(sym);
            //this.blockHandlerTable.addSymbol(sym);
        }

        // Unicode 特殊字符
        for (let tmp of config.UnicodeSymbolsAndNotations) {
            this.symbols.add(tmp[0]);
            this.notations.add(tmp[1]);
            // this.blockHandlerTable.addSymbol(tmp[0]);
            // this.blockHandlerTable.addSymbol(tmp[1]);
            this.notationsToUnicodeSymbols.set(tmp[1], tmp[0]);
        }

        this.operatorTable = new OperatorTable();

        for (let prefix of config.PrefixOperator) {
            this.operatorTable.addPrefixOperator(prefix);
        }

        let medium = 0;
        for (medium = 0; medium < config.InfixOperator.length; medium++) {
            if (config.InfixOperator[medium][0] === "") {
                break;
            }
        }

        for (let i = medium - 1; i >= 0; i--) {
            this.operatorTable.insertAtTop(config.InfixOperator[i]);
        }

        for (let i = medium + 1; i < config.InfixOperator.length; i++) {
            this.operatorTable.insertAtBottom(config.InfixOperator[i]);
        }

    }

    init() {
        //this.blockHandlerTable.definitions = new Map();
    }

    // FormulaBlockHandler: failing | skippable | successful

    formulaBlockHandler(args: Node): Result<Node> {
        return this.parser.prepareMatch(this.formulaType, "formula-block-handler", this.myFormulaBlockHandler, this, this.analyse);

        // let result = new Result<Node>(new Node(this.formulaType));
        // let preIndex = this.parser.index;
        // this.parser.begin("formula-block-handler");
        // this.myFormulaBlockHandler(result, args);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }

        // if(result.shouldTerminate) {
        //     return result;
        // }
        // this.parser.begin("analysis");
        // let analysisResult = this.analyse(result.content);
        // this.parser.end();
        // result.merge(analysisResult);
        // result.content.children.push(analysisResult.content);
        // //result.content=analysisResult.content;

        // return result;
    }

    private myFormulaBlockHandler(result: Result<Node>, args: Node = new Node(this.parser.argumentsType)) {
        let nodeRes: Result<Node>;

        nodeRes = this.matchElements("]", true);
        result.merge(nodeRes);
        Node.moveTo(nodeRes.content, result.content);
    }

    // FormulaInsertionHandler: failing | matched | skippable | successful

    formulaInsertionHandler(): MatchResult {
        return this.parser.prepareMatch(this.formulaType, "formula-insertion-handler", this.myFormulaInsertionHandler, this, this.analyse);

        // let result = new Result<Node>(new Node(this.formulaType));
        // let preIndex = this.parser.index;
        // this.parser.begin("inline-formula");
        // this.myFormulaInsertionHandler(result);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }

        // if(result.shouldTerminate) {
        //     return result;
        // }
        // this.parser.begin("analysis");
        // let analysisResult = this.analyse(result.content);
        // this.parser.end();
        // result.merge(analysisResult);
        // result.content.children.push(analysisResult.content);
        // //result.content=analysisResult.content;

        // return result;
    }

    private myFormulaInsertionHandler(result: Result<Node>) {
        let nodeRes: Result<Node>;
        
        result.merge(this.parser.match("/"));
        if (result.shouldTerminate) {
            return;
        }
        this.parser.mergeHighlight(result, HighlightType.operator, -1, 0);
        result.GuaranteeMatched();

        nodeRes = this.matchElements("/", false);
        result.merge(nodeRes);
        // 不会失败
        Node.moveTo(nodeRes.content, result.content);

        result.merge(this.parser.match("/"));
        if (result.shouldTerminate) {
            this.parser.mergeMessage(result, `Missing '/' in inline formula.`);
            result.promoteToSkippable();
            return;
        }
        this.parser.mergeHighlight(result, HighlightType.operator, -1, 0);
    }

    // **************** Match ****************

    // Part 1: scan the text and construct the syntax tree. This part will use types of node as follows:
    // formula
    // definition
    // element
    // inlineText
    // escapeElement

    static nameChar = /[0-9a-zA-Z]/;

    // MatchElements: failing | skippable | successful

    matchElements(endWith: string = "]", hasDefinition = false): Result<Node> {
        return this.parser.prepareMatch(this.formulaType, "elements", this.myMatchElements.bind(this, endWith, hasDefinition), this);

        // let result = new Result<Node>(new Node(this.formulaType));
        // let preIndex = this.parser.index;
        // this.parser.begin("elements");
        // this.myMatchElements(result, endWith, hasDefinition);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    private myMatchElements(endWith: string, hasDefinition: boolean, result: Result<Node>) {

        let node = result.content;

        let blkRes: Result<number>;
        let nodeRes: Result<Node>;
        let symRes: Result<null>;

        result.mergeState(ResultState.successful);

        while (true) {

            if (this.parser.isEOF()) {
                result.mergeState(ResultState.skippable);
                this.parser.mergeMessage(result, `Formula ended abruptly.`);
                return;
            }

            else if ((nodeRes = this.matchEscapeElement()).matched) {
                result.merge(nodeRes);
                // 不会失败
                node.children.push(nodeRes.content);
            }

            else if (this.parser.is(endWith)) {
                break;
            }

            else if (this.parser.isMultilineBlankGeThanOne()) {
                result.mergeState(ResultState.skippable);
                this.parser.mergeMessage(result, `Formula ended abruptly.`);
                return;
            }

            else if ((blkRes = this.parser.matchMultilineBlank()).matched) {
                result.merge(blkRes);
                // if (blnRes.content >= 2) {
                //     this.parser.mergeMessage(result, "Formula should not have two or more line breaks.", MessageType.warning));
                //     //result.mergeState(ResultState.skippable);
                // }
            }

            else if ((symRes = this.parser.match("[")).matched) {
                result.merge(symRes);

                nodeRes = this.matchElements("]", false);
                result.merge(nodeRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(nodeRes.content);

                if(this.parser.isEOF()) {
                    return;
                }
                result.merge(this.parser.match("]"));
                if (result.shouldTerminate) {
                    this.parser.mergeMessage(result, `Missing ']' in formula.`);
                    result.promoteToSkippable();
                    return;
                }
            }

            else if (hasDefinition && (symRes = this.parser.match("`")).matched) {
                result.merge(symRes);
                this.parser.mergeHighlight(result, HighlightType.operator, -1, 0);

                nodeRes = this.matchElements("`", false);
                result.merge(nodeRes);
                if (result.shouldTerminate) {
                    return;
                }
                nodeRes.content.type = this.definitionType;
                node.children.push(nodeRes.content);

                if(this.parser.isEOF()) {
                    return;
                }
                result.merge(this.parser.match("`"));
                if (result.shouldTerminate) {
                    this.parser.mergeMessage(result, `Missing '\`' in formula.`);
                    result.promoteToSkippable();
                    return;
                }
                this.parser.mergeHighlight(result, HighlightType.operator, -1, 0);
            }

            else if ((nodeRes = this.matchInlineText()).matched) {
                result.merge(nodeRes);
                // 不会失败
                node.children.push(nodeRes.content);
            }

            else if ((nodeRes = this.matchElement()).matched) {
                result.merge(nodeRes);
                // 不会失败
                node.children.push(nodeRes.content);
            }

            else {
                result.mergeState(ResultState.skippable);
                this.parser.mergeMessage(result, `Unrecognizable character '${this.parser.curUnicodeChar()}' in formula.`);
                this.parser.moveUnicode();
                continue;
            }
        }
    }

    // MatchElement: successful

    matchElement(): Result<Node> {
        return this.parser.prepareMatch(this.elementType, "element", this.myMatchElement, this);

        // let result = new Result<Node>(new Node(this.elementType));
        // let preIndex = this.parser.index;
        // this.parser.begin("element");
        // this.myMatchElement(result);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    private myMatchElement(result: Result<Node>) {

        let node = result.content;

        if (this.parser.isEOF()) {
            return;
        }

        if (this.parser.is(Math.nameChar)) {
            while (true) {
                if (this.parser.is(Math.nameChar)) {
                    result.mergeState(ResultState.successful);
                    node.content += this.parser.curChar();
                    this.parser.move();
                }
                else {
                    break;
                }
            }
        }
        else {
            // 数学的特殊符号属于 0x10000 平面, ts 使用 utf16 编码, 因而占两个字符的位置, 要使用 curUnicodeChar
            node.content = this.parser.curUnicodeChar();
            if(this.symbols.has(node.content)) {
                result.mergeState(ResultState.successful);
                this.parser.moveUnicode();                
            }
        }
    }

    // MatchEscapeElement: failing | skippable | successful

    matchEscapeElement(): Result<Node> {
        return this.parser.prepareMatch(this.escapeElementType, "escape-element", this.myMatchEscapeElement, this);

        // let result = new Result<Node>(new Node(this.escapeElementType));
        // let preIndex = this.parser.index;
        // this.parser.begin("escape-element");
        // this.myMatchEscapeElement(result);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    private myMatchEscapeElement(result: Result<Node>) {

        let nodeRes: Result<Node>;
        let symRes: Result<null>;

        if((symRes = this.parser.match("@")).matched) {
            result.merge(symRes);
            result.GuaranteeMatched();
    
            nodeRes = this.matchElement();
            result.merge(nodeRes);
            if (result.shouldTerminate) {
                result.promoteToSkippable();
    
                result.content.type = this.elementType;
                result.content.content = "@";
                this.parser.mergeMessage(result, "'@' must be followed by an element.");
                return;
            }
            result.content.content = nodeRes.content.content;
        }
        else if((symRes = this.parser.match("\\")).matched) {
            result.merge(symRes);
            result.GuaranteeMatched();
            result.content.type = this.elementType;
    
            nodeRes = this.matchElement();
            result.merge(nodeRes);
            if (result.shouldTerminate) {
                result.promoteToSkippable();
    
                result.content.content = "\\";
                this.parser.mergeMessage(result, "'\\' must be followed by an element.");
                return;
            }
            result.content.content = nodeRes.content.content;
        }
        else {
            this.parser.mergeMessage(result, "Missing '@' or '\\' in formula.");
        }
    }

    // MatchInlineText: failing | skippable | successful

    matchInlineText(): Result<Node> {
        return this.parser.prepareMatch(this.inlineTextType, "inline-text", this.myMatchInlineText, this);

        // let result = new Result<Node>(new Node(this.inlineTextType));
        // let preIndex = this.parser.index;
        // this.parser.begin("inline-text");
        // this.myMatchInlineText(result);
        // this.parser.end();
        // result.content.begin = preIndex;
        // result.content.end = this.parser.index;
        // if (result.failed) {
        //     this.parser.index = preIndex;
        // }
        // return result;
    }

    private myMatchInlineText(result: Result<Node>) {

        let node = result.content;

        result.merge(this.parser.match("\""));
        if (result.shouldTerminate) {
            this.parser.mergeMessage(result, "Missing '\"' in formula.");
            return;
        }
        result.GuaranteeMatched();

        let symRes: Result<null>;

        while (true) {
            if (this.parser.isEOF()) {
                this.parser.mergeMessage(result, "Formula inline text ended abruptly.");
                result.mergeState(ResultState.skippable);
                return;
            }
            else if ((symRes = this.parser.match("\"")).matched) {
                result.merge(symRes);
                break;
            }
            else {
                node.content += this.parser.curChar();
                this.parser.move();
                result.mergeState(ResultState.successful);
            }
        }
    }

    // **************** Skipping ****************

    skipByBracketsEndWith(endWith: string) {
        let count = 1;
        while (this.parser.notEnd()) {
            if (this.parser.is("[")) {
                count++;
            }
            else if (count === 1 && this.parser.is(endWith)) {
                count--;
                this.parser.move();
                break;
            }
            else if (count !== 1 && this.parser.is("]")) {
                count--;
            }
            this.parser.move();
        }
    }

    
    // **************** Analyse ****************

    // Part 2: analyse the syntax tree that constructed in Part 1, replace definition nodes with its content, and find out the correct math label function to handle the formula nodes. This part will use types of node as follows:
    // expression
    // element
    // inline-text
    // infix
    // prefix


    analyse(result: Result<Node>) {
        result.analysedContent.type = this.expressionType;

        if(result.shouldTerminate) {
            return result;
        }
        /*
        // filter the definition, i.e. the chars surrounded by the ' '.
        for (let subnode of node.children) {
            if (subnode.type === this.definitionType) {
                result.mergeState(ResultState.successful);

                if (subnode.children.length < 2) {
                    result.mergeState(ResultState.failing);
                    result.promoteToSkippable();
                    this.parser.mergeMessage(result, "Definition uncompleted."));
                    continue;
                }
                if (subnode.children[0].type != this.elementType) {
                    result.mergeState(ResultState.failing);
                    result.promoteToSkippable();
                    this.parser.mergeMessage(result, "Definition element unfounded."));
                    continue;
                }
                if (subnode.children[1].type != this.elementType || subnode.children[1].content != "↦") {
                    result.mergeState(ResultState.failing);
                    result.promoteToSkippable();
                    this.parser.mergeMessage(result, "Symbol '↦' unfounded."));
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

        // 分析结果在 analRes.content 中, 是一个 infixOp
        let analRes = this.analyseFormula(result.content);
        result.merge(analRes);

        result.analysedContent.children.push(analRes.content);
    }

    // AnalyseFormula: failing | skippable | successful
    // 分析一个 Node 的所有子节点
    // 结果是 infixOperator

    analyseFormula(node: Node): Result<Node> {
        let index = new Ref<number>(0);
        let result = new Result(new Node(this.formulaType), new Node(this.formulaType));
        this.parser.begin("analysis-formula");
        this.myAnalyseFormula(node, index, result);
        this.parser.end();
        return result;
    }

    myAnalyseFormula(node: Node, index: Ref<number>, result: Result<Node>) {
        let res = this.analyseExpression(node, index);
        result.merge(res);
        if (result.shouldTerminate) {
            result.promoteToSkippable();
        }
        result.content = res.content;
    }

    // AnalyseExpression: failing | skippable | successful
    // 分析一个 Node 的其中一段
    // 结果是 infixOperator

    analyseExpression(node: Node, index: Ref<number>, endTerm: string[] = []): Result<Node> {
        let result = new Result(new Node(this.formulaType), new Node(this.formulaType));
        this.parser.begin("analyse-expression");
        this.myAnalyseExpression(node, index, endTerm, result);
        this.parser.end();
        return result;
    }

    myAnalyseExpression(parnode: Node, index: Ref<number>, endTerm: string[], result: Result<Node>) {

        let termHeap = new Heap<Node>();
        let operatorHeap = new Heap<string>();


        if (this.isEOF(parnode, index, endTerm)) {
            //this.parser.mergeMessage(result, "Expression should not be empty."));
            result.content = new Node(this.infixType, "");
            result.mergeState(ResultState.successful);
            return;
        }


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
                if (lastOp == undefined || this.operatorTable.getInfixOperator(lastOp)!.priority <= OperatorTable.BlankOperator.priority) {
                    operatorHeap.push("");
                    termHeap.push(res!.content);
                    hasInfixOperator = false;
                    constructingBlankOp = false;
                }
                else {
                    if (!this.construct(termHeap, operatorHeap)) {
                        this.parser.mergeMessage(result, "Infix operator pattern failed.");
                        result.mergeState(ResultState.failing);
                        return;
                    }
                }
                continue;
            }

            if (constructing) {
                let lastOp = operatorHeap.top();
                //  == undefined 必须用, 空串会被判为false
                if (lastOp == undefined || this.operatorTable.getInfixOperator(lastOp)!.priority <= this.operatorTable.getInfixOperator(curOp!)!.priority) {
                    operatorHeap.push(curOp!);
                    hasInfixOperator = true;
                    constructing = false;
                }
                else {
                    if (!this.construct(termHeap, operatorHeap)) {
                        this.parser.mergeMessage(result, "Infix operator pattern failed.");
                        result.mergeState(ResultState.failing);
                        return;
                    }
                }

                continue;
            }

            if (this.isEOF(parnode, index, endTerm)) {
                if (hasInfixOperator) {
                    this.parser.mergeMessage(result, "Missing last term of expression.");
                    result.mergeState(ResultState.failing);
                    return;
                }
                // same as below
                if (operatorHeap.length != 0) {
                    if (!this.construct(termHeap, operatorHeap)) {
                        this.parser.mergeMessage(result, "Infix operator pattern failed.");
                        result.mergeState(ResultState.failing);
                        return;
                    }
                    continue;
                }

                if (termHeap.length != 1 || operatorHeap.length != 0) {
                    this.parser.mergeMessage(result, "expression failed.");
                    result.mergeState(ResultState.failing);
                    return;
                }

                result.content = termHeap.pop()!;
                return;

            }

            else if ((res = this.analyseTerm(parnode, index, endTerm)).matched) {
                result.merge(res);
                if (result.shouldTerminate) {
                    return;
                }

                if (!hasInfixOperator) {
                    let lastOp = operatorHeap.top();
                    //  == undefined 必须用, 空串会被判为false
                    // same as below
                    if (lastOp == undefined || this.operatorTable.getInfixOperator(lastOp)!.priority <= OperatorTable.BlankOperator.priority) {
                        operatorHeap.push("");
                        termHeap.push(res.content);
                        hasInfixOperator = false;
                    }
                    else {
                        constructingBlankOp = true;
                    }
                }
                else {
                    termHeap.push(res.content);
                    hasInfixOperator = false;
                }
            }

            else if ((res = this.analyseOperator(parnode, index)).matched) {
                result.merge(res);

                if (hasInfixOperator) {
                    this.parser.mergeMessage(result, "Infix operator repeated.");
                    result.mergeState(ResultState.failing);
                    return;
                }

                let lastOp = operatorHeap.top();
                curOp = res.content.content;
                //  == undefined 必须用, 空串会被判为false
                if (lastOp == undefined || this.operatorTable.getInfixOperator(lastOp)!.priority <= this.operatorTable.getInfixOperator(curOp)!.priority) {
                    operatorHeap.push(curOp!);
                    hasInfixOperator = true;
                }
                else {
                    constructing = true;
                }
            }

            else {
                console.log("[[Logical Error]] Analysing formula.");
                result.mergeState(ResultState.failing);
                return;
            }
        }
    }

    construct(termHeap: Heap<Node>, operatorHeap: Heap<string>): boolean {

        let lastOp = operatorHeap.top()!;

        let nNode = new Node(this.infixType);
        nNode.children.push(termHeap.pop()!);

        let topOp: string | undefined;
        // 必须要用 != undefined, 空字符串会被判定为 false
        while ((topOp = operatorHeap.top()) != undefined && this.operatorTable.getInfixOperator(topOp)!.priority === this.operatorTable.getInfixOperator(lastOp)!.priority) {

            nNode.content = topOp.concat(nNode.content);
            operatorHeap.pop();
            nNode.children.push(termHeap.pop()!);
        }

        let pat = this.operatorTable.getInfixOperator(lastOp)!.pattern;

        if (pat.size != 0) {
            if (!pat.has(nNode.content)) {
                return false;
            }
        }

        nNode.children.reverse();
        nNode.begin = nNode.children.at(0)!.begin;
        nNode.end = nNode.children.at(-1)!.end;

        termHeap.push(nNode);
        return true;
    }

    isEOF(node: Node, index: Ref<number>, endTerm: string[]): boolean {
        if (index.value === node.children.length) {
            return true;
        }
        let child = node.children[index.value];
        for (let op of endTerm) {
            if ((child.type === this.elementType) && child.content === op) {
                return true;
            }
        }
        return false;
    }

    // AnalyseTerm: failing | matched | skippable | successful

    analyseTerm(node: Node, index: Ref<number>, endTerm: string[]): Result<Node> {
        let result = new Result(new Node(this.elementType), new Node(this.elementType));
        this.parser.begin("analyse-term");
        this.myAnalyseTerm(node, index, result, endTerm);
        this.parser.end();
        //注意result.content整个被换掉了
        //result.content.begin = preIndex;
        //result.content.end = this.index;
        return result;
    }

    myAnalyseTerm(parnode: Node, index: Ref<number>, result: Result<Node>, endTerm: string[]) {
        let msg = result.messages;

        if (this.isEOF(parnode, index, [])) {
            //this.parser.mergeMessage(result, "Term should not be empty."));
            return;
        }
        let node = parnode.children[index.value];

        if (node.type === this.formulaType || node.type === this.definitionType) {
            result.GuaranteeMatched();

            let nResult = this.analyseFormula(node);
            result.merge(nResult);
            if (nResult.shouldTerminate) {
                return result;
            }
            result.content = nResult.content;
            index.value++;
        }
        else if (node.type === this.inlineTextType) {
            result.GuaranteeMatched();

            result.mergeState(ResultState.successful);
            this.parser.mergeHighlight(result, HighlightType.string, node);
            index.value++;
            result.content = Node.clone(node);
        }
        else if (node.type === this.elementType) {

            let infixOp = this.operatorTable.getInfixOperator(node.content);
            let prefixOp = this.operatorTable.getPrefixOperator(node.content);
            if (infixOp !== undefined) {
                msg.push(this.getMessage("Term should not be empty.", node));
                return;
            }
            else if (prefixOp !== undefined) {
                result.GuaranteeMatched();

                result.mergeState(ResultState.successful);
                this.parser.mergeHighlight(result, HighlightType.operator, node);

                // let nNode = new Node(this.prefixType);
                let format = prefixOp.format;
                // nNode.begin = node.begin;

                // nNode.content = format[0];
                // index.value++;

                // for (let i = 1; i < format.length; i++) {
                //     let res: Result<Node>;
                //     switch (format[i]) {
                //         case "[expr]":

                //             if (i + 1 < format.length) {
                //                 res = this.analyseExpression(parnode, index, [format[i + 1]]);
                //             }
                //             else {
                //                 res = this.analyseExpression(parnode, index);
                //             }
                //             result.merge(res);
                //             if (result.shouldTerminate) {
                //                 this.parser.mergeMessage(result, "Prefix match [expr] failed."));
                //                 return;
                //             }
                //             nNode.children.push(res.content);
                //             break;

                //         case "[term]":
                //             res = this.analyseTerm(parnode, index);

                //             result.merge(res);
                //             if (result.shouldTerminate) {
                //                 this.parser.mergeMessage(result, "Prefix match [term] failed."));
                //                 return;
                //             }
                //             nNode.children.push(res.content);
                //             break;

                //         default:
                //             if (this.isEOF(parnode, index, [])) {
                //                 result.mergeState(ResultState.failing);
                //                 this.parser.mergeMessage(result, "Prefix match element ended abruptly."));
                //                 return;
                //             }

                //             node = parnode.children[index.value];
                //             if (node.type === this.elementType && node.content === format[i]) {
                //                 result.mergeState(ResultState.successful);
                //                 this.parser.mergeHighlight(result, HighlightType.operator, node));
                //                 index.value++;
                //                 break;
                //             }
                //             else {
                //                 result.mergeState(ResultState.failing);
                //                 this.parser.mergeMessage(result, "Prefix match element failed."));
                //                 return;
                //             }
                //     }
                // }

                // nNode.end = parnode.children[index.value - 1].end;
                let nNode = this.readPrefixOperator(parnode, index, result, format, endTerm);
                if(nNode === undefined) {
                    return;
                }
                result.content = nNode;
            }
            else if(this.symbols.has(node.content) || this.notations.has(node.content)) {
                result.GuaranteeMatched();
                result.mergeState(ResultState.successful);

                this.parser.mergeHighlight(result, HighlightType.variable, node);

                result.content = Node.clone(node);
                //result.content.type = this.termType;
                index.value++;
            }
            else {
                result.mergeState(ResultState.skippable);
                msg.push(this.getMessage(`Element '${node.content}' not recognized.`, node));
                //result.promoteToSkippable();
                index.value++;
            }
            // else {
            //     result.GuaranteeMatched();
            //     if(!this.symbols.has(node.content) && !this.notations.has(node.content)) {
            //         result.mergeState(ResultState.failing);
            //         this.parser.mergeMessage(result, `Element '${node.content}' not recognized.`));
            //         result.promoteToSkippable();
            //     }
            //     else {

            //         result.mergeState(ResultState.successful);

            //         this.parser.mergeHighlight(result, HighlightType.variable, node));

            //         result.content = Node.clone(node);
            //         //result.content.type = this.termType;
            //     }
            //     index.value++;

            // }
        }
        else if (node.type === this.escapeElementType) {

            if(this.symbols.has(node.content) || this.notations.has(node.content)) {
                result.GuaranteeMatched();
                result.mergeState(ResultState.successful);

                this.parser.mergeHighlight(result, HighlightType.variable, node);

                result.content = Node.clone(node);
                result.content.type = this.elementType;
                //result.content.type = this.termType;
                index.value++;
            }
            else {
                result.mergeState(ResultState.skippable);
                msg.push(this.getMessage(`Escape element '${node.content}' not recognized.`, node));
                //result.promoteToSkippable();
                index.value++;
            }
                // result.GuaranteeMatched();
                // if(!this.symbols.has(node.content) && !this.notations.has(node.content)) {
                //     result.mergeState(ResultState.failing);
                //     this.parser.mergeMessage(result, `Escape element ${node.content} not recognized.`));
                //     result.promoteToSkippable();
                // }
                // else {
                //     result.mergeState(ResultState.successful);
                //     this.parser.mergeHighlight(result, HighlightType.variable, node));

                //     result.content = Node.clone(node);
                //     result.content.type = this.elementType;
                // }
                // index.value++;
            
        }
    }

    readPrefixOperator(parnode: Node, index: Ref<number>, result: Result<Node>, format: string[], endTerm: string[]): Node | undefined {

        let node = parnode.children[index.value]
        let nNode = new Node(this.prefixType);
        let msg = result.messages;

        nNode.begin = node.begin;

        nNode.content = format[0];
        index.value++;

        if(format[0] === "mat" || format[0] === "cases") {
            let res: Result<Node>;
            if(this.isEOF(parnode, index, endTerm)) {
                return nNode;
            }

            let rowNode = new Node(this.prefixType);
            nNode.children.push(rowNode);

            while(true) {

                    res = this.analyseExpression(parnode, index, endTerm.concat(["&", ";"]));
                    result.merge(res);
                    if (result.shouldTerminate) {
                        this.parser.mergeMessage(result, "Prefix mat failed.");
                        return undefined;
                    }
                    rowNode.children.push(res.content);
                    node = parnode.children[index.value];
                    if(this.isEOF(parnode, index, endTerm)) {
                        rowNode.begin = rowNode.children[0].begin;
                        rowNode.end = rowNode.children.at(-1)!.end;
                        break;
                    }
                    else if(node.type === this.elementType && node.content === "&") {
                        result.mergeState(ResultState.successful);
                        this.parser.mergeHighlight(result, HighlightType.operator, node);
                        index.value++;
                    }
                    else {
                        rowNode.begin = rowNode.children[0].begin;
                        rowNode.end = rowNode.children.at(-1)!.end;
                        rowNode = new Node(this.prefixType);
                        nNode.children.push(rowNode);

                        result.mergeState(ResultState.successful);
                        this.parser.mergeHighlight(result, HighlightType.operator, node);
                        index.value++;
                    }
            }
            nNode.end = parnode.children[index.value - 1].end;
            return nNode; 
        }

        for (let i = 1; i < format.length; i++) {
            let res: Result<Node>;
            switch (format[i]) {
                case "[expr]":

                    if (i + 1 < format.length) {
                        res = this.analyseExpression(parnode, index, endTerm.concat([format[i + 1]]));
                    }
                    else {
                        res = this.analyseExpression(parnode, index, endTerm);
                    }
                    result.merge(res);
                    if (result.shouldTerminate) {
                        this.parser.mergeMessage(result, "Prefix match [expr] failed.");
                        return undefined;
                    }
                    nNode.children.push(res.content);
                    break;

                case "[term]":
                    res = this.analyseTerm(parnode, index, endTerm);

                    result.merge(res);
                    if (result.shouldTerminate) {
                        this.parser.mergeMessage(result, "Prefix match [term] failed.");
                        return undefined;
                    }
                    nNode.children.push(res.content);
                    break;

                default:
                    // 此处 endTerm 必须设为 [], 就近匹配, 例如 (()) 第一个右括号要跟第二个左括号结合
                    if (this.isEOF(parnode, index, [])) {
                        result.mergeState(ResultState.failing);
                        this.parser.mergeMessage(result, "Prefix match element ended abruptly.");
                        return undefined;
                    }

                    node = parnode.children[index.value];
                    if (node.type === this.elementType && node.content === format[i]) {
                        result.mergeState(ResultState.successful);
                        this.parser.mergeHighlight(result, HighlightType.operator, node);
                        index.value++;
                        break;
                    }
                    else {
                        result.mergeState(ResultState.failing);
                        this.parser.mergeMessage(result, "Prefix match element failed.");
                        return undefined;
                    }
            }
        }
        nNode.end = parnode.children[index.value - 1].end;

        return nNode;
    }

    // AnalyseOperator: failing | matched | skippable | successful

    analyseOperator(node: Node, index: Ref<number>): Result<Node> {
        let result = new Result(new Node(this.termType), new Node(this.termType));
        this.parser.begin("analyse-operator");
        this.myAnalyseOperator(node, index, result);
        this.parser.end();
        //result.content.begin = preIndex;
        //result.content.end = this.index;
        return result;
    }

    myAnalyseOperator(parnode: Node, index: Ref<number>, result: Result<Node>) {
        let msg = result.messages;
        if (this.isEOF(parnode, index, [])) {
            //msg.push(this.getMessage("Operator should not be empty.", index));
            return;
        }
        let node = parnode.children[index.value];
        if (node.type === this.elementType) {
            let iop = this.operatorTable.getInfixOperator(node.content);
            if (iop !== undefined) {
                result.GuaranteeMatched();

                result.mergeState(ResultState.successful);
                this.parser.mergeHighlight(result, HighlightType.operator, node);
                index.value++;
                result.content = Node.clone(node);
                //result.content.type = this.termType;
            }
        }
    }

    getMessage(message: string, node: Node, type: MessageType = MessageType.error): Message {
        let msg = this.parser.getMessage(message, type);
        msg.begin = node.begin;
        msg.end = node.end;
        return msg;
    }
    
    // isSymbol(node: Node, name: string): boolean {
    //     return node.type === this.elementType && node.content === name;
    // }

    // getMessage(message: string, index: number, type: MessageType = MessageType.error, code: number = -1): Message {
    //     let lp = this.parser.getLineAndCharacter(index) ?? { line: -1, character: -1 };
    //     let pro = this.parser.process.slice();
    //     return new Message(message, type, code, lp.line, lp.character, pro);

    // }
}
