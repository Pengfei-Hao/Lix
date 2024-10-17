import { TextDocument, Uri } from "vscode";
import { Parser } from "../parser/parser";
import { Config } from "../foundation/config";
import { Message } from "../foundation/message";
import { Node } from "../sytnax-tree/node";
import { HighlightType, ResultState } from "../foundation/result";

export class LixContext {

    parsers: Map<TextDocument, Parser>;
    //messageLists: Map<TextDocument, Message[]>;
    //syntaxTrees: Map<TextDocument, Node>;
    //highlights: Map<TextDocument, HighlightType[]>;
    //success: Map<TextDocument, boolean>;
    //state: Map<TextDocument, ResultState>;
    config: Config; 

    constructor(config: Config) {
        this.parsers = new Map();
        this.config = config;
        // this.messageLists = new Map();
        // this.syntaxTrees = new Map();
        // this.highlights = new Map();
        // this.success = new Map();
        // this.state = new Map();
    }

    getParser(document: TextDocument): Parser {
        let res = this.parsers.get(document);
        if(res == undefined) {
            let newp = new Parser(this.config);
            this.parsers.set(document, newp);
            return newp;
        }
        else {
            return res;
        }
    }

    /*

    parse(document: TextDocument) {
        let parser = this.getParser(document);
	    parser.parse(document.getText());
        // this.syntaxTrees.set(document, parser.syntaxTree);
        // this.messageLists.set(document, parser.messageList);
        // this.highlights.set(document, parser.highlights);
        // //this.success.set(document, parser.success);
        // this.state.set(document, parser.state);
    }
        */
}