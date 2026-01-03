export interface Uri {

    readonly scheme: string;

    readonly authority: string;

    readonly path: string;

    readonly query: string;

    readonly fragment: string;

    readonly fsPath: string;

    with(change: {
        scheme?: string;
        authority?: string;
        path?: string;
        query?: string;
        fragment?: string;
    }): Uri;

    joinPath(...paths: string[]): Uri;

    resolvePath(...paths: string[]): Uri;

    readonly dirname: Uri;

    readonly basename: string;

    readonly extname: string;

    readonly stem: string;

    equals(other: Uri): boolean;

    toString(skipEncoding?: boolean): string;

    toJSON(): any;
}