import { Node } from "../syntax-tree/node";
import { NodeResult } from "./result";
import { error } from "../foundation/error";
import { parserExceptionTexts } from "./texts";

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
        public type: BlockType = BlockType.structural,
        public argumentOptions: Map<string, { type: ArgumentType, options: string[], default: string }> = new Map(),
        public allowReference: boolean = false
    ) {
    }
}

export class BlockTable {

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