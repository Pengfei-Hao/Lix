
import exp = require("constants");
import { Node } from "../../sytnax-tree/node";
import { Type } from "../../sytnax-tree/type";
import { Module } from "../module";
import { MatchResult, Parser } from "../parser";
import { SymbolTable } from "./symbol-table";
import { AnalyseResult, HighlightType, Result, ResultState } from "../../foundation/result";
import { MessageType } from "../../foundation/message";
import { Message } from "../../foundation/message";

//type MsgResult = Result<undefined>;

export class Math extends Module {

    blockHandlerTable: SymbolTable;

    // types of syntax tree node
    formulaType: Type;
    symbolType: Type;
    definationType: Type;
    fractionType: Type;
    matrixType: Type;
    sqrtType: Type;
    sumType: Type;
    limitType: Type;
    integralType: Type;
    scriptType: Type;
    bracketsType: Type;

    symbolCharAndNotations: Map<string, string>;
    symbolChars: Set<string>;
    symbols: string[];

    constructor(parser: Parser) {
        super(parser);

        // Init label handle function
        this.parser.blockHandlerTable.add("formula", this.formulaBlockHandler, this);

        // Init syntax tree node type
        this.formulaType = this.parser.typeTable.add("formula")!;
        this.symbolType = this.parser.typeTable.add("symbol")!;
        this.definationType = this.parser.typeTable.add("defination")!;

        // Init math block handle function and init syntax tree node
        this.blockHandlerTable = new SymbolTable(parser);
        this.fractionType = this.blockHandlerTable.addBlock("fraction", this.frac, this)!;
        this.sqrtType = this.blockHandlerTable.addBlock("sqrt", this.sqrt, this)!;
        this.sumType = this.blockHandlerTable.addBlock("sum", this.sum, this)!;
        this.limitType = this.blockHandlerTable.addBlock("limit", this.limit, this)!;
        this.integralType = this.blockHandlerTable.addBlock("integral", this.integral, this)!;
        this.scriptType = this.blockHandlerTable.addBlock("script", this.script, this)!;
        this.bracketsType = this.blockHandlerTable.addBlock("brackets", this.brackets, this)!;
        this.matrixType = this.blockHandlerTable.addBlock("matrix", this.matrix, this)!;


        this.symbols = [];
        this.symbolCharAndNotations = new Map();
        this.symbolChars = new Set();

        // Init math symbols from math.json
        let json = parser.configs.get("math");
        let config: { symbols: string[], SymbolCharAndNotations: string [][], SymbolChars: string } = JSON.parse(json);

        // 字母组合
        for (let symbol of config.symbols) {
            this.blockHandlerTable.addSymbol(symbol);
            this.symbols.push(symbol);
        }

        // 键盘上能打出来的符号
        for (let sym of config.SymbolChars) {
            this.symbolChars.add(sym);
            this.blockHandlerTable.addSymbol(sym);
        }

        // vscode 中要关闭 DisableHighlightingOfAmbiguousCharacters 这个选项
        // Unicode 特殊字符
        for( let tmp of config.SymbolCharAndNotations) {
            this.symbolChars.add(tmp[0]);
            this.blockHandlerTable.addSymbol(tmp[0]);
            this.blockHandlerTable.addSymbol(tmp[1]);
            this.symbolCharAndNotations.set(tmp[1], tmp[0]);
        }
    }

    init() {
        this.blockHandlerTable.definations = new Map();
    }

    formulaBlockHandler(): MatchResult {
        let result = new Result<Node>(new Node(this.formulaType));
        let preIndex = this.parser.index;
        this.parser.begin("formula");
        this.myMatchFormula(result);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        if(result.failed) {
            this.parser.index = preIndex;
        }
        if(result.shouldTerminate) {
            return result;
        }

        this.parser.begin("analysis");
        let analysisResult = this.analyse(result.content);
        this.parser.end();
        if(!analysisResult.success) {
            //result.messages.push(this.parser.getMessage("Analyse failed."));
            result.mergeState(ResultState.skippable);
        }
        else {
            result.mergeState(ResultState.successful);
        }

        for(let msg of analysisResult.messages) {
            result.messages.push(msg);
        }
        for(let hlt of analysisResult.highlights) {
            result.highlights.push(hlt);
        }
        return result;
    }

