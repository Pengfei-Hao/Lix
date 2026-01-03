import { Extension, TextDocument, Uri } from "vscode";
import { Parser } from "../parser/parser";
import { VSCodeConfig } from "./vscode-config";
import { Generator } from "../generator/generator";
import { Compiler } from "../compiler/compiler";
import { VSCodeFileSystem } from "./vscode-file-system";
import { NodePath } from "./node-path";
import { Texts } from "./locale";

export class CompilerManager {

    compilers: Map<string, Compiler>;
    fileList: Map<string, string[]>;


    constructor(
        public config: VSCodeConfig,
        public texts: Texts
    ) {
        this.compilers = new Map();
        this.fileList = new Map();
    }

    getCompiler(docUri: Uri): Compiler {
        let res = this.compilers.get(docUri.toString());
        if (res == undefined) {
            let newCompiler = new Compiler(this.config, new VSCodeFileSystem(docUri, new NodePath(this.texts.NodePath), this.texts.VSCodeFileSystem), this.texts);
            this.compilers.set(docUri.toString(), newCompiler);
            return newCompiler;
        }
        else {
            return res;
        }
    }

    getFileList(docUri: Uri): string[] {
        let res = this.fileList.get(docUri.toString());
        if (res == undefined) {
            let newFile: string[] = [];
            this.fileList.set(docUri.toString(), newFile);
            return newFile;
        }
        else {
            return res;
        }
    }

    setFileList(docUri: Uri, list: string[]) {
        this.fileList.set(docUri.toString(), list);
    }
}
