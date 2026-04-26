
export interface ReadonlyHandlerTable<Handler, Option> {

    has(name: string): boolean;

    readonly items: readonly string[];

    getOptions(name: string): Option | undefined;
}

export abstract class HandlerTable<Handler, Option> implements ReadonlyHandlerTable<Handler, Option> {

    protected handlers: Map<string, Handler>;
    protected options: Map<string, Option>;
    protected names: Set<string>;
    protected longestNameLength: number;

    constructor() {
        this.handlers = new Map();
        this.options = new Map();
        this.names = new Set();
        this.longestNameLength = 0;
    }

    has(name: string): boolean {
        return this.names.has(name);
    }

    abstract add(name: string, handler: Handler, thisArg?: unknown, option?: Option): void;

    public get items(): readonly string[] {
        return Array.from(this.names);
    }

    getHandler(name: string): Handler | undefined {
        return this.handlers.get(name);
    }

    getOptions(name: string): Option | undefined {
        return this.options.get(name);
    }

    find(predicate: (candidates: Set<string>, longestLength: number) => string | undefined, thisArg?: unknown): string | undefined {
        return predicate.bind(thisArg)(this.names, this.longestNameLength);
    }

    findHandler(predicate: (candidates: Set<string>, longestLength: number) => string | undefined, thisArg?: unknown): Handler | undefined {
        let name = this.find(predicate, thisArg);
        return name !== undefined ? this.getHandler(name) : undefined;
    }
}