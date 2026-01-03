import { TextDecoder, TextEncoder } from 'util';
import * as vscode from 'vscode';
import { workspace } from 'vscode';
import { Config } from '../compiler/config';

const defaultSettings = {
    locale: "en-US",
    latexCommand: {
        mac: "xelatex -synctex=1 -interaction=nonstopmode",
        linux: "xelatex -synctex=1 -interaction=nonstopmode",
        windows: "xelatex.exe -synctex=1 -interaction=nonstopmode"
    },
    cacheDirectory: ".lix"
} as const;

export class VSCodeConfig implements Config {

    settings: {
        locale: string,
        latexCommand: {
            mac: string,
            linux: string,
            windows: string
        },
        cacheDirectory: string
    };

    configs: Map<string, string>;

    constructor(
        public configUri: vscode.Uri
    ) {
        this.configs = new Map();
        this.settings = defaultSettings;
    }

    checkAndCreateConfigDirectory(): Thenable<void> {
        return workspace.fs.createDirectory(this.configUri);
    }

    async readAll(): Promise<boolean> {
        await this.checkAndCreateConfigDirectory();

        let res: [string, vscode.FileType][] = await workspace.fs.readDirectory(this.configUri);
        let decoder: TextDecoder = new TextDecoder();
        let regName = /\.json$/;
        let name;
        for (let i = 0; i < res.length; i++) {
            name = res[i][0];
            workspace.fs.stat
            if (res[i][1] === vscode.FileType.File && regName.exec(name) != null) {
                let file = await workspace.fs.readFile(vscode.Uri.joinPath(this.configUri, name));
                let content = decoder.decode(file);
                this.configs.set(name.substring(0, name.length - 5), content);
            }
        }
        const settingContent = this.get("settings");
        // if (settingContent) {
        //     const parsed = JSON.parse(settingContent) as Partial<typeof this.settings>;
        //     this.settings = {
        //         ...this.settings,
        //         ...parsed,
        //         latexCommand: {
        //             ...this.settings.latexCommand,
        //             ...(parsed?.latexCommand || {})
        //         }
        //     };
        // }
        this.settings = JSON.parse(settingContent);
        return true;
    }

    async saveAll(): Promise<boolean> {
        await this.checkAndCreateConfigDirectory();


        let encoder = new TextEncoder();
        this.configs.forEach((value, key, map) => {
            workspace.fs.writeFile(vscode.Uri.joinPath(this.configUri, key + ".json"), encoder.encode(value));
        });
        return true;
    }

    get(name: string): string {
        let res = this.configs.get(name);
        if (res === undefined) {
            this.configs.set(name, "");
            return "";
        }
        return res;
    }

    set(name: string, content: string) {
        this.configs.set(name, content);
    }
}
