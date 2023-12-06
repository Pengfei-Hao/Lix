import { TextDocument, Uri } from "vscode";
import { Parser } from "../parser/parser";
import { Config } from "../foundation/config";
import { Message } from "../foundation/message";
import { Node } from "../sytnax-tree/node";

export class Context {

    parsers: Map<TextDocument, Parser>;
    messageLists: Map<TextDocument, Message[]>;
    syntaxTrees: Map<TextDocument, Node>;
    config: Config; 

    constructor(config: Config) {
        this.parsers = new Map();
        this.config = config;
        this.messageLists = new Map();
        this.syntaxTrees = new Map();
    }

    getParser(document: TextDocument): Parser {
        let res = this.parsers.get(document);
        if(res == undefined) {
            let newp = new Parser("", this.config);
            this.parsers.set(document, newp);
            return newp;
        }
        else {
            return res;
        }
    }

    parser(document: TextDocument) {
        console.log(`Document '${document.fileName}' parsered.`);
        let parser = this.getParser(document);
	    parser.parse(document.getText());
        this.syntaxTrees.set(document, parser.syntaxTree);
        this.messageLists.set(document, parser.messageList);

    }
}