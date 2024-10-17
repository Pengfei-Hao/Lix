
export enum OperatorType {
    Infix,
    Prefix
}
export type PlaceHolder = undefined;

export class InfixOperator {
    
    priority: number;
    symbols: string;
    pattern: Set<string>;

    constructor(priority: number, symbols: string, pattern: Set<string>) {
        this.priority = priority;
        this.symbols = symbols;
        this.pattern = pattern;
    }
}

export class PrefixOperator {
    format: Array<string>;

    constructor(format: Array<string>) {
        this.format = format;
    }
}


export class OperatorTable {

    infixOperators: InfixOperator[];
    prefixOperators: PrefixOperator[];
    max: number;
    min: number;

    infixSymbols: Map<string, InfixOperator>;
    prefixSymbols: Map<string, PrefixOperator>;

    static BlankOperator: InfixOperator = new InfixOperator(0, "", new Set());
    // infix:
    // [placeholder] / [placeholder]
    // [placeholder] ^ [placeholder] _ [placeholder]

    // prefix:
    // sum [placeholder] to [placeholder] : [placeholder]
    // hat [placeholder]


    constructor() {
        this.infixOperators = [];
        this.infixOperators.push(OperatorTable.BlankOperator);
        this.prefixOperators = [];
        this.max = 0;
        this.min = 0;
        this.infixSymbols = new Map();
        this.prefixSymbols = new Map();
        this.infixSymbols.set("", OperatorTable.BlankOperator);

    }

    // Insert

    addInfixOperator(priority: number, format: string[]) {
        let op = new InfixOperator(priority, format[0], new Set(format.slice(1)));
        this.infixOperators.push(op);

        for(let sym of format[0]) {
            this.infixSymbols.set(sym, op);
        }
        if(priority > this.max) {
            this.max = priority;
        }
        if(priority < this.min) {
            this.min = priority;
        }
    }

    addPrefixOperator(format: Array<string>) {
        let op = new PrefixOperator(format);
        this.prefixOperators.push(op);
        this.prefixSymbols.set(format[0], op);
    }

    insertAtTop(format: string[]) {
        this.addInfixOperator(this.max + 1, format);
    }

    insertAtBottom(format: string[]) {
        this.addInfixOperator(this.min - 1, format);
    }

    // Find

    getInfixOperator(symbol: string) : InfixOperator | undefined {
        return this.infixSymbols.get(symbol);
    }

    getPrefixOperator(symbol: string) : PrefixOperator | undefined {
        return this.prefixSymbols.get(symbol);
    }

    // Compare

    lessThan(symbolL: string, symbolR: string): boolean {
        let priL = this.getInfixOperator(symbolL);
        let priR = this.getInfixOperator(symbolR);
        if(priL && priR) {
            return priL < priR;
        }
        else {
            console.log("Operator not exists.");
            return false;
        }
    }

    EqualTo(symbolL: string, symbolR: string): boolean {
        let priL = this.getInfixOperator(symbolL);
        let priR = this.getInfixOperator(symbolR);
        if(priL && priR) {
            return priL == priR;
        }
        else {
            console.log("Operator not exists.");
            return false;
        }
    }

    MoreThan(symbolL: string, symbolR: string): boolean {
        let priL = this.getInfixOperator(symbolL);
        let priR = this.getInfixOperator(symbolR);
        if(priL && priR) {
            return priL > priR;
        }
        else {
            console.log("Operator not exists.");
            return false;
        }
    }
}