import { Uri } from "./uri";

export interface ParsedPath {
    root: string;
    dir: string;
    base: string;
    ext: string;
    name: string;
}

export interface FormatInputPathObject {
    root?: string | undefined;
    dir?: string | undefined;
    base?: string | undefined;
    ext?: string | undefined;
    name?: string | undefined;
}

export interface Path {

    toUri(path: string, baseUri: Uri): Uri;

    uri(components: {
        readonly scheme: string;
        readonly authority?: string;
        readonly path?: string;
        readonly query?: string;
        readonly fragment?: string;
    }): Uri;

    normalize(path: string): string;

    join(...paths: string[]): string;

    resolve(...paths: string[]): string;

    isAbsolute(path: string): boolean;

    relative(from: string, to: string): string;

    dirname(path: string): string;

    basename(path: string, ext?: string): string;

    extname(path: string): string;

    readonly sep: "\\" | "/";

    readonly delimiter: ";" | ":";

    parse(path: string): ParsedPath;

    format(pathObject: FormatInputPathObject): string;
}
