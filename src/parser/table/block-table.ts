import { Node } from "../../common/syntax-tree/node";
import { NodeResult } from "../../common/result/parsing-result";
import { error } from "../../foundation/error";
import { parserExceptionTexts } from "../texts";

export type BlockHandler = (args: Node) => NodeResult;

export enum BlockType {
    basic,
    format,
    structural,
    subblock
}

export enum ArgumentType {
    string,
    number,
    enumeration
}

export class BlockOption {
    constructor(
        public readonly type: BlockType = BlockType.structural,
        public readonly argumentOptions: ReadonlyMap<string, { type: ArgumentType, options: string[], default: string }> = new Map(),
        public readonly allowReference: boolean = false
    ) {
    }
}

export interface ReadonlyBlockTable {

    has(name: string): boolean;

    readonly items: readonly string[];

    getOption(name: string): BlockOption | undefined;
}

export class BlockTable implements ReadonlyBlockTable {

    private handlers: Map<string, BlockHandler>;
    private options: Map<string, BlockOption>;

    constructor() {
        this.handlers = new Map();
        this.options = new Map();
    }

    has(name: string): boolean {
        return this.handlers.get(name) != undefined;
    }

    add(name: string, handler: BlockHandler, thisArg?: unknown, blockOption?: BlockOption) {
        if (this.has(name)) {
            error(parserExceptionTexts.BlockHandlerAlreadyExists.format(name));
        }
        this.handlers.set(name, handler.bind(thisArg));
        let options = blockOption ?? new BlockOption();
        this.options.set(name, options);
    }

    public get items(): readonly string[] {
        return Array.from(this.handlers.keys());
    }

    getHandler(name: string): BlockHandler | undefined {
        return this.handlers.get(name);
    }

    getOption(name: string): BlockOption | undefined {
        return this.options.get(name);
    }

    getType(name: string): BlockType | undefined {
        return this.getOption(name)?.type;
    }
}