    matchEmbededFormula(): MatchResult {
        let result = new Result<Node>(new Node(this.formulaType));
        let preIndex = this.parser.index;
        this.parser.begin("embeded-formula");

        result.merge(this.parser.match("/"));
        if(result.shouldTerminate) {
            this.parser.end();
            return result;
        }
        this.myMatchFormula(result, true);

        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;

        if(result.failed) {
            this.parser.index = preIndex;
        }
        if(result.shouldTerminate) {
            return result;
        }
        //result.highlights.push({begin: preIndex, end: this.parser.index, type: 0});
        //return result;

        this.parser.begin("analysis");
        let analysisResult = this.analyse(result.content);
        this.parser.end();
        if(!analysisResult.success) {
            //result.messages.push(this.parser.getMessage("Analyse failed."));
            result.mergeState(ResultState.skippable);
        }
        else {
            result.mergeState(ResultState.successful);
        }

        for(let msg of analysisResult.messages) {
            result.messages.push(msg);
        }
        for(let hlt of analysisResult.highlights) {
            result.highlights.push(hlt);
        }
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


    private myMatchFormula(result: MatchResult, embeded = false) {

        let node = result.content;
        let msg = result.messages;

        let blnRes: Result<number>;
        let ndRes: Result<Node>;

        while (true) {

            if(this.parser.isEOF()) {
                result.messages.push(this.parser.getMessage("formula ended abruptly.", MessageType.warning));
                result.mergeState(ResultState.skippable);
                break;
            }

            else if (!embeded && this.parser.is("]")) {
                this.parser.move();
                result.mergeState(ResultState.successful);
                return;
            }
            
            else if ((blnRes = this.parser.matchMultilineBlank()).matched) {
                if(blnRes.content >= 2) {
                    result.messages.push(this.parser.getMessage("Formula should not have two or more newline.", MessageType.warning));
                    result.mergeState(ResultState.skippable);
                }
            }

            else if(embeded && this.parser.is("/")) {
                this.parser.move();
                result.mergeState(ResultState.successful);
                return;
            }

            else if (this.parser.is("`")) {
                if(embeded) {
                    msg.push(this.parser.getMessage("Embeded formula should not have symbol defination.", MessageType.warning));
                    result.mergeState(ResultState.skippable);
                }

                this.parser.move();
                ndRes = this.matchSymbols("`");
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    //result.messages.push(this.parser.getMessage("Match symbols failed."));
                    return;
                }
                ndRes.content.type = this.definationType;
                node.children.push(ndRes.content);
            }

            else if (this.parser.is("[")) {
                this.parser.move();
                ndRes = this.matchSymbols();
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    //result.messages.push(this.parser.getMessage("Match symbols failed."));
                    //result.state = ResultState.matched;
                    return;
                }
    
                node.children.push(ndRes.content);
            }

            else if ((ndRes = this.matchSymbol()).matched) {
                result.merge(ndRes);
                if(result.shouldTerminate) {
                    //result.messages.push(this.parser.getMessage("Match symbol failed."));
                    return;
                }
                node.children.push(ndRes.content);
            }

            else {
                result.messages.push(this.parser.getMessage("Unexpected character."));
                result.mergeState(ResultState.skippable);

                if(embeded) {
                    this.skipByBracketsEndWith("/");
                }
                else {
                    this.skipByBracketsEndWith("]");
                }
                break;
            }
        }
    }

    matchSymbols(endWith: string = "]"): Result<Node> {
        let result = new Result<Node>(new Node(this.formulaType));
        let preIndex = this.parser.index;
        this.parser.begin("symbols");
        this.myMatchSymbols(result, endWith);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        return result;
    }

    private myMatchSymbols(result: Result<Node>, endWith: string = "]") {
        
        let node = result.content;
        let msg = result.messages;

        let blnRes: Result<number>;
        let ndRes: Result<Node>;

        while (true) {

            if(this.parser.isEOF()) {
                result.messages.push(this.parser.getMessage("formula ended without ].", MessageType.warning));
                result.mergeState(ResultState.skippable);
                break;
            }
            
            else if ((blnRes = this.parser.matchMultilineBlank()).matched) {
                if(blnRes.content >= 2) {
                    result.messages.push(this.parser.getMessage("Formula should not have two or more newline.", MessageType.warning));
                    result.mergeState(ResultState.skippable);
                }
            }

            else if (this.parser.is(endWith)) {
                this.parser.move();
                result.mergeState(ResultState.successful);
                break;
            }

            else if (this.parser.is("[")) {
                this.parser.move();
                ndRes = this.matchSymbols();
                result.merge(ndRes);
                if (result.shouldTerminate) {
                    //result.messages.push(this.parser.getMessage("Match symbols failed."));
                    //result.state = ResultState.matched;
                    return;
                }
    
                node.children.push(ndRes.content);
            }

            else if ((ndRes = this.matchSymbol()).matched) {
                result.merge(ndRes);
                if(result.shouldTerminate) {
                    //result.messages.push(this.parser.getMessage("Match symbol failed."));
                    return;
                }
                node.children.push(ndRes.content);
            }

            else {
                result.messages.push(this.parser.getMessage("Unexpected character."));
                result.mergeState(ResultState.skippable);

                this.skipByBracketsEndWith(endWith);
                break;
            }
        }
    }

    matchSymbol(): Result<Node> {
        let result = new Result<Node>(new Node(this.symbolType));
        let preIndex = this.parser.index;
        this.parser.begin("symbol");
        this.myMatchSymbol(result);
        this.parser.end();
        result.content.begin = preIndex;
        result.content.end = this.parser.index;
        return result;
    }

    private myMatchSymbol(result: Result<Node>) {

        let node = result.content;
        let msg = result.messages;

        if (this.parser.isEOF()) {
            //result.messages.push(this.parser.getMessage("Unexpected end."));
            return;
        }

        else if (this.parser.is(Math.nameChar)) {
            let text = "";
            
            while(true) {
                if(this.parser.isEOF()) {
                    node.content = text;
                    break;
                }
                else if(this.parser.is(Math.nameChar)) {
                    result.mergeState(ResultState.successful);
                    text += this.parser.curChar();
                    this.parser.move();
                }
                else {
                    node.content = text;
                    break;
                }
            }
        }

        // 数学的特殊符号属于 0x10000 平面, ts 使用 utf16 编码, 因而占两个字符的位置, 要使用 curUnicodeChar
        else if (this.symbolChars.has(this.parser.curUnicodeChar())) {
            node.content = this.parser.curUnicodeChar();
            result.mergeState(ResultState.successful);
            this.parser.moveUnicode();
        }

        else if (this.parser.is("\"")) {
            this.parser.move();
            result.mergeState(ResultState.successful);

            let text = "";

            while(true) {
                if(this.parser.isEOF()) {
                    msg.push(this.parser.getMessage("Formula ended abruptly."));
                    result.mergeState(ResultState.skippable);
                    break;
                }
                else if (this.parser.is("\"")) {
                    node.content = text;
                    result.mergeState(ResultState.successful);
                    break;
                }
                else {
                    text += this.parser.curChar();
                    this.parser.move();
                    result.mergeState(ResultState.successful);
                }
            }
            
        }
        else {
            //result.messages.push(this.parser.getMessage("Unexpected character."));
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

    analyse(node: Node): AnalyseResult {

        let result: AnalyseResult = new AnalyseResult(true);

        // filter the defination, i.e. the symbols surrounded by the ' '.
        for (let subnode of node.children) {
            if (subnode.type === this.definationType) {
                if (subnode.children.length < 2) {
                    return result;
                }
                if (subnode.children[0].type != this.symbolType) {
                    return result;
                }
                if (subnode.children[1].type != this.symbolType || subnode.children[1].content != "↦") {
                    return result;
                }

                result.highlights.push({begin: subnode.begin, end: subnode.begin + 1, type: 3});
                result.highlights.push({begin: subnode.begin, end: subnode.begin + 1, type: 3});

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

        // analyse symbols

        result.merge(this.formula(node));
        return result;
    }

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

    formula(node: Node): AnalyseResult {

        let result: AnalyseResult = new AnalyseResult(true);

        for (let i = 0; i < node.children.length; i++) {
            let subnode = node.children[i];

            if (subnode.type === this.symbolType) {
                result.highlights.push({begin: subnode.begin, end: subnode.end, type: 0});

                let resultOfMath = this.blockHandlerTable.symbols.get(subnode.content);
                if (resultOfMath != undefined) {
                    //subnode.content += `__${resultOfMath}__`;
                }
                else {
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
                        result.success = false;
                        return result;
                    }
                }
            }
            else if (subnode.type === this.formulaType) {
                let nResult = this.find(subnode);
                result.merge(nResult);

                if (!nResult.success) {
                    return result;
                }
                
            }
            else {
                result.messages.push(this.getMessage("[[Logic error]]", subnode.begin, MessageType.warning));
                //result.success = false;
                return result;
            }
        }
        result.success = true;
        return result;
    }

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

    isSymbol(node: Node, name: string): boolean {
        return node.type === this.symbolType && node.content === name;
    }

    getMessage(message: string, index:number, type: MessageType = MessageType.error, code: number = -1): Message {
        let lp = this.parser.getLineAndPosition(index) ?? {line: -1, position: -1};
        let pro = this.parser.process.slice();
        return new Message(message, type, code, lp.line, lp.position, pro);
    }
}
