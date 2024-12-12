export abstract class Config {

    configs: Map<string, string>;

    constructor() {
        this.configs = new Map();
    }

    abstract get(name: string): string;

    abstract set(name: string, content: string): void;
}