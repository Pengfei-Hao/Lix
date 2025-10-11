import { FileRecord } from "../parser/result";

export abstract class FileOperation {
    
    abstract readFile (relativePath: string): Promise<string | undefined>;

    abstract copyFile (relativeSourcePath: string, relativeTargetDirectory: string): Promise<void>;

    abstract writeFile (relativePath: string, content: string): Promise<void>;

    abstract createDirectory (relativePath: string): Promise<void>;

    abstract getFilesInDirectory(relativeDirectory: string): Promise<string[]>;

    abstract readFileByRecord (relativePath: string): string;

    abstract copyFileByRecord (relativeSourcePath: string, relativeTargetDirectory: string): void;

    abstract writeFileByRecord (relativePath: string, content: string): void;

    abstract createDirectoryByRecord (relativePath: string): void;

    abstract getFilesInDirectoryByRecord(relativeDirectory: string): string[];

    abstract operateByRecord(records: FileRecord[]): Promise<void>;

    abstract getFileName(relativePath: string): string;

    abstract getFileExtension (relativePath: string): string;

    abstract get relativePath(): string;

    abstract get cacheDirectory(): string;

    abstract get fileName(): string;

    abstract get fileExtension (): string;
    
}