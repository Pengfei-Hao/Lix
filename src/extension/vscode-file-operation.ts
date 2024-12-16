import { TextDecoder, TextEncoder } from "util";
import { FileOperation } from "../compiler/file-operation";
import * as vscode from 'vscode';

export class VSCodeFileOperation extends FileOperation {

    workingDirectory: vscode.Uri;
    
    constructor(
        public fileUri: vscode.Uri
    ) {
        super();
        this.workingDirectory = vscode.Uri.joinPath(fileUri, "..");
    }

    async readFile(relativePath: string): Promise<string | undefined> {
        let path = vscode.Uri.joinPath(this.workingDirectory, relativePath);
        try {
            let file = await vscode.workspace.fs.readFile(path);
            let decoder = new TextDecoder();
            return decoder.decode(file);
        } catch (error) {
            console.log(error);

            vscode.window.showErrorMessage(`Encountered an error when reading file "${path.fsPath}".`);
            return;
        }
    }

    async copyFile(relativeSourcePath: string, relativeTargetDirectory: string): Promise<void> {
        let sourcePath = vscode.Uri.joinPath(this.workingDirectory, relativeSourcePath);
        let targetPath = vscode.Uri.joinPath(this.workingDirectory, relativeTargetDirectory, relativeSourcePath);

        try {
            await vscode.workspace.fs.copy(sourcePath, targetPath, { overwrite: true} )
        } catch (error) {
            console.log(error);

            vscode.window.showErrorMessage(`Encountered an error when copying file "${sourcePath.fsPath}" to "${targetPath.fsPath}".`);
            return;
        }
    }

    async writeFile(relativePath: string, content: string): Promise<void> {
        let path = vscode.Uri.joinPath(this.workingDirectory, relativePath);
        try {
            let encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(path, encoder.encode(content));
        } catch (error) {
            console.log(error);
            vscode.window.showErrorMessage(`Encountered an error when writing file "${path.fsPath}".`);
        }
    }

    async createDirectory(relativeDirectory: string): Promise<void> {
        let directory = vscode.Uri.joinPath(this.workingDirectory, relativeDirectory);
        try {
            await vscode.workspace.fs.createDirectory(directory);
        } catch (error) {
            console.log(error);
            vscode.window.showErrorMessage(`Encountered an error when creating directory "${directory.fsPath}".`);
        }
    }

    async getFilesInDirectory(relativeDirectory: string): Promise<string[]> {
        let directory = vscode.Uri.joinPath(this.workingDirectory, relativeDirectory);
        return this.myGetFilesInDirectory(directory);
    }

    private async myGetFilesInDirectory(directory: vscode.Uri): Promise<string[]> {
        let res: string[] = [];
        try {
            let list = await vscode.workspace.fs.readDirectory(directory);
            for(let item of list) {
                let path = vscode.Uri.joinPath(directory, item[0]);
                if(item[1] === vscode.FileType.Directory) {
                    let nres = await this.myGetFilesInDirectory(path);
                    for(let it of nres) {
                        res.push(it);
                    }
                }
                else if(item[1] === vscode.FileType.File) {
                    res.push(this.convertToRelativePath(path));
                }
            }
            return res;
        } catch (error) {
            console.log(error);
            vscode.window.showErrorMessage(`Encountered an error when reading directory "${directory.fsPath}".`);
            return [];
        }
    }

    // path 必须位于 workingDirectory 之内
    private convertToRelativePath(path: vscode.Uri): string {
        return "." + path.path.slice(this.workingDirectory.path.length);
    }

    getFileName(relativePath: string): string {
        let fileName = relativePath.split("/").at(-1)!;
        let dotIndex = fileName.lastIndexOf(".");
        if (dotIndex != -1) {
            fileName = fileName.substring(0, dotIndex);
        }
        return fileName;
    }

    getFileExtension(relativePath: string): string {
        let fileName = relativePath.split("/").at(-1)!;
        return fileName.split(".").at(-1)!;
    }

    get relativePath(): string {
        return "./" + this.fileUri.path.split("/").at(-1)!;
    }

    get fileExtension(): string {
        return this.getFileExtension(this.relativePath);
    }

    get fileName(): string {
        return this.getFileName(this.relativePath);
    }
}
