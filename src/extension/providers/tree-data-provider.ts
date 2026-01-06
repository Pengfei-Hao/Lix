import { Heap } from "../../foundation/heap";
import { visit } from "../../foundation/visit";
import { stateToString } from "../../parser/result";
import { Node } from "../../syntax-tree/node";
import { DocumentManager } from "../document-manager";
import * as vscode from 'vscode';
import { UITexts } from "../texts";

type InformationKind = "blocks" | "symbols";

class InformationRootItem extends vscode.TreeItem {
    constructor(public readonly kind: InformationKind) {
        super(kind === "blocks" ? "Blocks" : "Math Symbols", vscode.TreeItemCollapsibleState.Collapsed);
    }
}

export class InformationProvider implements vscode.TreeDataProvider<InformationRootItem | vscode.TreeItem> {

    onDidChangeTreeDataEmitter: vscode.EventEmitter<InformationRootItem | vscode.TreeItem | undefined>;
    onDidChangeTreeData;

    constructor(
        private documentManager: DocumentManager
    ) {
        this.onDidChangeTreeDataEmitter = new vscode.EventEmitter<InformationRootItem | vscode.TreeItem | undefined>();
        this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    }

    getChildren(element?: InformationRootItem | vscode.TreeItem): vscode.ProviderResult<(InformationRootItem | vscode.TreeItem)[]> {
        if (!element) {
            return [new InformationRootItem("blocks"), new InformationRootItem("symbols")];
        }

        const document = this.documentManager.validateDocument();
        if (!document) {
            return [];
        }

        if (element instanceof InformationRootItem) {
            const parser = this.documentManager.getParseResult(document);

            if (element.kind === "blocks") {
                const items: vscode.TreeItem[] = [];
                for (const blockName of parser.blockTable.handlers.keys()) {
                    items.push(new vscode.TreeItem(blockName, vscode.TreeItemCollapsibleState.None));
                }
                return items;
            }

            if (element.kind === "symbols") {
                const items: vscode.TreeItem[] = [];
                for (let notation of parser.mathModule.notations.keys()) {
                    const symbol = parser.mathModule.notationsToUnicodeSymbols.get(notation);
                    if (symbol) {
                        notation = `${notation} ${symbol}`;
                    }
                    items.push(new vscode.TreeItem(notation, vscode.TreeItemCollapsibleState.None));
                }
                return items;
            }
        }

        return [];
    }

    getTreeItem(element: InformationRootItem | vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }
}

export class StructureItem extends vscode.TreeItem {
    constructor(
        label: string,
        public readonly uri: vscode.Uri,
        public readonly range: vscode.Range,
        public readonly icon: string,
        public children: StructureItem[] = []
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(icon);
        this.command = {
            command: "vscode.open",
            title: "Goto",
            arguments: [uri,
                {
                    selection: range
                }
            ]
        };
        this.id = `${uri.toString()}-${label}`;
    }
}

export class StructureProvider implements vscode.TreeDataProvider<StructureItem> {

    onDidChangeTreeDataEmitter: vscode.EventEmitter<StructureItem | undefined>;
    onDidChangeTreeData;

    constructor(
        private documentManager: DocumentManager
    ) {
        this.onDidChangeTreeDataEmitter = new vscode.EventEmitter<StructureItem | undefined>();
        this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    }

    getChildren(element?: StructureItem | undefined): vscode.ProviderResult<StructureItem[]> {
        let document = this.documentManager.validateDocument();
        if (!document) {
            return [];
        }
        let structure = this.documentManager.getStructureData(document);
        return (element ? element.children : structure?.children) ?? [];
    }

