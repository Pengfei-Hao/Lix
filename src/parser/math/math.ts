
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
    elementType: Type;
    definationType: Type;
    mathTextType: Type;

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
        this.definationType = this.parser.typeTable.add("defination")!;
        this.mathTextType = this.parser.typeTable.add("math-text")!;

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

    // Part 1: scan the text and construct the syntax tree. This part will use types of node as follows:
    // 1. type: formula, content: [unused], children: (contents symbol nodes and formula nodes 1. & 2.)
    // 2. type: symbol, content: (name of this symbol), children: [unused]
    // 3. type: defination, content: [unused], children: (contents symbol nodes and formula nodes 1. & 2.)


    static nameChar = /[0-9a-zA-Z]/;
    //static alphabetChar = /[a-zA-Z]/;
    //static blankChar = /[\t \v\f\r\n]/;
    //static newlineChar = /[\r\n]/;
    //static digitChar = /[0-9]/;
    //static symbolChar = /[\~\!\@\#\$\%\^\&\*\(\)\_\+\-\=\{\}\|\\\:\;\"\'\<\>\,\.\?\/↦]/;

    private myMatchFormula(result: MatchResult, inline = false) {

        let node = result.content;
        let msg = result.messages;

        let ndRes: Result<Node>;
        let nullRes: Result<null>;


        if(inline) {
            ndRes = this.matchElements("/");
        }
        else {
            ndRes = this.matchElements("]");
        }
        result.merge(ndRes);
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
        result.content = ndRes.content;

        if (inline) {
            nullRes = this.parser.match("/");
            if (result.shouldTerminate) {
                msg.push(this.parser.getMessage("Missing '/'."));
                return;
            }
            result.highlights.push(this.parser.getHighlight(HighlightType.operator, -1, 0));
        }
        else {
            nullRes = this.parser.match("]");
            if (result.shouldTerminate) {
                msg.push(this.parser.getMessage("Missing ']'."));
                return;
            }
        }
        
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
                break;
            }
            else if ((nullRes = this.parser.match(endWith)).matched) {
                result.merge(nullRes);
                result.highlights.push(this.parser.getHighlight(HighlightType.operator, -1, 0));
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
                result.highlights.push(this.parser.getHighlight(HighlightType.operator, -1, 0));

                ndRes = this.matchElements();
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

            else if ((ndRes = this.matchElement()).matched) {
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    return;
                }
                node.children.push(ndRes.content);
            }

            else {
                result.messages.push(this.parser.getMessage("Unexpected character in formula."));
                result.mergeState(ResultState.failing);

                result.promoteToSkippable();
                this.skipByBracketsEndWith(endWith);
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

        else if (this.parser.is(Math.nameChar)) {
            result.GuaranteeMatched();
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

        // 数学的特殊符号属于 0x10000 平面, ts 使用 utf16 编码, 因而占两个字符的位置, 要使用 curUnicodeChar
        else if (this.symbols.has(this.parser.curUnicodeChar())) {
            result.GuaranteeMatched();
            node.content = this.parser.curUnicodeChar();
            result.mergeState(ResultState.successful);
            this.parser.moveUnicode();
        }


        else if (this.parser.is("\"")) {
            result.GuaranteeMatched();
            this.parser.move();
            result.mergeState(ResultState.successful);
            node.type = this.mathTextType;

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
        else {
            //result.messages.push(this.parser.getMessage("Formula has unexpected character."));
            //result.mergeState(ResultState.failing);
            return;
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
    /*
    private myMatchFormula(): MatchResult {
        var node = new Node(this.formulaType);
    
        var text = "";
        while (this.parser.notEnd()) {
            if (this.parser.is(Parser.blank)) {
    
                if (text !== "") {
                    node.children.push(new Node(this.symbolType, text));
                    text = "";
                }
                
                var count = 0;
                do {
                    if (this.parser.is(Parser.newline)) {
                        count++;
                    }
                    this.parser.move();
                } while (this.parser.notEnd() && this.parser.is(Parser.blank));
    
                // if(count >= 2) {
                //     text += "\n\n";
                //     break;
                // }
                // else {
                //     text += " ";
                // }
            }
    
            else if (this.parser.is("'")) {
                let result = this.matchDefination();
                node.children.push(result.content);
    
                if (!result.success) {
                    return new Result(false, node);
                }
    
    
            }
            else if (this.parser.is("[")) {
                if (text !== "") {
                    node.children.push(new Node(this.symbolType, text));
                    text = "";
                }
                
                this.parser.move();
                let result = this.matchSymbols();
                if (!result.success) {
                    return new Result(false, node);
                }
    
                node.children.push(result.content);
            }
    
            else if (this.parser.is("]")) {
                this.parser.move();
                if (text !== "") {
                    node.children.push(new Node(this.symbolType, text));
                }
                return new Result(true, node);
            }
    
            else {
                text += this.parser.curChar();
                this.parser.move();
            }
        }
    
        if (text !== "") {
            node.children.push(new Node(this.symbolType, text));
        }
        return new Result(false, node);
    }
    
    private matchDefination(): MatchResult {
        this.parser.move();
        this.parser.skipBlank();
        let text = "";
        let node = new Node(this.definationType);
        while (this.parser.notEnd()) {
            if (this.parser.is(Parser.blank)) {
    
                if (text !== "") {
                    node.children.push(new Node(this.symbolType, text));
                    text = "";
                }
    
                let count = 0;
                do {
                    if (this.parser.is(Parser.newline)) {
                        count++;
                    }
                    this.parser.move();
                } while (this.parser.notEnd() && this.parser.is(Parser.blank));
                if (count >= 2) {
    
                }
            }
    
            else if (this.parser.is("[")) {
                if (text !== "") {
                    node.children.push(new Node(this.symbolType, text));
                }
                text = "";
                this.parser.move();
                var result = this.matchSymbols();
                if (!result.success) {
                    return new Result(false, node);
                }
    
                node.children.push(result.content);
            }
            else if (this.parser.is("'")) {
                this.parser.move();
                if (text !== "") {
                    node.children.push(new Node(this.symbolType, text));
                }
                return new Result(true, node);
            }
            else {
                text += this.parser.curChar();
                this.parser.move();
            }
        }
        if (text !== "") {
            node.children.push(new Node(this.symbolType, text));
        }
        return new Result(false, node);
    }
    
    private matchSymbols(): MatchResult {
        let text = "";
        let node = new Node(this.formulaType);
        while (this.parser.notEnd()) {
            if (this.parser.is(Parser.blank)) {
                if (text !== "") {
                    node.children.push(new Node(this.symbolType, text));
                    text = "";
                }
                
                var count = 0;
                do {
                    if (this.parser.is(Parser.newline)) {
                        count++;
                    }
                    this.parser.move();
                } while (this.parser.notEnd() && this.parser.is(Parser.blank));
    
                // if(count >= 2) {
                //     text += "\n\n";
                //     break;
                // }
                // else {
                //     text += " ";
                // }
            }
    
            else if (this.parser.is("[")) {
                if (text !== "") {
                    node.children.push(new Node(this.symbolType, text));
                }
                text = "";
                this.parser.move();
                var result = this.matchSymbols();
                if (!result.success) {
                    return new Result(false, node);
                }
    
                node.children.push(result.content);
    
            }
            else if (this.parser.is("]")) {
                this.parser.move();
                if (text !== "") {
                    node.children.push(new Node(this.symbolType, text));
                }
                return new Result(true, node);
    
            }
            else {
                text += this.parser.curChar();
                this.parser.move();
            }
        }
    
        if (text !== "") {
            node.children.push(new Node(this.symbolType, text));
        }
        return new Result(false, node);
    }
    
    */

    // Part 2: analyse the syntax tree that constructed in Part 1, replace defination nodes with its content, and find out the correct math label function to handle the formula nodes. This part will use types of node as follows:
    // 1. type: formula, content: [unused], children: (contents symbol nodes and formula nodes 1. & 2.)
    // 2. type: symbol, content: "${name of symbol}", children: [unused]
    // 3. type: fraction, content: [unused], children: (firstNode 1. secondNode 1.)
    // 4. type: matrix, content: [unused], children: (nodes 1.)
    // 5. type: (some math label name), content: (depends on math label), children: (depends on math label)

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

        let nResult = this.matchFormulaNode(node);
        result.merge(nResult);
        result.content = nResult.content;
        return result;
    }

    matchFormulaNode(node: Node): Result<Node> {
        let index = new Ref<number>(0);
        let result = new Result(new Node(this.formulaType));

        this.parser.begin("analysis-formula-node");
        this.myMatchFormulaNode(node, index, result);
        this.parser.end();
        //result.content.begin = preIndex;
        //result.content.end = this.index;
        return result;
    }

    myMatchFormulaNode(node: Node, index: Ref<number>, result: Result<Node>) {
        let res = this.matchExpression(node, index);
        result.merge(res);
        if (result.shouldTerminate) {
            result.promoteToSkippable();
        }
        result.content = res.content;
    }

    matchExpression(node: Node, index: Ref<number>, endTerm: string[] = []): Result<Node> {
        let result = new Result(new Node(this.expressionType));
        this.parser.begin("analysis-expression");
        this.myMatchExpression(node, index, endTerm, result);
        this.parser.end();
        //result.content.begin = preIndex;
        //result.content.end = this.index;
        return result;
    }

    myMatchExpression(parnode: Node, index: Ref<number>, endTerm: string[], result: Result<Node>) {

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
                    if(!this.construct(termHeap, operatorHeap)) {
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
                if (lastOp  == undefined || this.operatorTable.getInfixOperator(lastOp)!.priority <= this.operatorTable.getInfixOperator(curOp!)!.priority) {
                    operatorHeap.push(curOp!);
                    hasInfixOperator = true;
                    constructing2 = false;
                }
                else {
                    if(!this.construct(termHeap, operatorHeap)) {
                        result.messages.push(this.parser.getMessage("Infix operator pattern failed."));
                        result.mergeState(ResultState.failing);
                        return;
                    }
                }

                continue;
            }

            if (this.isEOF(parnode, index, endTerm)) {
                if(hasInfixOperator) {
                    result.messages.push(this.parser.getMessage("Missing last term of expression."));
                    result.mergeState(ResultState.failing);
                    return;
                }
                // same as below
                if (operatorHeap.length != 0) {
                    if(!this.construct(termHeap, operatorHeap)) {
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

            else if ((res = this.matchTerm(parnode, index)).matched) {
                result.merge(res);
                if (result.shouldTerminate) {
                    msg.push(this.parser.getMessage("Match term failed."));
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

            else if ((res = this.matchOperator(parnode, index)).matched) {
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

        if(pat.size != 0) {
            if(!pat.has(nNode.content)) {
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
            if (child.type === this.elementType && child.content === op) {
                return true;
            }
        }
        return false;
    }

    matchTerm(node: Node, index: Ref<number>): Result<Node> {
        let result = new Result(new Node(this.expressionType));
        this.parser.begin("analysis-term");
        this.myMatchTerm(node, index, result);
        this.parser.end();
        //注意result.content整个被换掉了
        //result.content.begin = preIndex;
        //result.content.end = this.index;
        return result;
    }

    myMatchTerm(parnode: Node, index: Ref<number>, result: Result<Node>) {
        let msg = result.messages;
        if (this.isEOF(parnode, index, [])) {
            msg.push(this.parser.getMessage("Term should not be empty."));
            return;
        }
        let node = parnode.children[index.value];

        if (node.type === this.formulaType || node.type === this.definationType) {
            result.GuaranteeMatched();

            let nResult = this.matchFormulaNode(node);
            result.merge(nResult);
            if (nResult.shouldTerminate) {
                return result;
            }
            result.content = nResult.content;
            index.value++;
        }
        else if (node.type === this.mathTextType) {
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
                                res = this.matchExpression(parnode, index, [format[i + 1]]);
                            }
                            else {
                                res = this.matchExpression(parnode, index);
                            }
                            result.merge(res);
                            if (result.shouldTerminate) {
                                msg.push(this.parser.getMessage("Prefix match [expr] failed."));
                                return;
                            }
                            nNode.children.push(res.content);
                            break;

                        case "[term]":
                            res = this.matchTerm(parnode, index);

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
                result.mergeState(ResultState.successful);
                result.highlights.push(this.parser.getHighlight(HighlightType.variable, node));
                index.value++;
                result.content = Node.clone(node);
                result.content.type = this.termType;
            }
        }
    }

    matchOperator(node: Node, index: Ref<number>): Result<Node> {
        let result = new Result(new Node(this.expressionType));
        this.parser.begin("analysis-operator");
        this.myMatchOperator(node, index, result);
        this.parser.end();
        //result.content.begin = preIndex;
        //result.content.end = this.index;
        return result;
    }

    myMatchOperator(parnode: Node, index: Ref<number>, result: Result<Node>) {
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
    /*
    find(node: Node): AnalyseResult {
        let result: AnalyseResult = new AnalyseResult(true);

        for (let handle of this.blockHandlerTable.blockHandleFunctions) {
            result = handle(node);
            if (result.success) {
                break;
            }
        }
        if (!result.success) {
            result = this.formula(node);
        }
        return result;
    }
        */

    /*
    expression(parnode: Node, start: number = 0, end: number = parnode.children.length): Result<Node> {

        let result = new Result<Node>(new Node(this.expressionType));

        let termHeap = new Heap<Node>();
        let operatorHeap = new Heap<InfixOperator>();

        let hasInfixOperator = true;

        let index = start;

        if (start === end) {
            result.messages.push(this.parser.getMessage("Expression empty."));
            return result;
        }

        while (true) {
            if (index === end) {
                // same as below
                if (operatorHeap.length != 0) {
                    let nNode = new Node(this.infixType);
                    nNode.children.push(termHeap.pop()!);

                    let top: InfixOperator | undefined;
                    let lop = operatorHeap.top()!;
                    while ((top = operatorHeap.top()) && top.priority === lop.priority) {
                        operatorHeap.pop();
                        nNode.children.push(termHeap.pop()!);
                    }
                    nNode.children.reverse();
                    termHeap.push(nNode);
                    continue;
                }

                if (termHeap.length != 1 || operatorHeap.length != 0) {
                    result.messages.push(this.parser.getMessage("expression failed."));
                    result.mergeState(ResultState.matched);
                    return result;
                }
                result.content.children.push(termHeap.pop()!);
                return result;

            }

            let node = parnode.children[index];

            if (node.type === this.formulaType) {
                let nResult = this.formula(node);
                result.merge(nResult);
                if (nResult.shouldTerminate) {
                    return result;
                }
                if (!hasInfixOperator) {

                    let lop = operatorHeap.top();

                    // same as below
                    if (!lop || lop.priority <= OperatorTable.BlankOperator.priority) {
                        operatorHeap.push(OperatorTable.BlankOperator);
                        termHeap.push(nResult.content);
                        hasInfixOperator = false;
                        index++;
                    }
                    else {

                        let nNode = new Node(this.infixType);
                        nNode.children.push(termHeap.pop()!);

                        let top: InfixOperator | undefined;
                        while ((top = operatorHeap.top()) && top.priority === lop.priority) {
                            operatorHeap.pop();
                            nNode.children.push(termHeap.pop()!);
                        }
                        nNode.children.reverse();

                        termHeap.push(nNode);
                    }
                }
                else {
                    termHeap.push(nResult.content);
                    hasInfixOperator = false;
                    index++;
                }
            }
            else if (node.type === this.mathTextType) {
                result.mergeState(ResultState.successful);
                if (!hasInfixOperator) {

                    let lop = operatorHeap.top();

                    // same as below
                    if (!lop || lop.priority <= OperatorTable.BlankOperator.priority) {
                        operatorHeap.push(OperatorTable.BlankOperator);
                        termHeap.push(Node.clone(node));
                        hasInfixOperator = false;
                        index++;
                    }
                    else {

                        let nNode = new Node(this.infixType);
                        nNode.children.push(termHeap.pop()!);

                        let top: InfixOperator | undefined;
                        while ((top = operatorHeap.top()) && top.priority === lop.priority) {
                            operatorHeap.pop();
                            nNode.children.push(termHeap.pop()!);
                        }
                        nNode.children.reverse();

                        termHeap.push(nNode);
                    }
                }
                else {
                    termHeap.push(Node.clone(node));
                    hasInfixOperator = false;
                    index++;
                }
            }
            else if (node.type === this.symbolType) {
                let iop = this.operatorTable.getInfixOperator(node.content);
                let pop = this.operatorTable.getPrefixOperator(node.content);
                if (iop) {
                    result.mergeState(ResultState.successful);
                    if (hasInfixOperator) {
                        result.messages.push(this.parser.getMessage("Infix operator repeated."));
                        result.mergeState(ResultState.matched);
                        return result;
                    }
                    let lop = operatorHeap.top();

                    if (!lop || lop.priority <= iop.priority) {
                        operatorHeap.push(iop);
                        hasInfixOperator = true;
                        index++;
                    }
                    else {
                        // same as above
                        let nNode = new Node(this.infixType);
                        nNode.children.push(termHeap.pop()!);

                        let top: InfixOperator | undefined;
                        while ((top = operatorHeap.top()) && top.priority === lop.priority) {
                            operatorHeap.pop();
                            nNode.children.push(termHeap.pop()!);
                        }
                        nNode.children.reverse();

                        termHeap.push(nNode);
                    }

                }
                else if (pop) {
                    result.mergeState(ResultState.successful);
                    let nNode = new Node(this.prefixType);

                    let j = index;
                    for (let i = 1; i < pop.format.length; i += 2) {
                        index++;
                        j = end;
                        if (i + 1 < pop.format.length) {
                            for (j = index; j < end; j++) {
                                if (parnode.children[j].type === this.symbolType && parnode.children[j].content === pop.format[i + 1]) {
                                    break;
                                }
                            }
                        }
                        let nResult = this.expression(parnode, index, j);
                        result.merge(nResult);
                        if (result.shouldTerminate) {
                            return result;
                        }
                        nNode.children.push(nResult.content);
                        index = j;
                    }
                    if (j < end) {
                        index++;
                    }

                    if (!hasInfixOperator) {

                        let lop = operatorHeap.top();

                        // same as below
                        if (!lop || lop.priority <= OperatorTable.BlankOperator.priority) {
                            operatorHeap.push(OperatorTable.BlankOperator);
                            termHeap.push(nNode);
                            hasInfixOperator = false;
                        }
                        else {

                            let nNode = new Node(this.infixType);
                            nNode.children.push(termHeap.pop()!);

                            let top: InfixOperator | undefined;
                            while ((top = operatorHeap.top()) && top.priority === lop.priority) {
                                operatorHeap.pop();
                                nNode.children.push(termHeap.pop()!);
                            }
                            nNode.children.reverse();

                            termHeap.push(nNode);
                        }
                    }
                    else {
                        termHeap.push(nNode);
                        hasInfixOperator = false;
                    }

                }
                else {
                    result.mergeState(ResultState.successful);
                    if (!hasInfixOperator) {

                        let lop = operatorHeap.top();

                        // same as below
                        if (!lop || lop.priority <= OperatorTable.BlankOperator.priority) {
                            operatorHeap.push(OperatorTable.BlankOperator);
                            termHeap.push(Node.clone(node));
                            hasInfixOperator = false;
                            index++;
                        }
                        else {

                            let nNode = new Node(this.infixType);
                            nNode.children.push(termHeap.pop()!);

                            let top: InfixOperator | undefined;
                            while ((top = operatorHeap.top()) && top.priority === lop.priority) {
                                operatorHeap.pop();
                                nNode.children.push(termHeap.pop()!);
                            }
                            nNode.children.reverse();

                            termHeap.push(nNode);
                        }
                    }
                    else {
                        termHeap.push(Node.clone(node));
                        hasInfixOperator = false;
                        index++;
                    }
                }
            }
            else {
                console.log("Logic error.");
                result.mergeState(ResultState.matched);
                return result;
            }

        }
    }
*/

    /*
    term(node: Node): Result<Node> {

        let result = new Result<Node>(new Node(this.formulaType));

        if (node.type === this.symbolType) {
            let op: PrefixOperator | undefined;
            if (op = this.operatorTable.getPrefixOperator(node.content)) {
                result.mergeState(ResultState.successful);
                //result.highlights.push({ begin: node.begin, end: node.end, type: 0 });
                for (int i = 1; i <)
            }
            else if (this.operatorTable.getInfixOperator(node.content)) {
                result.messages.push(this.getMessage("[[Logic error]]", node.begin, MessageType.warning));
            }
            else {
                result.mergeState(ResultState.successful);
                result.highlights.push({ begin: node.begin, end: node.end, type: 0 });
                result.content = Node.clone(node);
            }

        }
        else if (node.type === this.mathTextType) {
            result.mergeState(ResultState.successful);
            result.highlights.push({ begin: node.begin, end: node.end, type: 0 });
            result.content = Node.clone(node);
        }

        else if (node.type === this.formulaType) {
            let nResult = this.expression(node);
            result.merge(nResult);
            result.content = nResult.content;
            if (nResult.shouldTerminate) {
                return result;
            }
        }
        else {
            result.messages.push(this.getMessage("[[Logic error]]", node.begin, MessageType.warning));

        }

        return result;
    }
    */

    /*
    formula(node: Node): Result<Node> {
        return this.expression(node);
    }
*/
    /*

    priority: Map<string, number> = new Map([["/", 1], [" ", 0], ["sum", -1], ["to", -1]]);

    formula(node: Node): AnalyseResult {

        let result: AnalyseResult = new AnalyseResult();

        for (let i = 0; i < node.children.length; i++) {
            let subnode = node.children[i];

            if (subnode.type === this.symbolType) {
                result.mergeState(ResultState.successful);

                result.highlights.push({begin: subnode.begin, end: subnode.end, type: 0});

                let resultOfMath = this.blockHandlerTable.symbols.get(subnode.content);
                if (resultOfMath === undefined) {
                    let resultOfDefination = this.blockHandlerTable.definations.get(subnode.content);
                    if (resultOfDefination != undefined) {
                        node.children.splice(i, 1);
                        for (let j = 0; j < resultOfDefination.children.length; j++) {
                            node.children.splice(i + j, 0, resultOfDefination.children[j]);
                        }
                        i--;
                    }

                    else {
                        result.messages.push(this.getMessage("Undefined symbol.", subnode.begin, MessageType.error));
                        result.mergeState(ResultState.skippable);
                        continue;
                    }
                }
            }
            else if (subnode.type === this.mathTextType) {
                result.mergeState(ResultState.successful);
                result.highlights.push({begin: subnode.begin, end: subnode.end, type: 0});
            }

            else if (subnode.type === this.formulaType) {
                let nResult = this.formula(subnode);
                result.merge(nResult);
                if(nResult.shouldTerminate) {
                    return result;
                }
                
            }
            else {
                result.messages.push(this.getMessage("[[Logic error]]", subnode.begin, MessageType.warning));
                result.mergeState(ResultState.matched);
                return result;
            }
        }
        return result;
    }
    */

    /*
    frac(node: Node): AnalyseResult {

        let result: AnalyseResult = new AnalyseResult(true);

        let isMatch = false;
        let pos = -1;
        for (let i = 0; i < node.children.length; i++) {
            let subnode = node.children[i];
            if (subnode.type === this.symbolType && subnode.content === "/") {
                isMatch = true;
                pos = i;
                break;
            }
        }

        if (!isMatch) {
            result.success = false;
            result.messages.push(this.getMessage("Not frac block.", node.begin, MessageType.error));
            return result;
        }

        result.highlights.push({begin: node.children[pos].begin, end: node.children[pos].end, type: 1});

        let firstNode = new Node(this.formulaType);
        let secondNode = new Node(this.formulaType);
        for (let i = 0; i < pos; i++) {
            firstNode.children.push(node.children[i]);
        }
        for (let i = pos + 1; i < node.children.length; i++) {
            secondNode.children.push(node.children[i]);
        }
        
        let fResult = this.formula(firstNode);
        result.merge(fResult);
        let sResult = this.formula(secondNode);
        result.merge(sResult);

        if(result.success) {
            node.children = [firstNode, secondNode];
            node.type = this.fractionType;
        }

        return result;
    }

    matrix(node: Node): AnalyseResult {

        let result: AnalyseResult = new AnalyseResult(true);

        let newChildren: Node[] = [new Node(this.formulaType)];
        let count = 0;
        for (let i = 0; i < node.children.length; i++) {
            if (node.children[i].content === ";") {
                count++;

                result.highlights.push({begin: node.children[i].begin, end: node.children[i].end, type: 1});

                newChildren.push(new Node(this.formulaType));
            }
            else {
                newChildren[count].children.push(node.children[i]);
            }
        }


        for (let i = 0; i < newChildren.length; i++) {
            result.merge(this.formula(newChildren[i]));
        }

        if(result.success) {
            node.children = newChildren;
            node.type = this.matrixType;
        }

        return result;
    }

    sqrt(node: Node): AnalyseResult {

        let result: AnalyseResult = new AnalyseResult(true);

        let lastNode;
        if (node.children.length === 0) {
            result.success = false;
            result.messages.push(this.getMessage("Sqrt block should not be empty.", node.begin, MessageType.error));
            return result;
        }

        lastNode = node.children[node.children.length - 1];
        if (lastNode.type !== this.symbolType || lastNode.content !== "^2") {
            result.success = false;
            result.messages.push(this.getMessage("Sqrt block should ended with ^2.", lastNode.begin, MessageType.error));
            return result;
        }

        result.highlights.push({begin: lastNode.begin, end: lastNode.end, type: 1});

        let newNode = Node.clone(node);
        newNode.children.splice(node.children.length - 1);
        
        let nResult = this.formula(newNode);
        result.merge(nResult);

        if(result.success) {
            node.type = this.sqrtType;
            node.begin = newNode.begin;
            node.end = newNode.end;
            node.children = newNode.children;
            node.content = newNode.content;
        }
        
        return result;
    }

    sum(node: Node): AnalyseResult {

        let result: AnalyseResult = new AnalyseResult(true);

        let length = node.children.length;
        if (length === 0) {
            result.success = false;
            result.messages.push(this.getMessage("Sum block should not be empty.", node.begin, MessageType.error));
            return result;
        }

        if (!this.isSymbol(node.children[0], "sum")) {
            result.success = false;
            result.messages.push(this.getMessage("Sum block should begin with sum.", node.children[0].begin, MessageType.error));
            return result;
        }

        result.highlights.push({begin: node.children[0].begin, end: node.children[0].end, type: 1});


        let from = new Node(this.formulaType);
        let to = new Node(this.formulaType);
        let expr = new Node(this.formulaType);

        let i = 1;
        for (; i < length; i++) {
            if (!(this.isSymbol(node.children[i], "to") || this.isSymbol(node.children[i], ":"))) {
                from.children.push(node.children[i]);
            }
            else {
                break;
            }
        }

        if (i < length && this.isSymbol(node.children[i], "to")) {
            result.highlights.push({begin: node.children[i].begin, end: node.children[i].end, type: 1});

            i++;
            for (; i < length; i++) {
                if (!(this.isSymbol(node.children[i], ":"))) {
                    to.children.push(node.children[i]);
                }
                else {
                    break;
                }
            }
        }
        if (i < length && this.isSymbol(node.children[i], ":")) {
            result.highlights.push({begin: node.children[i].begin, end: node.children[i].end, type: 1});

            i++;
            for (; i < length; i++) {
                if (!(this.isSymbol(node.children[i], "to"))) {
                    expr.children.push(node.children[i]);
                }
                else {
                    break;
                }
            }
        }

        if (i < length && this.isSymbol(node.children[i], "to")) {
            result.highlights.push({begin: node.children[i].begin, end: node.children[i].end, type: 1});

            i++;
            for (; i < length; i++) {
                if (!(this.isSymbol(node.children[i], ":"))) {
                    to.children.push(node.children[i]);
                }
                else {
                    break;
                }
            }
        }
        if (i < length && this.isSymbol(node.children[i], ":")) {
            result.highlights.push({begin: node.children[i].begin, end: node.children[i].end, type: 1});

            i++;
            for (; i < length; i++) {
                if (!(this.isSymbol(node.children[i], "to"))) {
                    expr.children.push(node.children[i]);
                }
                else {
                    break;
                }
            }
        }

        let res1 = this.formula(from);
        let res2 = this.formula(to);
        let res3 = this.formula(expr);
        result.merge(res1);
        result.merge(res2);
        result.merge(res3);
        if(result.success) {
            node.type = this.sumType;
            node.children = [from, to, expr];
        }
        
        return result;
    }

    limit(node: Node): AnalyseResult {

        let result: AnalyseResult = new AnalyseResult(true);

        let length = node.children.length;
        if (length === 0) {
            result.success = false;
            result.messages.push(this.getMessage("Lim block should not be empty.", node.begin, MessageType.error));
            return result;
        }
        if (!this.isSymbol(node.children[0], "lim")) {
            result.success = false;
            result.messages.push(this.getMessage("Lim block should begin with sum.", node.children[0].begin, MessageType.error));
            return result;
        }

        result.highlights.push({begin: node.children[0].begin, end: node.children[0].end, type: 1});


        let lim = new Node(this.formulaType);
        let expr = new Node(this.formulaType);

        let i = 1;
        for (; i < length; i++) {
            if (!(this.isSymbol(node.children[i], ":"))) {
                lim.children.push(node.children[i]);
            }
            else {
                break;
            }
        }

        result.highlights.push({begin: node.children[i].begin, end: node.children[i].end, type: 1});

        if (i < length && this.isSymbol(node.children[i], ":")) {
            i++;
            for (; i < length; i++) {
                expr.children.push(node.children[i]);

            }
        }


        let res1 = this.formula(lim);
        let res2 = this.formula(expr);
        result.merge(res1);
        result.merge(res2);

        if(result.success) {
            node.type = this.limitType;
            node.children = [lim, expr];
        }
       
        return result;
    }

    integral(node: Node): AnalyseResult {

        let result: AnalyseResult = new AnalyseResult(true);

        let length = node.children.length;
        if (length === 0) {
            result.success = false;
            result.messages.push(this.getMessage("Int block should not be empty.", node.begin, MessageType.error));
            return result;
        }
        if (!this.isSymbol(node.children[0], "int")) {
            result.success = false;
            result.messages.push(this.getMessage("Lim block should begin with sum.", node.children[0].begin, MessageType.error));
            return result;
        }

        result.highlights.push({begin: node.children[0].begin, end: node.children[0].end, type: 1});


        let from = new Node(this.formulaType);
        let to = new Node(this.formulaType);
        let expr = new Node(this.formulaType);

        let i = 1;
        for (; i < length; i++) {
            if (!(this.isSymbol(node.children[i], "to") || this.isSymbol(node.children[i], ":"))) {
                from.children.push(node.children[i]);
            }
            else {
                break;
            }

        }


        if (i < length && this.isSymbol(node.children[i], "to")) {
            result.highlights.push({begin: node.children[i].begin, end: node.children[i].end, type: 1});

            i++;
            for (; i < length; i++) {
                if (!(this.isSymbol(node.children[i], ":"))) {
                    to.children.push(node.children[i]);
                }
                else {
                    break;
                }
            }
        }
        if (i < length && this.isSymbol(node.children[i], ":")) {
            result.highlights.push({begin: node.children[i].begin, end: node.children[i].end, type: 1});

            i++;
            for (; i < length; i++) {
                if (!(this.isSymbol(node.children[i], "to"))) {
                    expr.children.push(node.children[i]);
                }
                else {
                    break;
                }
            }
        }

        if (i < length && this.isSymbol(node.children[i], "to")) {
            result.highlights.push({begin: node.children[i].begin, end: node.children[i].end, type: 1});

            i++;
            for (; i < length; i++) {
                if (!(this.isSymbol(node.children[i], ":"))) {
                    to.children.push(node.children[i]);
                }
                else {
                    break;
                }
            }
        }
        if (i < length && this.isSymbol(node.children[i], ":")) {
            result.highlights.push({begin: node.children[i].begin, end: node.children[i].end, type: 1});
            i++;
            for (; i < length; i++) {
                if (!(this.isSymbol(node.children[i], "to"))) {
                    expr.children.push(node.children[i]);
                }
                else {
                    break;
                }
            }
        }

        let res1 = this.formula(from);
        let res2 = this.formula(to);
        let res3 = this.formula(expr);
        result.merge(res1);
        result.merge(res2);
        result.merge(res3);
        if(result.success) {
            node.type = this.integralType;
            node.children = [from, to, expr];
        }
        
        return result;
    }

    script(node: Node): AnalyseResult {

        let result: AnalyseResult = new AnalyseResult(true);

        let length = node.children.length;

        let sub = new Node(this.formulaType);
        let sup = new Node(this.formulaType);
        let expr = new Node(this.formulaType);

        let match = false;
        let i = 0;
        for (; i < length; i++) {
            if (!(this.isSymbol(node.children[i], "_") || this.isSymbol(node.children[i], "^"))) {
                expr.children.push(node.children[i]);
            }
            else {
                match = true;
                break;
            }
        }
        if (!match) {
            result.success = false;
            result.messages.push(this.getMessage("Script block should have _ or ^.", node.begin, MessageType.error));
            return result;
        }

        if (i < length && this.isSymbol(node.children[i], "^")) {
            result.highlights.push({begin: node.children[i].begin, end: node.children[i].end, type: 1});

            i++;
            for (; i < length; i++) {
                if (!(this.isSymbol(node.children[i], "_"))) {
                    sup.children.push(node.children[i]);
                }
                else {
                    break;
                }
            }
        }
        if (i < length && this.isSymbol(node.children[i], "_")) {
            result.highlights.push({begin: node.children[i].begin, end: node.children[i].end, type: 1});

            i++;
            for (; i < length; i++) {
                if (!(this.isSymbol(node.children[i], "^"))) {
                    sub.children.push(node.children[i]);
                }
                else {
                    break;
                }
            }
        }

        if (i < length && this.isSymbol(node.children[i], "&")) {
            result.highlights.push({begin: node.children[i].begin, end: node.children[i].end, type: 1});

            i++;
            for (; i < length; i++) {
                sup.children.push(node.children[i]);
            }
        }
        if (i < length && this.isSymbol(node.children[i], "_")) {
            result.highlights.push({begin: node.children[i].begin, end: node.children[i].end, type: 1});

            i++;
            for (; i < length; i++) {
                sub.children.push(node.children[i]);
            }
        }

        let res1 = this.formula(expr);
        let res2 = this.formula(sub);
        let res3 = this.formula(sup);
        result.merge(res1);
        result.merge(res2);
        result.merge(res3);

        if(result.success) {
            node.type = this.scriptType;
            node.children = [expr, sup, sub];
        }
        
        return result;
    }

    brackets(node: Node): AnalyseResult {

        let result: AnalyseResult = new AnalyseResult(true);

        let length = node.children.length;
        if (length < 2) {
            result.success = false;
            result.messages.push(this.getMessage("Brackets block length should be large than 2.", node.begin, MessageType.error));
            return result;
        }

        let left = node.children[0].content;
        let right = node.children[length - 1].content;
        result.highlights.push({begin: node.children[0].begin, end: node.children[0].end, type: 1});
        result.highlights.push({begin: node.children[length - 1].begin, end: node.children[length - 1].end, type: 1});

        let leftBrackets = new Set(["(", "{", "<", "|", "."]);
        let rightBrackets = new Set([")", "}", ">", "|", "."]);
        if (leftBrackets.has(left) && rightBrackets.has(right)) {
            node.type = this.bracketsType;
            let content = node.children.slice(1, -1);
            let newNode = new Node(this.formulaType, "", content);
            result.merge(this.formula(newNode));

            if(result.success) {
                node.children = [new Node(this.symbolType, left), newNode, new Node(this.symbolType, right)];
            }
            return result;
        }

        result.success = false;
        result.messages.push(this.getMessage("Undefined brackets.", node.children[0].begin, MessageType.error));
        result.messages.push(this.getMessage("Undefined brackets.", node.children[length - 1].begin, MessageType.error));
        return result;
    }
        */

    isSymbol(node: Node, name: string): boolean {
        return node.type === this.elementType && node.content === name;
    }

    getMessage(message: string, index: number, type: MessageType = MessageType.error, code: number = -1): Message {
        let lp = this.parser.getLineAndCharacter(index) ?? { line: -1, character: -1 };
        let pro = this.parser.process.slice();
        return new Message(message, type, code, lp.line, lp.character, pro);

    }
}
