import { Node } from "../sytnax-tree/node";
import { NodeResult } from "./result";
import { LixError } from "../foundation/error";
import { exceptionText } from "../foundation/i18n";

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

    public handlers: Map<string, BlockHandler> = new Map();
    public blockOptions: Map<string, BlockOption> = new Map();

    constructor() {
    }

    has(name: string): boolean {
        return this.handlers.get(name) != undefined;
    }

    add(name: string, handler: BlockHandler, thisArg?: unknown, blockOption?: BlockOption) {
        if (this.has(name)) {
            throw new LixError(exceptionText.BlockHandlerAlreadyExists.format(name));
        }
        this.handlers.set(name, handler.bind(thisArg));
        let options = blockOption ?? new BlockOption();
        this.blockOptions.set(name, options);
    }

    getHandler(name: string): BlockHandler | undefined {
        return this.handlers.get(name);
    }

    getOption(name: string): BlockOption | undefined {
        return this.blockOptions.get(name);
    }

    getType(name: string): BlockType | undefined {
        return this.getOption(name)?.type;
    }

}