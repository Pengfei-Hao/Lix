import { CompilerManager } from "../compiler-manager";
import * as vscode from 'vscode';

export class blockProvider implements vscode.TreeDataProvider<string> {
    context: CompilerManager;

    constructor(context: CompilerManager) {
        this.context = context;
    }

    getChildren(element?: string | undefined): vscode.ProviderResult<string[]> {
        let document = vscode.window.activeTextEditor?.document;
        if (!document) {
            return [];
        }
        if (!element) {
            let res = [];
            for (let label of this.context.getCompiler(document.uri).parser.blockTable.handlers.keys()) {
                res.push(label);
            }
            return res;
        }
        else {
            return [];
        }
    }

    getTreeItem(element: string): vscode.TreeItem | Thenable<vscode.TreeItem> {
        let item = new vscode.TreeItem(element);
        return item;
    }
}


export class formulaProvider implements vscode.TreeDataProvider<string> {
    context: CompilerManager;

    constructor(context: CompilerManager) {
        this.context = context;
    }

    getChildren(element?: string | undefined): vscode.ProviderResult<string[]> {
        let document = vscode.window.activeTextEditor?.document;
        if (!document) {
            return [];
        }
        let parser = this.context.getCompiler(document.uri).parser;
        if (!element) {
            let res = [];
            for (let label of parser.mathModule.notations.keys()) {
                res.push(label);
            }
            for (let label of parser.mathModule.symbols.keys()) {
                res.push(label);
            }
            return res;
        }
        else {
            return [];
        }
    }

    getTreeItem(element: string): vscode.TreeItem | Thenable<vscode.TreeItem> {
        let item = new vscode.TreeItem(element);
        return item;
    }
}

type CommandItemType = "action" | "targetRoot" | "targetOption";

class CommandItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: CommandItemType,
        command?: vscode.Command,
        description?: string
    ) {
        super(label, collapsibleState);
        this.command = command;
        this.description = description;
    }
}

export class LixCommandProvider implements vscode.TreeDataProvider<CommandItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<CommandItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(private generatorName: string) { }

    refresh(generatorName: string): void {
        this.generatorName = generatorName;
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: CommandItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: CommandItem | undefined): vscode.ProviderResult<CommandItem[]> {
        const currentTarget = this.generatorName;
        if (!element) {
            return [
                this.createActionItem("Compile", "lix.compile", "run"),
                this.createActionItem("Generate", "lix.generate", "file-code"),
                this.createActionItem("Analyse", "lix.analyse", "list-tree"),
                this.createActionItem("Parse", "lix.parse", "list-tree"),
                this.createTargetRootItem(currentTarget)
            ];
        }

        if (element.type === "targetRoot") {
            return ["markdown", "latex", "blog"].map(target => this.createTargetOption(target, target === currentTarget ? "current" : undefined));
        }

        return [];
    }

    private createActionItem(label: string, commandId: string, icon?: string): CommandItem {
        const item = new CommandItem(label, vscode.TreeItemCollapsibleState.None, "action", {
            command: commandId,
            title: label
        });
        if (icon) {
            item.iconPath = new vscode.ThemeIcon(icon.replace("$(", "").replace(")", ""));
        }
        return item;
    }

    private createTargetRootItem(currentTarget: string): CommandItem {
        const item = new CommandItem(`Compile Target (${currentTarget})`, vscode.TreeItemCollapsibleState.Expanded, "targetRoot");
        item.iconPath = new vscode.ThemeIcon("settings-gear");
        return item;
    }

    private createTargetOption(target: string, description?: string): CommandItem {
        const item = new CommandItem(target, vscode.TreeItemCollapsibleState.None, "targetOption", {
            command: "lix.pick",
            title: `Use ${target}`,
            arguments: [target]
        }, description);
        item.iconPath = new vscode.ThemeIcon("circle-filled");
        return item;
    }
}
