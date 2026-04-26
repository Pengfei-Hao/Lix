import { Uri } from "./file-system/uri";

export interface ReadonlyConfig {

    readonly fileUri: Uri;
    readonly cacheDirectoryUri: Uri;
    readonly workingDirectoryUri: Uri;
    readonly outputUri: Uri;

    readonly settings: {
        readonly cacheDirectory: string;
    };
}

export interface Config {

    fileUri: Uri;
    cacheDirectoryUri: Uri;
    workingDirectoryUri: Uri;
    outputUri: Uri;

    settings: {
        cacheDirectory: string;
    };

    get(name: string): string;

    set(name: string, content: string): void;
}
