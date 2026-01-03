import { Path } from "./path";
import { Uri } from "./uri";

export type FileSystemRecord =
    { kind: 'stat', uri: Uri, result?: FileStat } |
    { kind: 'readDirectory', uri: Uri, result?: [string, FileType][] } |
    { kind: 'createDirectory', uri: Uri, result?: void } |
    { kind: 'readFile', uri: Uri, result?: Uint8Array } |
    { kind: 'readTextFile', uri: Uri, result?: string } |
    { kind: 'writeFile', uri: Uri, content: Uint8Array, result?: void } |
    { kind: 'writeTextFile', uri: Uri, content: string, result?: void } |
    { kind: 'delete', uri: Uri, recursive?: boolean, useTrash?: boolean, result?: void } |
    { kind: 'rename', source: Uri, target: Uri, overwrite?: boolean, result?: void } |
    { kind: 'copy', source: Uri, target: Uri, result?: void };

export enum FilePermission {
    Readonly = 1
}

export interface FileStat {
    type: FileType;
    ctime: number;
    mtime: number;
    size: number;
    permissions?: FilePermission;
}

export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64
}


export interface FileSystem {

    // Environment info

    readonly fileUri: Uri;
    readonly cacheDirectoryUri: Uri;
    readonly workingDirectoryUri: Uri;

    get path(): Path;

    pathToUri(path: string): Uri;

    stringToUri(value: string, strict?: boolean): Uri;

    Uri(components: {
        readonly scheme: string;
        readonly authority?: string;
        readonly path?: string;
        readonly query?: string;
        readonly fragment?: string;
    }): Uri;

    // Direct operations

    stat(uri: Uri): Promise<FileStat | undefined>;

    readDirectory(uri: Uri): Promise<[string, FileType][] | undefined>;

    createDirectory(uri: Uri): Promise<void | undefined>;

    readFile(uri: Uri): Promise<Uint8Array | undefined>;

    readTextFile(uri: Uri): Promise<string | undefined>;

    writeFile(uri: Uri, content: Uint8Array): Promise<void | undefined>;

    writeTextFile(uri: Uri, content: string): Promise<void | undefined>;

    delete(uri: Uri, recursive?: boolean, useTrash?: boolean): Promise<void | undefined>;

    rename(source: Uri, target: Uri, overwrite?: boolean): Promise<void | undefined>;

    copy(source: Uri, target: Uri): Promise<void | undefined>;

    // Operation by records

    executeRecords(records: FileSystemRecord[]): Promise<void>;

    statByRecord(uri: Uri): FileStat | undefined;

    readDirectoryByRecord(uri: Uri): [string, FileType][] | undefined;

    createDirectoryByRecord(uri: Uri): void | undefined;

    readFileByRecord(uri: Uri): Uint8Array | undefined;

    readTextFileByRecord(uri: Uri): string | undefined;

    writeFileByRecord(uri: Uri, content: Uint8Array): void | undefined;

    writeTextFileByRecord(uri: Uri, content: string): void | undefined;

    deleteByRecord(uri: Uri, recursive?: boolean, useTrash?: boolean): void | undefined;

    renameByRecord(source: Uri, target: Uri, overwrite?: boolean): void | undefined;

    copyByRecord(source: Uri, target: Uri): void | undefined;
}
