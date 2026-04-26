import { error } from "../../../foundation/error";
import { parserExceptionTexts } from "../../texts";

export enum OperatorType {
    Infix,
    Prefix,
    Postfix
}

export class InfixOperator {
    constructor(
        public readonly symbols: Set<string>,
        public readonly patterns: Set<string>,
        public readonly priority: number
    ) {
    }
}

export enum OperatorPatternType {
    enumeration,
    term,
    expression,
    matrix
}

export class OperatorPattern {
    constructor(
        public readonly type: OperatorPatternType,
        public readonly options: Set<string>
    ) {
    }
}

export class PrefixOperator {
    constructor(
        public readonly pattern: OperatorPattern[]
    ) {
    }
}

export class PostfixOperator {
    constructor(
        public readonly pattern: OperatorPattern[]
    ) {
    }
}

export interface ReadonlyMathTable {
    get notationToSymbols(): ReadonlyMap<string, string>;
    get notations(): ReadonlySet<string>;
    get symbols(): ReadonlySet<string>;
    getInfixOperator(symbol: string): InfixOperator | undefined;
    getPrefixOperator(symbol: string): PrefixOperator | undefined;
    getPostfixOperator(symbol: string): PostfixOperator | undefined;
    leq(symbolL: string, symbolR: string): boolean;
    eq(symbolL: string, symbolR: string): boolean;
    gt(symbolL: string, symbolR: string): boolean;
}

export class MathTable implements ReadonlyMathTable {

    // 参与表达式解析的符号, 包括 PrefixOperator 字段和 InfixOperator 字段

    private infixOperators: InfixOperator[];
    private max: number;
    private min: number;
    private infixSymbols: Map<string, InfixOperator>;

    private prefixOperators: PrefixOperator[];
    private prefixSymbols: Map<string, PrefixOperator>;

    private postfixOperators: PostfixOperator[];
    private postfixSymbols: Map<string, PostfixOperator>;

    // Symbol 唯一, Notation 不唯一, 一个 Symbol 可以对应多个 Notation

    private rawNotationsToSymbols: Map<string, string>; // Unicode 符号和记号, UnicodeSymbolsAndNotations 字段
    private rawSymbols: Set<string>; // 符号, 包括 Symbols 字段 (ASCII 符号) 和 UnicodeSymbolsAndNotations 字段的 Unicode 符号部分
    private longestSymbolLength: number;
    private rawNotations: Set<string>; // 字母记号, 包括 Notations 字段和 UnicodeSymbolsAndNotations 字段的字母记号部分

    constructor() {
        this.infixOperators = [];
        this.max = 0;
        this.min = 0;
        this.infixSymbols = new Map();

        this.prefixOperators = [];
        this.prefixSymbols = new Map();

        this.postfixOperators = [];
        this.postfixSymbols = new Map();

        this.rawSymbols = new Set();
        this.longestSymbolLength = 0;
        this.rawNotations = new Set();
        this.rawNotationsToSymbols = new Map();
    }

    // Init

