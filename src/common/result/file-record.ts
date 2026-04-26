import { AddOnlyList } from "../../foundation/add-only-list";
import { FileStat, FileSystem, FileType } from "../file-system/file-system";
import { Uri } from "../file-system/uri";


export type FileRecord =
    { kind: 'stat'; uri: Uri; } |
    { kind: 'readDirectory'; uri: Uri; } |
    { kind: 'createDirectory'; uri: Uri; } |
    { kind: 'readFile'; uri: Uri; } |
    { kind: 'readTextFile'; uri: Uri; } |
    { kind: 'writeFile'; uri: Uri; content: Uint8Array; } |
    { kind: 'writeTextFile'; uri: Uri; content: string; } |
    { kind: 'delete'; uri: Uri; recursive?: boolean; useTrash?: boolean; } |
    { kind: 'rename'; source: Uri; target: Uri; overwrite?: boolean; } |
    { kind: 'copy'; source: Uri; target: Uri; };

class FileRecordWithResult {
    constructor(
        public readonly record: FileRecord,
        public result: any
    ) {
    }
}

export interface ReadonlyFileRecordList {

    execute(fileSystem: FileSystem): Promise<void>;

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

export class FileRecordList implements AddOnlyList<FileRecord>, ReadonlyFileRecordList {

    private rawFileRecords: FileRecordWithResult[];

    constructor() {
        this.rawFileRecords = [];
    }

    public get items(): readonly FileRecord[] {
        return this.rawFileRecords.map((item) => item.record);
    }

    push(...records: FileRecord[]) {
        this.rawFileRecords.push(...records.map((record) => new FileRecordWithResult(record, undefined)));
    }

    recordStat(uri: Uri) {
        this.rawFileRecords.push(new FileRecordWithResult({ kind: 'stat', uri: uri }, undefined));
    }

    recordReadDirectory(uri: Uri) {
        this.rawFileRecords.push(new FileRecordWithResult({ kind: 'readDirectory', uri: uri }, undefined));
    }

    recordCreateDirectory(uri: Uri) {
        this.rawFileRecords.push(new FileRecordWithResult({ kind: 'createDirectory', uri: uri }, undefined));
    }

    recordReadFile(uri: Uri) {
        this.rawFileRecords.push(new FileRecordWithResult({ kind: 'readFile', uri: uri }, undefined));
    }

    recordReadTextFile(uri: Uri) {
        this.rawFileRecords.push(new FileRecordWithResult({ kind: 'readTextFile', uri: uri }, undefined));
    }

    recordWriteFile(uri: Uri, content: Uint8Array) {
        this.rawFileRecords.push(new FileRecordWithResult({ kind: 'writeFile', uri: uri, content: content }, undefined));
    }

    recordWriteTextFile(uri: Uri, content: string) {
        this.rawFileRecords.push(new FileRecordWithResult({ kind: 'writeTextFile', uri: uri, content: content }, undefined));
    }

    recordDelete(uri: Uri, recursive?: boolean, useTrash?: boolean) {
        this.rawFileRecords.push(new FileRecordWithResult({ kind: 'delete', uri: uri, recursive: recursive, useTrash: useTrash }, undefined));
    }

    recordRename(source: Uri, target: Uri, overwrite?: boolean) {
        this.rawFileRecords.push(new FileRecordWithResult({ kind: 'rename', source: source, target: target, overwrite: overwrite }, undefined));
    }

    recordCopy(source: Uri, target: Uri) {
        this.rawFileRecords.push(new FileRecordWithResult({ kind: 'copy', source: source, target: target }, undefined));
    }

    // Operation by records
    async execute(fileSystem: FileSystem): Promise<void> {
        for (let item of this.rawFileRecords) {
            switch (item.record.kind) {
                case "stat":
                    item.result = await fileSystem.stat(item.record.uri);
                    break;
                case "readDirectory":
                    item.result = await fileSystem.readDirectory(item.record.uri);
                    break;
                case "createDirectory":
                    item.result = await fileSystem.createDirectory(item.record.uri);
                    break;
                case "readFile":
                    item.result = await fileSystem.readFile(item.record.uri);
                    break;
                case "readTextFile":
                    item.result = await fileSystem.readTextFile(item.record.uri);
                    break;
                case "writeFile":
                    item.result = await fileSystem.writeFile(item.record.uri, item.record.content);
                    break;
                case "writeTextFile":
                    item.result = await fileSystem.writeTextFile(item.record.uri, item.record.content);
                    break;
                case "delete":
                    item.result = await fileSystem.delete(item.record.uri, item.record.recursive, item.record.useTrash);
                    break;
                case "rename":
                    item.result = await fileSystem.rename(item.record.source, item.record.target, item.record.overwrite);
                    break;
                case "copy":
                    item.result = await fileSystem.copy(item.record.source, item.record.target);
                    break;
            }
        }
    }

    statByRecord(uri: Uri): FileStat | undefined {
        return this.rawFileRecords.find(item => item.record.kind === "stat" && item.record.uri.equals(uri))?.result as FileStat | undefined;
    }

    readDirectoryByRecord(uri: Uri): [string, FileType][] | undefined {
        return this.rawFileRecords.find(item => item.record.kind === "readDirectory" && item.record.uri.equals(uri))?.result as [string, FileType][] | undefined;
    }

    createDirectoryByRecord(uri: Uri): void | undefined {
        return this.rawFileRecords.find(item => item.record.kind === "createDirectory" && item.record.uri.equals(uri))?.result as void | undefined;
    }

    readFileByRecord(uri: Uri): Uint8Array | undefined {
        return this.rawFileRecords.find(item => item.record.kind === "readFile" && item.record.uri.equals(uri))?.result as Uint8Array | undefined;
    }

    readTextFileByRecord(uri: Uri): string | undefined {
        return this.rawFileRecords.find(item => item.record.kind === "readTextFile" && item.record.uri.equals(uri))?.result as string | undefined;
    }

    writeFileByRecord(uri: Uri, content: Uint8Array): void | undefined {
        return this.rawFileRecords.find(item => item.record.kind === "writeFile" && item.record.uri.equals(uri) && item.record.content === content)?.result as void | undefined;
    }

    writeTextFileByRecord(uri: Uri, content: string): void | undefined {
        return this.rawFileRecords.find(item => item.record.kind === "writeTextFile" && item.record.uri.equals(uri) && item.record.content === content)?.result as void | undefined;
    }

    deleteByRecord(uri: Uri, recursive?: boolean, useTrash?: boolean): void | undefined {
        return this.rawFileRecords.find(item => item.record.kind === "delete" && item.record.uri.equals(uri) && item.record.recursive === recursive && item.record.useTrash === useTrash)?.result as void | undefined;
    }

    renameByRecord(source: Uri, target: Uri, overwrite?: boolean): void | undefined {
        return this.rawFileRecords.find(item => item.record.kind === "rename" && item.record.source.equals(source) && item.record.target.equals(target) && item.record.overwrite === overwrite)?.result as void | undefined;
    }

    copyByRecord(source: Uri, target: Uri): void | undefined {
        return this.rawFileRecords.find(item => item.record.kind === "copy" && item.record.source.equals(source) && item.record.target.equals(target))?.result as void | undefined;
    }
}
