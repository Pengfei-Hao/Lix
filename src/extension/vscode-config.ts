import { TextDecoder, TextEncoder } from 'util';
import * as vscode from 'vscode';
import { workspace } from 'vscode';
import { Config } from '../compiler/config';

export class VSCodeConfig extends Config {
    uri: vscode.Uri;

    configs: Map<string, string>;

   constructor(configUri: vscode.Uri) {
        super();
        this.uri = configUri;
        this.uri = vscode.Uri.joinPath(this.uri, "config");
        this.configs = new Map();
        this.settings = { language: "en-US" };
    }

    checkAndCreateConfigDirectory(): Thenable<void> {
       return workspace.fs.createDirectory(this.uri);
    }

    async readAll(): Promise<boolean> {
        await this.checkAndCreateConfigDirectory();

        let res: [string, vscode.FileType][] = await workspace.fs.readDirectory(this.uri);
        let decoder: TextDecoder = new TextDecoder();
        let regName = /\.json$/;
        let name;
        for(let i = 0; i < res.length; i++) {
            name = res[i][0];
            workspace.fs.stat
            if(res[i][1] === vscode.FileType.File && regName.exec(name) != null) {
                let file = await workspace.fs.readFile(vscode.Uri.joinPath(this.uri, name));
                let content = decoder.decode(file);
                this.configs.set(name.substring(0, name.length - 5), content);
            }
        }
        this.settings = JSON.parse(this.get("settings"));
        return true;
    }

    async saveAll(): Promise<boolean> {
        await this.checkAndCreateConfigDirectory();
        

        let encoder = new TextEncoder();
        this.configs.forEach((value, key, map) => {
            workspace.fs.writeFile(vscode.Uri.joinPath(this.uri, key + ".json"), encoder.encode(value));
        });
        return true;
    }

    get(name: string): string {
        let res = this.configs.get(name);
        if(res === undefined) {
            this.configs.set(name, "");
            return "";
        }
        return res;
    }

    set(name: string, content: string) {
        this.configs.set(name, content);
    }
}