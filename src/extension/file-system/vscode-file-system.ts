import { TextDecoder, TextEncoder } from "util";
import * as vscode from 'vscode';
import { FileStat, FileSystem } from "../../common/file-system/file-system";
import { Uri } from "../../common/file-system/uri";
import { VSCodeFileSystemTexts } from "../texts";

export class VSCodeFileSystem implements FileSystem {

    constructor(
        private texts: VSCodeFileSystemTexts
    ) {
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

    private async tryCall<T>(fun: () => Thenable<T>, message: string): Promise<T | undefined> {
        try {
            return await fun();
        } catch (error) {
            if (error instanceof vscode.FileSystemError) {
                console.log(error);
                let addition = "";
                switch (error.code) {
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
                    case "Unknown":
                        addition = this.texts.Unknown;
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
