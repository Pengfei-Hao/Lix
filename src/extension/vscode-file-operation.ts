import { TextDecoder, TextEncoder } from "util";
import { FileOperation } from "../compiler/file-operation";
import * as vscode from 'vscode';
import { FileOperationType, FileRecord } from "../parser/result";
import { VscodeText } from "../foundation/i18n";

export class VSCodeFileOperation extends FileOperation {

    workingDirectory: vscode.Uri;
    private records: FileRecord[];

    constructor(
        public fileUri: vscode.Uri,
        public lang: VscodeText
    ) {
        super();
        this.workingDirectory = vscode.Uri.joinPath(fileUri, "..");
        this.records = [];
    }

    async readFile(relativePath: string): Promise<string | undefined> {
        let path = vscode.Uri.joinPath(this.workingDirectory, relativePath);
        try {
            let file = await vscode.workspace.fs.readFile(path);
            let decoder = new TextDecoder();
            return decoder.decode(file);
        } catch (error) {
            console.log(error);

            const message = (this.lang.FileReadFailed).format(path.fsPath);
            vscode.window.showErrorMessage(message);
            return;
        }
    }

    async copyFile(relativeSourcePath: string, relativeTargetDirectory: string): Promise<void> {
        let sourcePath = vscode.Uri.joinPath(this.workingDirectory, relativeSourcePath);
        let targetPath = vscode.Uri.joinPath(this.workingDirectory, relativeTargetDirectory, relativeSourcePath);

        try {
            await vscode.workspace.fs.copy(sourcePath, targetPath, { overwrite: true })
        } catch (error) {
            console.log(error);

            const message = (this.lang.FileCopyFailed).format(sourcePath.fsPath, targetPath.fsPath);
            vscode.window.showErrorMessage(message);
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
            const message = (this.lang.FileWriteFailed).format(path.fsPath);
            vscode.window.showErrorMessage(message);
        }
    }

    async createDirectory(relativeDirectory: string): Promise<void> {
        let directory = vscode.Uri.joinPath(this.workingDirectory, relativeDirectory);
        try {
            await vscode.workspace.fs.createDirectory(directory);
        } catch (error) {
            console.log(error);
            const message = (this.lang.DirectoryCreateFailed).format(directory.fsPath);
            vscode.window.showErrorMessage(message);
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
            for (let item of list) {
                let path = vscode.Uri.joinPath(directory, item[0]);
                if (item[1] === vscode.FileType.Directory) {
                    let nres = await this.myGetFilesInDirectory(path);
                    for (let it of nres) {
                        res.push(it);
                    }
                }
                else if (item[1] === vscode.FileType.File) {
                    res.push(this.convertToRelativePath(path));
                }
            }
            return res;
        } catch (error) {
            console.log(error);
            const message = (this.lang.DirectoryReadFailed).format(directory.fsPath);
            vscode.window.showErrorMessage(message);
            return [];
        }
    }

    // path 必须位于 workingDirectory 之内
    private convertToRelativePath(path: vscode.Uri): string {
        return "." + path.path.slice(this.workingDirectory.path.length);
    }

    // readFileByRecord(relativePath: string): void {
    //     this.records.push(new OperationRecord(OperationType.readFile, relativePath, "", undefined));
    // }

    // copyFileByRecord(relativeSourcePath: string, relativeTargetDirectory: string): void {
    //     this.records.push(new OperationRecord(OperationType.copyFile, relativeSourcePath, relativeTargetDirectory, undefined));
    // }

    // writeFileByRecord(relativePath: string, content: string): void {
    //     this.records.push(new OperationRecord(OperationType.writeFile, relativePath, content, undefined));
    // }

    // createDirectoryByRecord(relativePath: string): void {
    //     this.records.push(new OperationRecord(OperationType.createDirectory, relativePath, "", undefined));
    // }

    // getFilesInDirectoryByRecord(relativeDirectory: string): void {
    //     this.records.push(new OperationRecord(OperationType.getFilesInDirectory, relativeDirectory, "", undefined));
    // }

    readFileByRecord(relativePath: string): string {
        return this.records.find(value => value.type === FileOperationType.readFile && value.from === relativePath)!.result as string
    }

    copyFileByRecord(relativeSourcePath: string, relativeTargetDirectory: string): void {
        this.records.find(value => value.type === FileOperationType.copyFile && value.from === relativeSourcePath && value.to === relativeTargetDirectory)!.result
    }

    writeFileByRecord(relativePath: string, content: string): void {
        this.records.find(value => value.type === FileOperationType.writeFile && value.from === relativePath && value.to === content)!.result
    }

    createDirectoryByRecord(relativePath: string): void {
        this.records.find(value => value.type === FileOperationType.createDirectory && value.from === relativePath)!.result
    }

    getFilesInDirectoryByRecord(relativeDirectory: string): string[] {
        return this.records.find(value => value.type === FileOperationType.getFilesInDirectory && value.from === relativeDirectory)!.result as string[]
    }

    async operateByRecord(records: FileRecord[]): Promise<void> {
        this.records = records;
        for (let record of this.records) {
            switch (record.type) {
                case FileOperationType.readFile:
                    record.result = await this.readFile(record.from);
                    break;
                case FileOperationType.copyFile:
                    await this.copyFile(record.from, record.to)
                    break;
                case FileOperationType.writeFile:
                    await this.writeFile(record.from, record.to);
                    break;
                case FileOperationType.createDirectory:
                    await this.createDirectory(record.from);
                    break;
                case FileOperationType.getFilesInDirectory:
                    record.result = await this.getFilesInDirectory(record.from);
                    break;
            }
        }
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

    get cacheDirectory(): string {
        return "./.lix/";
    }

    get fileExtension(): string {
        return this.getFileExtension(this.relativePath);
    }

    get fileName(): string {
        return this.getFileName(this.relativePath);
    }
}