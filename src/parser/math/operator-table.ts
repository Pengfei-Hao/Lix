
export enum OperatorType {
    Infix,
    Prefix
}

export class InfixOperator {
    
    symbols: string;
    patterns: Set<string>;
    priority: number;

    constructor(symbols: string, patterns: Set<string>, priority: number) {
        this.priority = priority;
        this.symbols = symbols;
        this.patterns = patterns;
    }
}

export enum PrefixOperatorType {
    enumeration,
    term,
    expression,
    matrix
}

export class PrefixOperatorPattern {
    type: PrefixOperatorType;
    options: Set<string>;

    constructor(type: PrefixOperatorType, options: Set<string>) {
        this.type = type;
        this.options = options;
    }
}

export class PrefixOperator {
    patterns: PrefixOperatorPattern[];

    constructor(patterns: PrefixOperatorPattern[]) {
        this.patterns = patterns;
    }
}


export class OperatorTable {

    private infixOperators: InfixOperator[];
    private infixSymbols: Map<string, InfixOperator>;

    private prefixOperators: PrefixOperator[];
    private max: number;
    private min: number;
    private prefixSymbols: Map<string, PrefixOperator>;

    //static BlankOperator: InfixOperator = new InfixOperator(0, "", new Set());
    // infix:
    // [placeholder] / [placeholder]
    // [placeholder] ^ [placeholder] _ [placeholder]

    // prefix:
    // sum [placeholder] to [placeholder] : [placeholder]
    // hat [placeholder]


    constructor() {
        this.infixOperators = [];
        //this.infixOperators.push(OperatorTable.BlankOperator);
        this.prefixOperators = [];
        this.max = 0;
        this.min = 0;
        this.infixSymbols = new Map();
        this.prefixSymbols = new Map();
        //this.infixSymbols.set("", OperatorTable.BlankOperator);

    }

    // Insert

    addInfixOperator(symbols: string, patterns: Set<string>, priority: number) {

        let op = new InfixOperator(symbols, patterns, priority);
        this.infixOperators.push(op);

        for(let sym of symbols) {
            if(this.infixSymbols.get(sym) !== undefined) {
                console.log("Infix operator repeated.");
            }
            this.infixSymbols.set(sym, op);
        }
        if(priority > this.max) {
            this.max = priority;
        }
        if(priority < this.min) {
            this.min = priority;
        }
    }

    addPrefixOperator(patterns: PrefixOperatorPattern[]) {
        if(patterns.length === 0 || patterns[0].type !== PrefixOperatorType.enumeration || patterns[0].options.size === 0) {
            console.log("Prefix operator pattern is wrong.");
            return;
        }
        let op = new PrefixOperator(patterns);
        this.prefixOperators.push(op);
        for(let sym of patterns[0].options) {
            if(this.prefixSymbols.get(sym) !== undefined) {
                console.log("Prefix operator repeated.");
            }
            this.prefixSymbols.set(sym, op);
        } 
    }

    insertInfixOperatorAtTop(symbols: string, patterns: Set<string>) {
        this.addInfixOperator(symbols, patterns, this.max + 1);
    }

    insertInfixOperatorAtBottom(symbols: string, patterns: Set<string>) {
        this.addInfixOperator(symbols, patterns, this.min - 1);
    }

    // Find

    getInfixOperator(symbol: string) : InfixOperator | undefined {
        return this.infixSymbols.get(symbol);
    }

    getPrefixOperator(symbol: string) : PrefixOperator | undefined {
        return this.prefixSymbols.get(symbol);
    }

    // Compare

    lessThanOrEqualTo(symbolL: string, symbolR: string): boolean {
        let priL = this.getInfixOperator(symbolL);
        let priR = this.getInfixOperator(symbolR);
        if(priL && priR) {
            return priL.priority <= priR.priority;
        }
        else {
            console.log("Operator not exists.");
            return false;
        }
    }

    equalTo(symbolL: string, symbolR: string): boolean {
        let priL = this.getInfixOperator(symbolL);
        let priR = this.getInfixOperator(symbolR);
        if(priL && priR) {
            return priL.priority == priR.priority;
        }
        else {
            console.log("Operator not exists.");
            return false;
        }
    }

    greaterThan(symbolL: string, symbolR: string): boolean {
        let priL = this.getInfixOperator(symbolL);
        let priR = this.getInfixOperator(symbolR);
        if(priL && priR) {
            return priL.priority > priR.priority;
        }
        else {
            console.log("Operator not exists.");
            return false;
        }
    }
}