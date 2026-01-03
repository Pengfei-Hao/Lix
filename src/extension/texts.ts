import { CompilerTexts } from "../compiler/texts";
import { GeneratorTexts } from "../generator/texts";
import { ParserTexts } from "../parser/texts";

export type NodePathTexts = {
    PathNormalizeFailed: string;
    PathJoinFailed: string;
    PathResolveFailed: string;
    PathIsAbsoluteFailed: string;
    PathRelativeFailed: string;
    PathDirnameFailed: string;
    PathBasenameFailed: string;
    PathExtnameFailed: string;
    PathParseFailed: string;
    PathFormatFailed: string;
    PathToNamespacedPathFailed: string;
};

export type VSCodeFileSystemTexts = {
    DirectoryCreateFailed: string;
    DirectoryReadFailed: string;
    FileCopyFailed: string;
    FileReadFailed: string;
    FileWriteFailed: string;
    FileStatFailed: string;
    FileDeleteFailed: string;
    FileRenameFailed: string;

    FileExists: string;
    FileIsADirectory: string;
    FileNotADirectory: string;
    FileNotFound: string;
    NoPermissions: string;
    Unavailable: string;
};

// export interface ExtensionTextBundle {
//     nodePathTexts: NodePathTexts;
//     vscodeFileSystemTexts: VSCodeFileSystemTexts;
//     parserTexts: ParserTexts;
//     generatorTexts: GeneratorTexts;
//     compilerTexts: CompilerTexts;
// }

export const extensionExceptionTexts = {} as const;