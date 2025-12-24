export abstract class Config {

    configs: Map<string, string>;

    settings: { language: string };

    constructor() {
        this.configs = new Map();
        this.settings = { language: "en-US" };
    }

    abstract get(name: string): string;

    abstract set(name: string, content: string): void;
}