    getTreeItem(element: StructureItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    static cacheTreeData(document: vscode.TextDocument, documentManager: DocumentManager): StructureItem {

        const parser = documentManager.getParseResult(document);
        const typeTable = documentManager.getTypeTable(document);

        const sectionType = typeTable.get("section");
        const subsectionType = typeTable.get("subsection");
        const subsubsectionType = typeTable.get("subsubsection");
        const bibliographyType = typeTable.get("bibliography");

        const titleType = typeTable.get("title");
        const authorType = typeTable.get("author");
        const dateType = typeTable.get("date");
        const tableofcontentsType = typeTable.get("tableofcontents");
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

        let symbols = new StructureItem("Document", document.uri, new vscode.Range(0, 0, 0, 0), "symbol-array");

        let secParent = symbols;
        let subParent = symbols;
        let subsubParent = symbols;
        let parent = symbols;

        const getWords = (node: Node) => node.children.filter(child => child.type === wordsType).map(child => child.content).join(" ");

        const getCaption = (node: Node) => {
            let captionNode = node.children.find(child => child.type === captionType);
            return captionNode ? getWords(captionNode) : "";
        };

        for (let node of parser.analysedTree.children) {
            const start = parser.getLineAndCharacter(node.begin);
            const end = parser.getLineAndCharacter(node.end);
            const range = new vscode.Range(start.line, start.character, end.line, end.character);
            if (node.type === sectionType) {
                secIdx++;
                subIdx = 0;
                subsubIdx = 0;
                let symbol = new StructureItem(`${secIdx} ${getWords(node)}`, document.uri, range, "symbol-array");
                subParent = symbol;
                subsubParent = symbol;
                parent = symbol;
                secParent.children.push(symbol);
            }
            if (node.type === subsectionType) {
                subIdx++;
                subsubIdx = 0;
                let symbol = new StructureItem(`${secIdx}.${subIdx} ${getWords(node)}`, document.uri, range, "symbol-array");
                subsubParent = symbol;
                parent = symbol;
                subParent.children.push(symbol);
            }
            if (node.type === subsubsectionType) {
                subsubIdx++;
                let symbol = new StructureItem(`${secIdx}.${subIdx}.${subsubIdx} ${getWords(node)}`, document.uri, range, "symbol-array");
                parent = symbol;
                symbols.children.push(symbol);
            }
            if (node.type === bibliographyType) {
                secIdx++;
                subIdx = 0;
                subsubIdx = 0;
                let symbol = new StructureItem(`Bibliography`, document.uri, range, "symbol-array");
                subParent = symbol;
                subsubParent = symbol;
                parent = symbol;
                symbols.children.push(symbol);
            }

            if (node.type === titleType) {
                parent.children.push(new StructureItem(`${getWords(node)}`, document.uri, range, "symbol-array"));
            }
            if (node.type === authorType) {
                parent.children.push(new StructureItem(`Author: ${getWords(node)}`, document.uri, range, "symbol-array"));
            }
            if (node.type === dateType) {
                parent.children.push(new StructureItem(`Date: ${getWords(node)}`, document.uri, range, "symbol-array"));
            }
            if (node.type === tableofcontentsType) {
                parent.children.push(new StructureItem(`Table of Contents`, document.uri, range, "symbol-array"));
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
                parent.children.push(new StructureItem(`${label} ${mathIdx} ${getWords(node)}`, document.uri, range, "symbol-array"));
            }

            if (node.type === paragraphType) {
                for (let parNode of node.children) {
                    const start = parser.getLineAndCharacter(parNode.begin);
                    const end = parser.getLineAndCharacter(parNode.end);
                    const range = new vscode.Range(start.line, start.character, end.line, end.character);

                    if (parNode.type === figureType) {
                        figIdx++;
                        parent.children.push(new StructureItem(`Figure ${figIdx} ${getCaption(parNode)}`, document.uri, range, "symbol-array"));
                    }
                    if (parNode.type === codeType) {
                        codeIdx++;
                        parent.children.push(new StructureItem(`Code ${codeIdx} ${getCaption(parNode)}`, document.uri, range, "symbol-array"));
                    }
                    if (parNode.type === listType) {
                        listIdx++;
                        parent.children.push(new StructureItem(`List ${listIdx} ${getCaption(parNode)}`, document.uri, range, "symbol-array"));
                    }
                    if (parNode.type === tableType) {
                        tableIdx++;
                        parent.children.push(new StructureItem(`Table ${tableIdx} ${getCaption(parNode)}`, document.uri, range, "symbol-array"));
                    }
                }
            }
        }

        visit(symbols, (node) => {
            node.collapsibleState = node.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        });

        return symbols;
    }
}

type StatusItemType = "action" | "generatorRoot" | "generatorOption";

class StatusItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: StatusItemType,
        command?: vscode.Command,
        description?: string
    ) {
        super(label, collapsibleState);
        this.command = command;
        this.description = description;
    }
}

export class StatusProvider implements vscode.TreeDataProvider<StatusItem> {

    onDidChangeTreeDataEmitter: vscode.EventEmitter<StatusItem | undefined>;
    onDidChangeTreeData;

    constructor(
        private documentManager: DocumentManager,
        private texts: UITexts
    ) {
        this.onDidChangeTreeDataEmitter = new vscode.EventEmitter<StatusItem | undefined>();
        this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    }

    getTreeItem(element: StatusItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: StatusItem | undefined): vscode.ProviderResult<StatusItem[]> {
        let document = this.documentManager.validateDocument();
        if (!document) {
            return [
            ];
        }
        let currentGenerator = this.documentManager.getGenerator(document);
        if (!element) {
            return [
                // this.getItem("Compile", "lix.compile", "run"),
                // this.getItem("Convert to Lix (AI)", "lix.convertFile", "file-pdf"),
                // this.getItem("Generate", "lix.generate", "file-code"),
                // this.getItem("Analyse", "lix.analyse", "list-tree"),
                // this.getItem("Parse", "lix.parse", "list-tree"),
                // this.getItem("Debug", "lix.debug", "bug"),
                this.getItem(this.texts.StatusViewInfomation.format(stateToString(this.documentManager.getParseResult(document).state, this.texts)), "info"),
                this.getGeneratorRootItem(currentGenerator)
            ];
        }

        if (element.type === "generatorRoot") {
            let allGenerators = this.documentManager.getGenerators(document);
            return allGenerators.map(generator => this.getGeneratorOption(generator, generator === currentGenerator));
        }

        return [];
    }

    private getItem(label: string, icon?: string): StatusItem {
        const item = new StatusItem(label, vscode.TreeItemCollapsibleState.None, "action");
        if (icon) {
            item.iconPath = new vscode.ThemeIcon(icon.replace("$(", "").replace(")", ""));
        }
        return item;
    }

    private getGeneratorRootItem(currentGenerator: string): StatusItem {
        const item = new StatusItem(this.texts.StatusViewGeneratorInformation.format(currentGenerator), vscode.TreeItemCollapsibleState.Expanded, "generatorRoot");
        item.iconPath = new vscode.ThemeIcon("settings-gear");
        return item;
    }

    private getGeneratorOption(generator: string, selected: boolean): StatusItem {
        const item = new StatusItem(generator, vscode.TreeItemCollapsibleState.None, "generatorOption");
        item.iconPath = selected ? new vscode.ThemeIcon("circle-filled") : new vscode.ThemeIcon("circle-outline");
        return item;
    }
}
