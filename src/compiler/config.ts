
export interface Config {

    settings: {
        locale: string;
        cacheDirectory: string;
    };

    get(name: string): string;

    set(name: string, content: string): void;
}
