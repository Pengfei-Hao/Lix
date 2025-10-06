import { Node } from "../sytnax-tree/node";
import { NodeResult } from "./result";
import { LixError } from "../foundation/error";

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
        public subblockType: BlockType = BlockType.subblock,
        public subblocks: string[] = [],
        public argumentOptions: Map<string, { type: ArgumentType, options: string[], default: string }> = new Map(),
        public allowReference: boolean = false
    ) {
    }
}

export class BlockTable {

    constructor(
        public handlers: Map<string, BlockHandler> = new Map(),
        public blockOptions: Map<string, BlockOption> = new Map(),

        public basicBlocks: Set<string> = new Set(),
        public formatBlocks: Set<string> = new Set(),
        public structuralBlocks: Set<string> = new Set(),
        public subBlocks: Set<string> = new Set()
    ) {
    }

    has(name: string): boolean {
        return this.handlers.get(name) != undefined;
    }

    add(name: string, handler: BlockHandler, thisArg?: unknown, blockOption?: BlockOption) {
        if (this.has(name)) {
            throw new LixError(`Block handler '${name}' repeated.`);
        }
        this.handlers.set(name, handler.bind(thisArg));
        let options = blockOption ?? new BlockOption();
        this.blockOptions.set(name, options);
        switch(options.type) {
            case BlockType.basic:
                this.basicBlocks.add(name);
                break;
            case BlockType.format:
                this.formatBlocks.add(name);
                break;
            case BlockType.structural:
                this.structuralBlocks.add(name);
                break;
            case BlockType.subblock:
                this.subBlocks.add(name);
                break;
        }
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