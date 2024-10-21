
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


export class Math extends Module {

    blockHandlerTable: SymbolTable;

    operatorTable: OperatorTable;

    // types of syntax tree node
    formulaType: Type;
    definationType: Type;

    elementType: Type;
    escapeElementType: Type;
    inlineTextType: Type;

    expressionType: Type;
    termType: Type;
    infixType: Type;
    prefixType: Type;

    /*
    fractionType: Type;
    matrixType: Type;
    sqrtType: Type;
    sumType: Type;
    limitType: Type;
    integralType: Type;
    scriptType: Type;
    bracketsType: Type;
    */

    notationsToUnicodeSymbols: Map<string, string>;

    symbols: Set<string>; // 符号, 包括 Symbols 字段和 Unicode Symbols 的 Symbol
    notations: Set<string>; // 字母组合, 包括 Notations 字段和 Unicode Symbols 的 Notation

    constructor(parser: Parser) {
        super(parser);

        // Init label handle function
        this.parser.basicBlocks.add("formula");
        this.parser.blockHandlerTable.add("formula", this.formulaBlockHandler, this);

        // Init syntax tree node type
        this.formulaType = this.parser.typeTable.add("formula")!;
        this.elementType = this.parser.typeTable.add("element")!;
        this.escapeElementType = this.parser.typeTable.add("escape-element")!;
        this.definationType = this.parser.typeTable.add("defination")!;
        this.inlineTextType = this.parser.typeTable.add("inline-text")!;

        this.expressionType = this.parser.typeTable.add("expression")!;
        this.termType = this.parser.typeTable.add("term")!;
        this.infixType = this.parser.typeTable.add("infix")!;
        this.prefixType = this.parser.typeTable.add("prefix")!;

        // Init math block handle function and init syntax tree node
        this.blockHandlerTable = new SymbolTable(parser);
        /*
        this.fractionType = this.blockHandlerTable.addBlock("fraction", this.frac, this)!;
        this.sqrtType = this.blockHandlerTable.addBlock("sqrt", this.sqrt, this)!;
        this.sumType = this.blockHandlerTable.addBlock("sum", this.sum, this)!;
        this.limitType = this.blockHandlerTable.addBlock("limit", this.limit, this)!;
        this.integralType = this.blockHandlerTable.addBlock("integral", this.integral, this)!;
        this.scriptType = this.blockHandlerTable.addBlock("script", this.script, this)!;
        this.bracketsType = this.blockHandlerTable.addBlock("brackets", this.brackets, this)!;
        this.matrixType = this.blockHandlerTable.addBlock("matrix", this.matrix, this)!;
        */

        this.notations = new Set();
        this.symbols = new Set();
        this.notationsToUnicodeSymbols = new Map();

        // Init math symbols from math.json
        let json = parser.configs.get("math");
        let config: { Notations: string[], UnicodeSymbolsAndNotations: string[][], Symbols: string, PrefixOperator: string[][], InfixOperator: string[][] } = JSON.parse(json);

        // 字母组合
        for (let notation of config.Notations) {
            this.blockHandlerTable.addSymbol(notation);
            this.notations.add(notation);
        }

        // 键盘上能打出来的符号
        for (let sym of config.Symbols) {
            this.symbols.add(sym);
            this.blockHandlerTable.addSymbol(sym);
        }

        // vscode 中要关闭 DisableHighlightingOfAmbiguousCharacters 这个选项
        // Unicode 特殊字符
        for (let tmp of config.UnicodeSymbolsAndNotations) {
            this.symbols.add(tmp[0]);
            this.notations.add(tmp[1]);
            this.blockHandlerTable.addSymbol(tmp[0]);
            this.blockHandlerTable.addSymbol(tmp[1]);
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
        this.blockHandlerTable.definations = new Map();
    }

    // FormulaBlockHandler: failing | skippable | successful

    formulaBlockHandler(): MatchResult {
        let result = new Result<Node>(new Node(this.formulaType));
        let preIndex = this.parser.index;
        this.parser.begin("formula-block-handler");
        this.myMatchFormula(result);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        if (result.failed) {
            this.parser.index = preIndex;
            return result;
        }
        // if (!result.succeeded) {
        //     return result;
        // }

        this.parser.begin("analysis");
        let analysisResult = this.analyse(result.content);
        this.parser.end();
        result.merge(analysisResult);
        result.content.children.push(analysisResult.content);
        return result;
    }

    // MatchInlineFormula: failing | matched | skippable | successful

    matchInlineFormula(): MatchResult {
        let result = new Result<Node>(new Node(this.formulaType));
        let preIndex = this.parser.index;
        this.parser.begin("inline-formula");
        result.merge(this.parser.match("/"));
        if (result.shouldTerminate) {
            this.parser.end();
            return result;
        }
        result.GuaranteeMatched();
        result.highlights.push(this.parser.getHighlight(HighlightType.operator, -1, 0));
        this.myMatchFormula(result, true);

        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;

        if (result.failed) {
            this.parser.index = preIndex;
            return result;
        }
        // if (!result.succeeded) {
        //     return result;
        // }

        this.parser.begin("analysis");
        let analysisResult = this.analyse(result.content);
        this.parser.end();
        result.merge(analysisResult);
        result.content.children.push(analysisResult.content);
        return result;
    }

    // **************** Match ****************

    // Part 1: scan the text and construct the syntax tree. This part will use types of node as follows:
    // formula
    // defination
    // element
    // inlineText
    // escapeElement

    static nameChar = /[0-9a-zA-Z]/;

    private myMatchFormula(result: Result<Node>, inline = false) {

        let msg = result.messages;

        let nodeRes: Result<Node>;
        let nullRes: Result<null>;


        if (inline) {
            nodeRes = this.matchElements("/");
        }
        else {
            nodeRes = this.matchElements("]");
        }
        result.merge(nodeRes);
        if (result.shouldTerminate) {
            result.promoteToSkippable();
            if (inline) {
                this.skipByBracketsEndWith("/");
            }
            else {
                this.skipByBracketsEndWith("]");
            }
            return;
        }
        result.content = nodeRes.content;
    }

    /*
    private myMatchFormula(result: MatchResult, inline = false) {

        let node = result.content;
        let msg = result.messages;

        let blnRes: Result<number>;
        let ndRes: Result<Node>;
        let nullRes: Result<null>;

        while (true) {

            if (this.parser.isEOF()) {
                result.messages.push(this.parser.getMessage("formula ended abruptly.", MessageType.warning));
                result.mergeState(ResultState.failing);
                result.promoteToSkippable();
                return;
            }
            else if (!inline && (nullRes = this.parser.match("]")).matched) {
                result.merge(nullRes);
                result.highlights.push(this.parser.getHighlight(HighlightType.operator, -1, 0));
                return;
            }
            else if (inline && (nullRes = this.parser.match("/")).matched) {
                result.merge(nullRes);
                result.highlights.push(this.parser.getHighlight(HighlightType.operator, -1, 0));
                return;
            }

            else if ((blnRes = this.parser.matchMultilineBlank()).matched) {
                result.merge(blnRes);
                if (blnRes.content >= 2) {
                    result.messages.push(this.parser.getMessage("Formula should not have two or more newline.", MessageType.warning));
                    result.mergeState(ResultState.failing);
                    result.promoteToSkippable();
                }
            }

            else if ((nullRes = this.parser.match("`")).matched) {
                result.highlights.push(this.parser.getHighlight(HighlightType.operator, -1, 0));
                result.merge(nullRes);
                if (inline) {
                    msg.push(this.parser.getMessage("Embeded formula should not have element defination.", MessageType.warning));
                    result.mergeState(ResultState.failing);
                    result.promoteToSkippable();
                }

                ndRes = this.matchElements("`");
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                ndRes.content.type = this.definationType;
                node.children.push(ndRes.content);
            }

            else if ((nullRes = this.parser.match("[")).matched) {
                result.merge(nullRes);

                ndRes = this.matchElements();
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if ((ndRes = this.matchElement()).matched) {
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }

            else {
                result.messages.push(this.parser.getMessage("Unexpected character."));
                result.mergeState(ResultState.failing);

                result.promoteToSkippable();
                if (inline) {
                    this.skipByBracketsEndWith("/");
                }
                else {
                    this.skipByBracketsEndWith("]");
                }
                return;
            }
        }
    }
    */

    // MatchElements: failing | skippable | successful

    matchElements(endWith: string = "]"): Result<Node> {
        let result = new Result<Node>(new Node(this.formulaType));
        let preIndex = this.parser.index;
        this.parser.begin("elements");
        this.myMatchElements(result, endWith);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    private myMatchElements(result: Result<Node>, endWith: string) {

        let node = result.content;
        let msg = result.messages;

        let blnRes: Result<number>;
        let ndRes: Result<Node>;
        let nullRes: Result<null>;

        while (true) {

            if (this.parser.isEOF()) {
                result.mergeState(ResultState.failing);
                msg.push(this.parser.getMessage(`Formula ended abruptly.`));

                return;
            }
            else if ((nullRes = this.parser.match(endWith)).matched) {
                result.merge(nullRes);
                // if (result.shouldTerminate) {
                //     msg.push(this.parser.getMessage(`Missing '${endWith}' in formula.`));
                //     return;
                // }
                if (endWith != "]") {
                    result.highlights.push(this.parser.getHighlight(HighlightType.operator, -1, 0));
                }
                break;
            }

            else if ((blnRes = this.parser.matchMultilineBlank()).matched) {
                result.merge(blnRes);
                if (blnRes.content >= 2) {
                    result.messages.push(this.parser.getMessage("Formula should not have two or more newline.", MessageType.warning));
                    result.mergeState(ResultState.failing);
                    result.promoteToSkippable();
                }
            }

            else if ((nullRes = this.parser.match("[")).matched) {
                result.merge(nullRes);

                ndRes = this.matchElements("]");
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if ((nullRes = this.parser.match("`")).matched) {
                result.merge(nullRes);
                result.highlights.push(this.parser.getHighlight(HighlightType.operator, -1, 0));

                ndRes = this.matchElements("`");
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                ndRes.content.type = this.definationType;
                node.children.push(ndRes.content);
            }

            else if ((ndRes = this.matchEscapeElement()).matched) {
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if ((ndRes = this.matchInlineText()).matched) {
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }

            else if ((ndRes = this.matchElement()).matched) {
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }

            else {
                result.mergeState(ResultState.failing);
                console.log("[[logic error]].");
                return;
            }
        }
    }

    // MatchElement: failing | (matched) | skippable | successful

    matchElement(): Result<Node> {
        let result = new Result<Node>(new Node(this.elementType));
        let preIndex = this.parser.index;
        this.parser.begin("element");
        this.myMatchElement(result);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    private myMatchElement(result: Result<Node>) {

        let node = result.content;
        let msg = result.messages;
        if (this.parser.isEOF()) {
            return;
        }

        result.GuaranteeMatched();
        if (this.parser.is(Math.nameChar)) {

            while (true) {
                if (this.parser.isEOF()) {
                    break;
                }
                else if (this.parser.is(Math.nameChar)) {
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
            result.mergeState(ResultState.successful);
            this.parser.moveUnicode();
        }
    }

    // MatchEscapeElement: failing | (matched) | skippable | successful

    matchEscapeElement(): Result<Node> {
        let result = new Result<Node>(new Node(this.escapeElementType));
        let preIndex = this.parser.index;
        this.parser.begin("escape-element");
        this.myMatchEscapeElement(result);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    private myMatchEscapeElement(result: Result<Node>) {

        let node = result.content;
        let msg = result.messages;

        let nodeRes: Result<Node>;

        result.merge(this.parser.match("@"));
        if (result.shouldTerminate) {
            result.messages.push(this.parser.getMessage("Missing '@' in formula."));
            return;
        }
        result.GuaranteeMatched();

        nodeRes = this.matchElement();
        result.merge(nodeRes);
        if (result.shouldTerminate) {
            result.promoteToSkippable();
            result.content.type = this.elementType;
            result.content.content = "@";
            result.messages.push(this.parser.getMessage("'@' must have element."));
            return;
        }
        result.content.content = nodeRes.content.content;

    }

    // MatchInlineText: failing | (matched) | skippable | successful

    matchInlineText(): Result<Node> {
        let result = new Result<Node>(new Node(this.inlineTextType));
        let preIndex = this.parser.index;
        this.parser.begin("inline-text");
        this.myMatchInlineText(result);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        if (result.failed) {
            this.parser.index = preIndex;
        }
        return result;
    }

    private myMatchInlineText(result: Result<Node>) {

        let node = result.content;
        let msg = result.messages;

        result.merge(this.parser.match("\""));
        if (result.shouldTerminate) {
            result.messages.push(this.parser.getMessage("Missing '\"' in formula."));
            return;
        }
        result.GuaranteeMatched();

        while (true) {
            if (this.parser.isEOF()) {
                msg.push(this.parser.getMessage("Formula ended abruptly."));
                result.mergeState(ResultState.failing);
                result.promoteToSkippable();
                return;
            }
            else if (this.parser.is("\"")) {
                result.mergeState(ResultState.successful);
                this.parser.move();
                break;
            }
            else {
                node.content += this.parser.curChar();
                this.parser.move();
                result.mergeState(ResultState.successful);
            }
        }



    }

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

    // Part 2: analyse the syntax tree that constructed in Part 1, replace defination nodes with its content, and find out the correct math label function to handle the formula nodes. This part will use types of node as follows:
    // expression
    // (term) element
    // inline-text
    // infix
    // prefix


    analyse(node: Node): Result<Node> {

        let result = new Result<Node>(new Node(this.expressionType));

        /*
        // filter the defination, i.e. the chars surrounded by the ' '.
        for (let subnode of node.children) {
            if (subnode.type === this.definationType) {
                result.mergeState(ResultState.successful);

                if (subnode.children.length < 2) {
                    result.mergeState(ResultState.failing);
                    result.promoteToSkippable();
                    result.messages.push(this.parser.getMessage("Defination uncompleted."));
                    continue;
                }
                if (subnode.children[0].type != this.elementType) {
                    result.mergeState(ResultState.failing);
                    result.promoteToSkippable();
                    result.messages.push(this.parser.getMessage("Defination element unfounded."));
                    continue;
                }
                if (subnode.children[1].type != this.elementType || subnode.children[1].content != "↦") {
                    result.mergeState(ResultState.failing);
                    result.promoteToSkippable();
                    result.messages.push(this.parser.getMessage("Symbol '↦' unfounded."));
                    continue;
                }

                result.highlights.push({ begin: subnode.begin, end: subnode.begin + 1, type: 3 });
                result.highlights.push({ begin: subnode.end, end: subnode.end + 1, type: 3 });

                let newNode = new Node(this.formulaType);
                for (let i = 2; i < subnode.children.length; i++) {
                    newNode.children.push(Node.clone(subnode.children[i]));
                }

                this.blockHandlerTable.addDefination(subnode.children[0].content, newNode);
            }

        }

        for (let i = node.children.length - 1; i >= 0; i--) {
            if (node.children[i].type === this.definationType) {
                node.children.splice(i, 1);
            }
        }
            */

        // analyse 

        let nResult = this.analyseFormula(node);
        result.merge(nResult);
        result.content = nResult.content;
        return result;
    }

    // AnalyseFormula: failing | skippable | successful

    analyseFormula(node: Node): Result<Node> {
        let index = new Ref<number>(0);
        let result = new Result(new Node(this.formulaType));

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

    analyseExpression(node: Node, index: Ref<number>, endTerm: string[] = []): Result<Node> {
        let result = new Result(new Node(this.expressionType));
        this.parser.begin("analyse-expression");
        this.myAnalyseExpression(node, index, endTerm, result);
        this.parser.end();
        if(result.content.children.length == 0) {
            result.content.children.push(new Node(this.infixType, ""));
        }
        return result;
    }

    myAnalyseExpression(parnode: Node, index: Ref<number>, endTerm: string[], result: Result<Node>) {

        let msg = result.messages;

        let termHeap = new Heap<Node>();
        let operatorHeap = new Heap<string>();


        if (this.isEOF(parnode, index, endTerm)) {
            //msg.push(this.parser.getMessage("Expression should not be empty."));
            
            result.mergeState(ResultState.successful);
            return;
        }


        let res: Result<Node>;
        let curOp: string;

        let hasInfixOperator = true;
        let constructing = false;
        let constructing2 = false;

        while (true) {
            if (constructing) {
                // cur operator = Blank operator
                let lastOp = operatorHeap.top();
                //  == undefined 必须用, 空串会被判为false
                if (lastOp == undefined || this.operatorTable.getInfixOperator(lastOp)!.priority <= OperatorTable.BlankOperator.priority) {
                    operatorHeap.push("");
                    termHeap.push(res!.content);
                    hasInfixOperator = false;
                    constructing = false;
                }
                else {
                    if (!this.construct(termHeap, operatorHeap)) {
                        result.messages.push(this.parser.getMessage("Infix operator pattern failed."));
                        result.mergeState(ResultState.failing);
                        return;
                    }
                }
                continue;
            }

            if (constructing2) {
                let lastOp = operatorHeap.top();
                //  == undefined 必须用, 空串会被判为false
                if (lastOp == undefined || this.operatorTable.getInfixOperator(lastOp)!.priority <= this.operatorTable.getInfixOperator(curOp!)!.priority) {
                    operatorHeap.push(curOp!);
                    hasInfixOperator = true;
                    constructing2 = false;
                }
                else {
                    if (!this.construct(termHeap, operatorHeap)) {
                        result.messages.push(this.parser.getMessage("Infix operator pattern failed."));
                        result.mergeState(ResultState.failing);
                        return;
                    }
                }

                continue;
            }

            if (this.isEOF(parnode, index, endTerm)) {
                if (hasInfixOperator) {
                    result.messages.push(this.parser.getMessage("Missing last term of expression."));
                    result.mergeState(ResultState.failing);
                    return;
                }
                // same as below
                if (operatorHeap.length != 0) {
                    if (!this.construct(termHeap, operatorHeap)) {
                        result.messages.push(this.parser.getMessage("Infix operator pattern failed."));
                        result.mergeState(ResultState.failing);
                        return;
                    }
                    continue;
                }

                if (termHeap.length != 1 || operatorHeap.length != 0) {
                    result.messages.push(this.parser.getMessage("expression failed."));
                    result.mergeState(ResultState.failing);
                    return;
                }

                result.content.children.push(termHeap.pop()!);
                return;

            }

            else if ((res = this.analyseTerm(parnode, index)).matched) {
                result.merge(res);
                if (result.shouldTerminate) {
                    //msg.push(this.parser.getMessage("Match term failed."));
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
                        constructing = true;
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
                    result.messages.push(this.parser.getMessage("Infix operator repeated."));
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
                    constructing2 = true;
                }
            }

            else {
                console.log("Logic error.");
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

    analyseTerm(node: Node, index: Ref<number>): Result<Node> {
        let result = new Result(new Node(this.expressionType));
        this.parser.begin("analyse-term");
        this.myAnalyseTerm(node, index, result);
        this.parser.end();
        //注意result.content整个被换掉了
        //result.content.begin = preIndex;
        //result.content.end = this.index;
        return result;
    }

    myAnalyseTerm(parnode: Node, index: Ref<number>, result: Result<Node>) {
        let msg = result.messages;

        if (this.isEOF(parnode, index, [])) {
            msg.push(this.parser.getMessage("Term should not be empty."));
            return;
        }
        let node = parnode.children[index.value];

        if (node.type === this.formulaType || node.type === this.definationType) {
            result.GuaranteeMatched();

            let nResult = this.analyseFormula(node);
            result.merge(nResult);
            if (nResult.shouldTerminate) {
                return result;
            }
            result.content = nResult.content.children[0];
            index.value++;
        }
        else if (node.type === this.inlineTextType) {
            result.GuaranteeMatched();

            result.mergeState(ResultState.successful);
            result.highlights.push(this.parser.getHighlight(HighlightType.string, node));
            index.value++;
            result.content = Node.clone(node);
        }
        else if (node.type === this.elementType) {

            let infixOp = this.operatorTable.getInfixOperator(node.content);
            let prefixOp = this.operatorTable.getPrefixOperator(node.content);
            if (infixOp) {
                msg.push(this.parser.getMessage("Term should not be empty."));
                return;
            }
            else if (prefixOp) {
                result.GuaranteeMatched();

                result.mergeState(ResultState.successful);
                result.highlights.push(this.parser.getHighlight(HighlightType.operator, node));

                let nNode = new Node(this.prefixType);
                let format = prefixOp.format;

                nNode.content = format[0];
                index.value++;

                for (let i = 1; i < format.length; i++) {
                    let res: Result<Node>;
                    switch (format[i]) {
                        case "[expr]":

                            if (i + 1 < format.length) {
                                res = this.analyseExpression(parnode, index, [format[i + 1]]);
                            }
                            else {
                                res = this.analyseExpression(parnode, index);
                            }
                            result.merge(res);
                            if (result.shouldTerminate) {
                                msg.push(this.parser.getMessage("Prefix match [expr] failed."));
                                return;
                            }
                            nNode.children.push(res.content);
                            break;

                        case "[term]":
                            res = this.analyseTerm(parnode, index);

                            result.merge(res);
                            if (result.shouldTerminate) {
                                msg.push(this.parser.getMessage("Prefix match [term] failed."));
                                return;
                            }
                            nNode.children.push(res.content);
                            break;

                        default:
                            if (this.isEOF(parnode, index, [])) {
                                result.mergeState(ResultState.failing);
                                msg.push(this.parser.getMessage("Prefix match element ended abruptly."));
                                return;
                            }

                            node = parnode.children[index.value];
                            if (node.type === this.elementType && node.content === format[i]) {
                                result.mergeState(ResultState.successful);
                                result.highlights.push(this.parser.getHighlight(HighlightType.operator, node));
                                index.value++;
                                break;
                            }
                            else {
                                result.mergeState(ResultState.failing);
                                msg.push(this.parser.getMessage("Prefix match element failed."));
                                return;
                            }
                    }
                }

                result.content = nNode;
            }
            else {
                result.GuaranteeMatched();
                if(!this.symbols.has(node.content) && !this.notations.has(node.content)) {
                    result.mergeState(ResultState.failing);
                    msg.push(this.parser.getMessage(`Element ${node.content} not recognized.`));
                    result.promoteToSkippable();
                }
                else {

                    result.mergeState(ResultState.successful);

                    result.highlights.push(this.parser.getHighlight(HighlightType.variable, node));

                    result.content = Node.clone(node);
                    //result.content.type = this.termType;
                }
                index.value++;

            }
        }
        else if (node.type === this.escapeElementType) {

                result.GuaranteeMatched();
                if(!this.symbols.has(node.content) && !this.notations.has(node.content)) {
                    result.mergeState(ResultState.failing);
                    msg.push(this.parser.getMessage(`Escape element ${node.content} not recognized.`));
                    result.promoteToSkippable();
                }
                else {
                    result.mergeState(ResultState.successful);
                    result.highlights.push(this.parser.getHighlight(HighlightType.variable, node));

                    result.content = Node.clone(node);
                    result.content.type = this.elementType;
                }
                index.value++;
            
        }
    }

    // AnalyseOperator: failing | matched | skippable | successful

    analyseOperator(node: Node, index: Ref<number>): Result<Node> {
        let result = new Result(new Node(this.expressionType));
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
            msg.push(this.parser.getMessage("Operator should not be empty."));
            return;
        }
        let node = parnode.children[index.value];
        if (node.type === this.elementType) {
            let iop = this.operatorTable.getInfixOperator(node.content);
            if (iop) {
                result.GuaranteeMatched();

                result.mergeState(ResultState.successful);
                result.highlights.push(this.parser.getHighlight(HighlightType.operator, node));
                index.value++;
                result.content = Node.clone(node);
            }
        }
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
