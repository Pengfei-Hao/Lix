import { TextDocument, Uri } from "vscode";
import { Parser } from "../parser/parser";
import { VSCodeConfig } from "./vscode-config";
import { Generator } from "../generator/generator";
import { Compiler } from "../compiler/compiler";
import { VSCodeFileOperation } from "./vscode-file-operation";
import { VscodeText } from "../foundation/i18n";

export class LixContext {

    compilers: Map<string, Compiler>;
    config: VSCodeConfig;
    fileList: Map<string, string[]>;
    lang: VscodeText;

    constructor(config: VSCodeConfig, lang: VscodeText) {
        this.compilers = new Map();
        this.config = config;
        this.fileList = new Map();
        this.lang = lang;
    }

    getCompiler(docUri: Uri): Compiler {
        let res = this.compilers.get(docUri.path);
        if(res == undefined) {
            let newCompiler = new Compiler(this.config, new VSCodeFileOperation(docUri, this.lang));
            this.compilers.set(docUri.path, newCompiler);
            return newCompiler;
        }
        else {
            return res;
        }
    }

    getFileList(docUri: Uri): string[] {
        let res = this.fileList.get(docUri.path);
        if(res == undefined) {
            let newFile: string[] = [];
            this.fileList.set(docUri.path, newFile);
            return newFile;
        }
        else {
            return res;
        }
    }

    setFileList(docUri: Uri, list: string[]) {
        this.fileList.set(docUri.path, list);
    }
}
