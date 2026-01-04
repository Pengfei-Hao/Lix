import { TextDecoder, TextEncoder } from "util";
import { FileStat, FileSystem, FileSystemRecord, FileType } from "../compiler/file-system";
import * as vscode from 'vscode';
import { NodePath } from "./node-path";
import { Uri } from "../compiler/uri";
import { VSCodeUri } from "./vscode-uri";
import { VSCodeFileSystemTexts } from "./texts";

export class VSCodeFileSystem implements FileSystem {

    private file: VSCodeUri;
    private workingDirectory: VSCodeUri;
    private cacheDirectory: VSCodeUri;

    private records: FileSystemRecord[];

    constructor(
        vscodeFileUri: vscode.Uri,
        public nodePath: NodePath,
        private texts: VSCodeFileSystemTexts
    ) {
        this.file = new VSCodeUri(vscodeFileUri);
        this.workingDirectory = this.file.joinPath("..");
        this.cacheDirectory = this.workingDirectory.joinPath(".lix");

        this.records = [];
    }

    get fileUri(): VSCodeUri {
        return this.file;
    }

    get workingDirectoryUri(): VSCodeUri {
        return this.workingDirectory;
    }

    get cacheDirectoryUri(): VSCodeUri {
        return this.cacheDirectory;
    }

    get path(): NodePath {
        return this.nodePath;
    }

    pathToUri(path: string): VSCodeUri {
        return this.nodePath.isAbsolute(path)
            ? new VSCodeUri(vscode.Uri.file(path))
            : this.workingDirectory.joinPath(path);
    }

    stringToUri(value: string, strict?: boolean): VSCodeUri {
        return new VSCodeUri(vscode.Uri.parse(value, strict));
    }

    Uri(components: { readonly scheme: string; readonly authority?: string; readonly path?: string; readonly query?: string; readonly fragment?: string; }): VSCodeUri {
        return new VSCodeUri(vscode.Uri.from(components));
    }

    async stat(uri: Uri): Promise<FileStat | undefined> {
        return this.tryCall(() => vscode.workspace.fs.stat(this.getUri(uri)), (this.texts.FileStatFailed).format(uri.toString()));
    }

    async readDirectory(uri: Uri): Promise<[string, vscode.FileType][] | undefined> {
        return this.tryCall(() => vscode.workspace.fs.readDirectory(this.getUri(uri)), (this.texts.DirectoryReadFailed).format(uri.toString()));
    }

    async createDirectory(uri: Uri): Promise<void | undefined> {
        await this.tryCall(() => vscode.workspace.fs.createDirectory(this.getUri(uri)), (this.texts.DirectoryCreateFailed).format(uri.toString()));
    }

    async readFile(uri: Uri): Promise<Uint8Array | undefined> {
        return this.tryCall(() => vscode.workspace.fs.readFile(this.getUri(uri)), (this.texts.FileReadFailed).format(uri.toString()));
    }

    async readTextFile(uri: Uri): Promise<string | undefined> {
        const res = await this.tryCall(() => vscode.workspace.fs.readFile(this.getUri(uri)), (this.texts.FileReadFailed).format(uri.toString()));
        if (res === undefined) {
            return undefined;
        }
        return new TextDecoder().decode(res);
    }

    async writeFile(uri: Uri, content: Uint8Array): Promise<void | undefined> {
        return this.tryCall(() => vscode.workspace.fs.writeFile(this.getUri(uri), content), (this.texts.FileWriteFailed).format(uri.toString()));
    }

    async writeTextFile(uri: Uri, content: string): Promise<void | undefined> {
        return this.tryCall(() => vscode.workspace.fs.writeFile(this.getUri(uri), new TextEncoder().encode(content)), (this.texts.FileWriteFailed).format(uri.toString()));
    }

    async delete(uri: Uri, recursive?: boolean, useTrash?: boolean): Promise<void | undefined> {
        return this.tryCall(() => vscode.workspace.fs.delete(this.getUri(uri), { recursive: recursive, useTrash: useTrash }), (this.texts.FileDeleteFailed).format(uri.toString()));
    }

    async rename(source: Uri, target: Uri, overwrite?: boolean): Promise<void | undefined> {
        return this.tryCall(() => vscode.workspace.fs.rename(this.getUri(source), this.getUri(target), { overwrite: overwrite }), (this.texts.FileRenameFailed).format(source.toString(), target.toString()));
    }

