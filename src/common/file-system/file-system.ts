import { Uri } from "./uri";

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
}
