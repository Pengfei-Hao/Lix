import { CompilerManager } from "../compiler-manager";
import * as vscode from 'vscode';

export class BlockProvider implements vscode.TreeDataProvider<string> {

    onDidChangeTreeDataEmitter: vscode.EventEmitter<string | undefined>;
    onDidChangeTreeData;

    constructor(
        private compilerManager: CompilerManager
    ) {
        this.onDidChangeTreeDataEmitter = new vscode.EventEmitter<string | undefined>();
        this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    }

    getChildren(element?: string | undefined): vscode.ProviderResult<string[]> {
        let document = this.compilerManager.validateDocument();
        if (!document) {
            return [];
        }
        if (!element) {
            let res = [];
            let parser = this.compilerManager.getParseResult(document);
            for (let blockName of parser.blockTable.handlers.keys()) {
                res.push(blockName);
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


export class SymbolsProvider implements vscode.TreeDataProvider<string> {

    onDidChangeTreeDataEmitter: vscode.EventEmitter<string | undefined>;
    onDidChangeTreeData;

    constructor(
        private compilerManager: CompilerManager
    ) {
        this.onDidChangeTreeDataEmitter = new vscode.EventEmitter<string | undefined>();
        this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    }

    getChildren(element?: string | undefined): vscode.ProviderResult<string[]> {
        let document = this.compilerManager.validateDocument();
        if (!document) {
            return [];
        }
        if (!element) {
            let res = [];
            let parser = this.compilerManager.getParseResult(document);
            for (let notation of parser.mathModule.notations.keys()) {
                let symbol = parser.mathModule.notationsToUnicodeSymbols.get(notation);
                if (symbol) {
                    notation = `${notation} ${symbol}`;
                }
                res.push(notation);
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

export class StructureProvider implements vscode.TreeDataProvider<string> {

    onDidChangeTreeDataEmitter: vscode.EventEmitter<string | undefined>;
    onDidChangeTreeData;

    constructor(
        private compilerManager: CompilerManager
    ) {
        this.onDidChangeTreeDataEmitter = new vscode.EventEmitter<string | undefined>();
        this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    }

    getChildren(element?: string | undefined): vscode.ProviderResult<string[]> {
        let document = this.compilerManager.validateDocument();
        if (!document) {
            return [];
        }
        return [];
    }

    getTreeItem(element: string): vscode.TreeItem | Thenable<vscode.TreeItem> {
        let item = new vscode.TreeItem(element);
        return item;
    }
}

type CommandItemType = "action" | "generatorRoot" | "generatorOption";

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

export class CommandProvider implements vscode.TreeDataProvider<CommandItem> {

    onDidChangeTreeDataEmitter: vscode.EventEmitter<CommandItem | undefined>;
    onDidChangeTreeData;

    constructor(
        private compilerManager: CompilerManager
    ) {
        this.onDidChangeTreeDataEmitter = new vscode.EventEmitter<CommandItem | undefined>();
        this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    }

    getTreeItem(element: CommandItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: CommandItem | undefined): vscode.ProviderResult<CommandItem[]> {
        let document = this.compilerManager.validateDocument();
        if (!document) {
            return [];
        }
        let currentGenerator = this.compilerManager.getGenerator(document);
        if (!element) {
            return [
                this.getActionItem("Compile", "lix.compile", "run"),
                this.getActionItem("Generate", "lix.generate", "file-code"),
                this.getActionItem("Analyse", "lix.analyse", "list-tree"),
                this.getActionItem("Parse", "lix.parse", "list-tree"),
                this.getActionItem("Debug", "lix.debug", "bug"),
                this.getGeneratorRootItem(currentGenerator)
            ];
        }

        if (element.type === "generatorRoot") {
            let allGenerators = this.compilerManager.getGenerators(document);
            return allGenerators.map(generator => this.getGeneratorOption(generator, generator === currentGenerator));
        }

        return [];
    }

    private getActionItem(label: string, commandId: string, icon?: string): CommandItem {
        const item = new CommandItem(label, vscode.TreeItemCollapsibleState.None, "action", {
            command: commandId,
            title: label
        });
        if (icon) {
            item.iconPath = new vscode.ThemeIcon(icon.replace("$(", "").replace(")", ""));
        }
        return item;
    }

    private getGeneratorRootItem(currentGenerator: string): CommandItem {
        const item = new CommandItem(`Available Generators`, vscode.TreeItemCollapsibleState.Expanded, "generatorRoot");
        item.iconPath = new vscode.ThemeIcon("settings-gear");
        return item;
    }

    private getGeneratorOption(generator: string, selected: boolean): CommandItem {
        const item = new CommandItem(generator, vscode.TreeItemCollapsibleState.None, "generatorOption", {
            command: "lix.pick",
            title: `Use ${generator}`,
            arguments: [generator]
        });
        item.iconPath = selected ? new vscode.ThemeIcon("circle-filled") : new vscode.ThemeIcon("circle-outline");
        return item;
    }
}
