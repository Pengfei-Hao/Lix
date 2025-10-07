
export enum OperatorType {
    Infix,
    Prefix
}

export class InfixOperator {
    constructor(
        public symbols: string,
        public patterns: Set<string>,
        public priority: number
    ) {
    }
}

export enum PrefixOperatorType {
    enumeration,
    term,
    expression,
    matrix
}

export class PrefixOperatorPattern {
    constructor(
        public type: PrefixOperatorType,
        public options: Set<string>
    ) {
    }
}

export class PrefixOperator {
    constructor(
        public patterns: PrefixOperatorPattern[]
    ) {
    }
}


export class OperatorTable {

    private infixOperators: InfixOperator[] = [];
    private infixSymbols: Map<string, InfixOperator> = new Map();

    private prefixOperators: PrefixOperator[] = [];
    private max: number = 0;
    private min: number = 0;
    private prefixSymbols: Map<string, PrefixOperator> = new Map();

    constructor() {
    }

    // Insert

    addInfixOperator(symbols: string, patterns: Set<string>, priority: number) {

        let op = new InfixOperator(symbols, patterns, priority);
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

    addPrefixOperator(patterns: PrefixOperatorPattern[]) {
        if (patterns.length === 0 || patterns[0].type !== PrefixOperatorType.enumeration || patterns[0].options.size === 0) {
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

    insertInfixOperatorAtTop(symbols: string, patterns: Set<string>) {
        this.addInfixOperator(symbols, patterns, this.max + 1);
    }

    insertInfixOperatorAtBottom(symbols: string, patterns: Set<string>) {
        this.addInfixOperator(symbols, patterns, this.min - 1);
    }

    // Find

    getInfixOperator(symbol: string): InfixOperator | undefined {
        return this.infixSymbols.get(symbol);
    }

    getPrefixOperator(symbol: string): PrefixOperator | undefined {
        return this.prefixSymbols.get(symbol);
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