    async copy(source: Uri, target: Uri): Promise<void | undefined> {
        return this.tryCall(() => vscode.workspace.fs.copy(this.getUri(source), this.getUri(target), { overwrite: true }), (this.texts.FileCopyFailed).format(source.toString(), target.toString()));
    }

    async executeRecords(records: FileSystemRecord[]): Promise<void> {
        this.records = records;
        for (let record of this.records) {
            switch (record.kind) {
                case "stat":
                    record.result = await this.stat(record.uri);
                    break;
                case "readDirectory":
                    record.result = await this.readDirectory(record.uri);
                    break;
                case "createDirectory":
                    record.result = await this.createDirectory(record.uri);
                    break;
                case "readFile":
                    record.result = await this.readFile(record.uri);
                    break;
                case "readTextFile":
                    record.result = await this.readTextFile(record.uri);
                    break;
                case "writeFile":
                    record.result = await this.writeFile(record.uri, record.content);
                    break;
                case "writeTextFile":
                    record.result = await this.writeTextFile(record.uri, record.content);
                    break;
                case "delete":
                    record.result = await this.delete(record.uri, record.recursive, record.useTrash);
                    break;
                case "rename":
                    record.result = await this.rename(record.source, record.target, record.overwrite);
                    break;
                case "copy":
                    record.result = await this.copy(record.source, record.target);
                    break;
            }
        }
    }

    statByRecord(uri: Uri): FileStat | undefined {
        return this.records.find(value => value.kind === "stat" && value.uri.equals(uri))?.result as FileStat | undefined;
    }

    readDirectoryByRecord(uri: Uri): [string, FileType][] | undefined {
        return this.records.find(value => value.kind === "readDirectory" && value.uri.equals(uri))?.result as [string, FileType][] | undefined;
    }

    createDirectoryByRecord(uri: Uri): void | undefined {
        return this.records.find(value => value.kind === "createDirectory" && value.uri.equals(uri))?.result as void | undefined;
    }

    readFileByRecord(uri: Uri): Uint8Array | undefined {
        return this.records.find(value => value.kind === "readFile" && value.uri.equals(uri))?.result as Uint8Array | undefined;
    }

    readTextFileByRecord(uri: Uri): string | undefined {
        return this.records.find(value => value.kind === "readTextFile" && value.uri.equals(uri))?.result as string | undefined;
    }

    writeFileByRecord(uri: Uri, content: Uint8Array): void | undefined {
        return this.records.find(value => value.kind === "writeFile" && value.uri.equals(uri) && value.content === content)?.result as void | undefined;
    }

    writeTextFileByRecord(uri: Uri, content: string): void | undefined {
        return this.records.find(value => value.kind === "writeTextFile" && value.uri.equals(uri) && value.content === content)?.result as void | undefined;
    }

    deleteByRecord(uri: Uri, recursive?: boolean, useTrash?: boolean): void | undefined {
        return this.records.find(value => value.kind === "delete" && value.uri.equals(uri) && value.recursive === recursive && value.useTrash === useTrash)?.result as void | undefined;
    }

    renameByRecord(source: Uri, target: Uri, overwrite?: boolean): void | undefined {
        return this.records.find(value => value.kind === "rename" && value.source.equals(source) && value.target.equals(target) && value.overwrite === overwrite)?.result as void | undefined;
    }

    copyByRecord(source: Uri, target: Uri): void | undefined {
        return this.records.find(value => value.kind === "copy" && value.source.equals(source) && value.target.equals(target))?.result as void | undefined;
    }

    private async tryCall<T>(fun: () => Thenable<T>, message: string): Promise<T | undefined> {
        try {
            return await fun();
        } catch (error) {
            if (error instanceof vscode.FileSystemError) {
                console.log(error);
                let addition = "";
                switch (error.name) {
                    case "FileExists":
                        addition = this.texts.FileExists;
                        break;
                    case "FileIsADirectory":
                        addition = this.texts.FileIsADirectory;
                        break;
                    case "FileNotADirectory":
                        addition = this.texts.FileNotADirectory;
                        break;
                    case "FileNotFound":
                        addition = this.texts.FileNotFound;
                        break;
                    case "NoPermissions":
                        addition = this.texts.NoPermissions;
                        break;
                    case "Unavailable":
                        addition = this.texts.Unavailable;
                        break;
                }
                vscode.window.showErrorMessage(message.format({ addition: addition }));
                return undefined;
            }
            throw error;
        }
    }

    private getUri(uri: Uri): vscode.Uri {
        return vscode.Uri.from({ scheme: uri.scheme, authority: uri.authority, path: uri.path, query: uri.query, fragment: uri.fragment });
    }
}