    init(mathConfig: {
        SymbolsAndNotations: string[][],
        Notations: string[],
        Symbols: string[],
        PrefixOperator: { pattern: { type: string, options: string[] }[] }[],
        InfixOperator: { symbols: string[], pattern: string[] }[],
        PostfixOperator: { pattern: { type: string, options: string[] }[] }[],
    }) {
        // 字母记号
        for (let notation of mathConfig.Notations) {
            this.rawNotations.add(notation);
        }

        // ASCII 符号
        for (let sym of mathConfig.Symbols) {
            this.rawSymbols.add(sym);
            this.longestSymbolLength = (sym.length > this.longestSymbolLength) ? sym.length : this.longestSymbolLength;
        }

        // Unicode 符号
        for (let tmp of mathConfig.SymbolsAndNotations) {
            this.rawSymbols.add(tmp[0]);
            this.longestSymbolLength = (tmp[0].length > this.longestSymbolLength) ? tmp[0].length : this.longestSymbolLength;
            for (let i = 1; i < tmp.length; i++) {
                this.rawNotations.add(tmp[i]);
                this.rawNotationsToSymbols.set(tmp[i], tmp[0]);
            }
        }

        // Prefix operator
        for (let prefix of mathConfig.PrefixOperator) {
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
            this.addPrefixOperator(patterns);
        }

        // Postfix operator
        for (let postfix of mathConfig.PostfixOperator) {
            let patterns: OperatorPattern[] = [];
            for (let pattern of postfix.pattern) {
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
            this.addPostfixOperator(patterns);
        }

        // Infix operator
        let medium = 0;
        for (medium = 0; medium < mathConfig.InfixOperator.length; medium++) {
            if (mathConfig.InfixOperator[medium].symbols.length === 1 && mathConfig.InfixOperator[medium].symbols[0] === "" && mathConfig.InfixOperator[medium].pattern.length === 0) {
                this.addInfixOperator([""], new Set(), 0);
                break;
            }
        }
        for (let i = medium - 1; i >= 0; i--) {
            this.insertInfixOperatorAtTop(mathConfig.InfixOperator[i].symbols, new Set(mathConfig.InfixOperator[i].pattern));
        }
        for (let i = medium + 1; i < mathConfig.InfixOperator.length; i++) {
            this.insertInfixOperatorAtBottom(mathConfig.InfixOperator[i].symbols, new Set(mathConfig.InfixOperator[i].pattern));
        }
    }

    // Insert

    private addInfixOperator(symbols: string[], patterns: Set<string>, priority: number) {

        let op = new InfixOperator(new Set(symbols), patterns, priority);
        this.infixOperators.push(op);

        for (let sym of symbols) {
            if (this.infixSymbols.get(sym) !== undefined) {
                console.log("Infix operator repeated.");
            }
            this.infixSymbols.set(sym, op);
        }
        if (priority > this.max) {
            this.max = priority;
        }
        if (priority < this.min) {
            this.min = priority;
        }
    }

    private addPrefixOperator(patterns: OperatorPattern[]) {
        if (patterns.length === 0 || patterns[0].type !== OperatorPatternType.enumeration || patterns[0].options.size === 0) {
            console.log("Prefix operator pattern is wrong.");
            return;
        }
        let op = new PrefixOperator(patterns);
        this.prefixOperators.push(op);
        for (let sym of patterns[0].options) {
            if (this.prefixSymbols.get(sym) !== undefined) {
                console.log("Prefix operator repeated.");
            }
            this.prefixSymbols.set(sym, op);
        }
    }

    private addPostfixOperator(patterns: OperatorPattern[]) {
        if (patterns.length === 0 || patterns[0].type !== OperatorPatternType.enumeration || patterns[0].options.size === 0) {
            console.log("Postfix operator pattern is wrong.");
            return;
        }
        let op = new PostfixOperator(patterns);
        this.postfixOperators.push(op);
        for (let sym of patterns[0].options) {
            if (this.postfixSymbols.get(sym) !== undefined) {
                console.log("Postfix operator repeated.");
            }
            this.postfixSymbols.set(sym, op);
        }
    }

    private insertInfixOperatorAtTop(symbols: string[], patterns: Set<string>) {
        this.addInfixOperator(symbols, patterns, this.max + 1);
    }

    private insertInfixOperatorAtBottom(symbols: string[], patterns: Set<string>) {
        this.addInfixOperator(symbols, patterns, this.min - 1);
    }

    // Find

    public get notationToSymbols(): ReadonlyMap<string, string> {
        return this.rawNotationsToSymbols;
    }

    public get notations(): ReadonlySet<string> {
        return this.rawNotations;
    }

    public get symbols(): ReadonlySet<string> {
        return this.rawSymbols;
    }

    findSymbol(predicate: (candidates: Set<string>, longestLength: number) => string | undefined, thisArg?: unknown): string | undefined {
        return predicate.bind(thisArg)(this.rawSymbols, this.longestSymbolLength);
    }

    getInfixOperator(symbol: string): InfixOperator | undefined {
        return this.infixSymbols.get(symbol);
    }

    getPrefixOperator(symbol: string): PrefixOperator | undefined {
        return this.prefixSymbols.get(symbol);
    }

    getPostfixOperator(symbol: string): PostfixOperator | undefined {
        return this.postfixSymbols.get(symbol);
    }

    // Compare

    leq(symbolL: string, symbolR: string): boolean {
        let priL = this.getInfixOperator(symbolL);
        let priR = this.getInfixOperator(symbolR);
        if (priL && priR) {
            return priL.priority <= priR.priority;
        }
        else {
            console.log("Operator not exists.");
            return false;
        }
    }

    eq(symbolL: string, symbolR: string): boolean {
        let priL = this.getInfixOperator(symbolL);
        let priR = this.getInfixOperator(symbolR);
        if (priL && priR) {
            return priL.priority == priR.priority;
        }
        else {
            console.log("Operator not exists.");
            return false;
        }
    }

    gt(symbolL: string, symbolR: string): boolean {
        let priL = this.getInfixOperator(symbolL);
        let priR = this.getInfixOperator(symbolR);
        if (priL && priR) {
            return priL.priority > priR.priority;
        }
        else {
            console.log("Operator not exists.");
            return false;
        }
    }
}