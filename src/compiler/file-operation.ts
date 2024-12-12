export abstract class FileOperation {
    
    abstract readFile (relativePath: string): Promise<string | undefined>;

    abstract copyFile (relativeSourcePath: string, relativeTargetDirectory: string): Promise<void>;

    abstract writeFile (relativePath: string, content: string): Promise<void>

    abstract createDirectory (relativePath: string): Promise<void>;

    abstract getFileName(relativePath: string): string;

    abstract getFileExtension (relativePath: string): string;

    abstract get relativePath(): string;

    abstract get fileName(): string;

    abstract get fileExtension (): string;
    
}