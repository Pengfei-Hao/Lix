import { Path as LixPath, ParsedPath as LixParsedPath, FormatInputPathObject as LixFormatInputPathObject } from '../compiler/path';
import * as nodePath from 'path';
import * as vscode from 'vscode';
import { NodePathTexts } from './texts';

export class NodePath implements LixPath {

    private platformPath: nodePath.PlatformPath;
    constructor(
        public texts: NodePathTexts,
        platform?: 'posix' | 'win32' | undefined
    ) {
        if (platform === 'posix') {
            this.platformPath = nodePath.posix;
        }
        else if (platform === 'win32') {
            this.platformPath = nodePath.win32;
        }
        else {
            this.platformPath = nodePath;
        }
    }

    normalize(path: string): string {
        return this.tryCall(() => this.platformPath.normalize(path), this.texts.PathNormalizeFailed.format(path));
    }

    join(...paths: string[]): string {
        return this.tryCall(() => this.platformPath.join(...paths), this.texts.PathJoinFailed.format(paths.join(", ")));
    }

    resolve(...paths: string[]): string {
        return this.tryCall(() => this.platformPath.resolve(...paths), this.texts.PathResolveFailed.format(paths.join(", ")));
    }

    isAbsolute(path: string): boolean {
        return this.tryCall(() => this.platformPath.isAbsolute(path), this.texts.PathIsAbsoluteFailed.format(path));
    }

    relative(from: string, to: string): string {
        return this.tryCall(() => this.platformPath.relative(from, to), this.texts.PathRelativeFailed.format(from, to));
    }

    dirname(path: string): string {
        return this.tryCall(() => this.platformPath.dirname(path), this.texts.PathDirnameFailed.format(path));
    }

    basename(path: string, ext?: string): string {
        return this.tryCall(() => this.platformPath.basename(path, ext), this.texts.PathBasenameFailed.format(path));
    }

    extname(path: string): string {
        return this.tryCall(() => this.platformPath.extname(path), this.texts.PathExtnameFailed.format(path));
    }

    get sep(): "\\" | "/" {
        return this.platformPath.sep;
    }

    get delimiter(): ";" | ":" {
        return this.platformPath.delimiter;
    }

    parse(path: string): LixParsedPath {
        return this.tryCall(() => this.platformPath.parse(path), this.texts.PathParseFailed.format(path));
    }

    format(pathObject: LixFormatInputPathObject): string {
        return this.tryCall(() => this.platformPath.format(pathObject), this.texts.PathFormatFailed.format(JSON.stringify(pathObject)));
    }

    private tryCall<T>(fun: () => T, message: string): T {
        try {
            return fun();
        }
        catch (error) {
            if (error instanceof TypeError) {
                console.log(error);
                vscode.window.showErrorMessage(message);
            }
            throw error;
        }
    }
}
