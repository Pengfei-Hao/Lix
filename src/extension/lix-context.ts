import { TextDocument, Uri } from "vscode";
import { Parser } from "../parser/parser";
import { VSCodeConfig } from "./vscode-config";
import { Generator } from "../generator/generator";
import { Compiler } from "../compiler/compiler";
import { VSCodeFileOperation } from "./vscode-file-operation";

export class LixContext {

    compilers: Map<string, Compiler>;
    config: VSCodeConfig; 

    constructor(config: VSCodeConfig) {
        this.compilers = new Map();
        this.config = config;
    }

    getCompiler(docUri: Uri): Compiler {
        let res = this.compilers.get(docUri.path);
        if(res == undefined) {
            let newCompiler = new Compiler(this.config, new VSCodeFileOperation(docUri));
            this.compilers.set(docUri.path, newCompiler);
            return newCompiler;
        }
        else {
            return res;
        }
    }
}