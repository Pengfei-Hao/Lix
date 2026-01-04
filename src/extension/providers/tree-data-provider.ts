import { Node } from "../../syntax-tree/node";
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

class StructureItem extends vscode.TreeItem {
    constructor(
        label: string,
        public readonly uri: vscode.Uri,
        public readonly line: number
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = {
            command: "lix.gotoLine",
            title: "Go to Line",
            arguments: [uri, line]
        };
    }
}

export class StructureProvider implements vscode.TreeDataProvider<StructureItem> {

    onDidChangeTreeDataEmitter: vscode.EventEmitter<StructureItem | undefined>;
    onDidChangeTreeData;

    constructor(
        private compilerManager: CompilerManager
    ) {
        this.onDidChangeTreeDataEmitter = new vscode.EventEmitter<StructureItem | undefined>();
        this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    }

    getChildren(element?: StructureItem | undefined): vscode.ProviderResult<StructureItem[]> {
        let document = this.compilerManager.validateDocument();
        if (!document) {
            return [];
        }
        const parser = this.compilerManager.getParseResult(document);
        const typeTable = this.compilerManager.getTypeTable(document);

        const titleType = typeTable.get("title");
        const authorType = typeTable.get("author");
        const dateType = typeTable.get("date");
        const sectionType = typeTable.get("section");
        const subsectionType = typeTable.get("subsection");
        const subsubsectionType = typeTable.get("subsubsection");
        const tableofcontentsType = typeTable.get("tableofcontents");
        const bibliographyType = typeTable.get("bibliography");

        const definitionType = typeTable.get("definition");
        const lemmaType = typeTable.get("lemma");
        const propositionType = typeTable.get("proposition");
        const theoremType = typeTable.get("theorem");
        const proofType = typeTable.get("proof");
        const corollaryType = typeTable.get("corollary");

        const figureType = typeTable.get("figure");
        const codeType = typeTable.get("code");
        const listType = typeTable.get("list");
        const tableType = typeTable.get("table");
        const captionType = typeTable.get("caption");

        const paragraphType = typeTable.get("paragraph");
        const wordsType = typeTable.get("words");

        let secIdx = 0;
        let subIdx = 0;
        let subsubIdx = 0;

        let mathIdx = 0;

        let figIdx = 0;
        let codeIdx = 0;
        let listIdx = 0;
        let tableIdx = 0;

        const getWords = (node: Node) => node.children.filter(child => child.type === wordsType).map(child => child.content).join(" ");

        const getCaption = (node: Node) => {
            let captionNode = node.children.find(child => child.type === captionType);
            return captionNode ? getWords(captionNode) : "";
        };


        const items: StructureItem[] = [];
        for (let node of parser.analysedTree.children) {
            const line = parser.getLineAndCharacter(node.begin)?.line ?? 0;
            if (node.type === titleType) {
                items.push(new StructureItem(`Title: ${getWords(node)}`, document.uri, line));
            }
            if (node.type === authorType) {
                items.push(new StructureItem(`Author: ${getWords(node)}`, document.uri, line));
            }
            if (node.type === dateType) {
                items.push(new StructureItem(`Date: ${getWords(node)}`, document.uri, line));
            }
            if (node.type === tableofcontentsType) {
                items.push(new StructureItem(`Table of Contents`, document.uri, line));
            }
            if (node.type === bibliographyType) {
                items.push(new StructureItem(`Bibliography`, document.uri, line));
            }
            if (node.type === sectionType) {
                secIdx++;
                subIdx = 0;
                subsubIdx = 0;
                items.push(new StructureItem(`${secIdx}. ${getWords(node)}`, document.uri, line));
            }
            if (node.type === subsectionType) {
                subIdx++;
                subsubIdx = 0;
                items.push(new StructureItem(`${secIdx}.${subIdx} ${getWords(node)}`, document.uri, line));
            }
            if (node.type === subsubsectionType) {
                subsubIdx++;
                items.push(new StructureItem(`${secIdx}.${subIdx}.${subsubIdx} ${getWords(node)}`, document.uri, line));
            }

            if ([definitionType, lemmaType, propositionType, theoremType, proofType, corollaryType].includes(node.type)) {
                mathIdx++;
                let label = "";
                if (node.type === definitionType) label = "Def";
                if (node.type === lemmaType) label = "Lemma";
                if (node.type === propositionType) label = "Prop";
                if (node.type === theoremType) label = "Thm";
                if (node.type === proofType) label = "Proof";
                if (node.type === corollaryType) label = "Coro";
                items.push(new StructureItem(`${label} ${mathIdx}. ${getWords(node)}`, document.uri, line));
            }

            if (node.type === paragraphType) {
                for (let parNode of node.children) {
                    const line = parser.getLineAndCharacter(parNode.begin)?.line ?? 0;
                    if (parNode.type === figureType) {
                        figIdx++;
                        items.push(new StructureItem(`Figure ${figIdx}. ${getCaption(parNode)}`, document.uri, line));
                    }
                    if (parNode.type === codeType) {
                        codeIdx++;
                        items.push(new StructureItem(`Code ${codeIdx}. ${getCaption(parNode)}`, document.uri, line));
                    }
                    if (parNode.type === listType) {
                        listIdx++;
                        items.push(new StructureItem(`List ${listIdx}. ${getCaption(parNode)}`, document.uri, line));
                    }
                    if (parNode.type === tableType) {
                        tableIdx++;
                        items.push(new StructureItem(`Table ${tableIdx}. ${getCaption(parNode)}`, document.uri, line));
                    }
                }
            }
        }
        return items;
    }

    getTreeItem(element: StructureItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
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

export class StructureSymbolProvider implements vscode.DocumentSymbolProvider {

    constructor(private compilerManager: CompilerManager) { }

    provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.DocumentSymbol[]> {
        const doc = this.compilerManager.validateDocument(document);
        if (!doc) {
            return [];
        }
        const parser = this.compilerManager.getParseResult(doc);
        const typeTable = this.compilerManager.getTypeTable(doc);

        const sectionType = typeTable.get("section");
        const subsectionType = typeTable.get("subsection");
        const subsubsectionType = typeTable.get("subsubsection");
        const figureType = typeTable.get("figure");

        let secIdx = 0, subIdx = 0, subsubIdx = 0, figIdx = 0;
        const symbols: vscode.DocumentSymbol[] = [];

        for (let node of parser.analysedTree.children) {
            const start = parser.getLineAndCharacter(node.begin) ?? { line: 0, character: 0 };
            const end = parser.getLineAndCharacter(node.end) ?? start;
            const range = new vscode.Range(start.line, start.character, end.line, end.character);

            if (node.type === sectionType) {
                secIdx++; subIdx = 0; subsubIdx = 0;
                symbols.push(new vscode.DocumentSymbol(`${secIdx}. ${node.content}`, "", vscode.SymbolKind.Namespace, range, range));
            }
            if (node.type === subsectionType) {
                subIdx++; subsubIdx = 0;
                symbols.push(new vscode.DocumentSymbol(`${secIdx}.${subIdx} ${node.content}`, "", vscode.SymbolKind.Namespace, range, range));
            }
            if (node.type === subsubsectionType) {
                subsubIdx++;
                symbols.push(new vscode.DocumentSymbol(`${secIdx}.${subIdx}.${subsubIdx} ${node.content}`, "", vscode.SymbolKind.Namespace, range, range));
            }
            if (node.type === figureType) {
                figIdx++;
                symbols.push(new vscode.DocumentSymbol(`Figure ${figIdx}. ${node.content}`, "", vscode.SymbolKind.Field, range, range));
            }
        }
        return symbols;
    }
}
