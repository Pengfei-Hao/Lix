import { Node } from "../sytnax-tree/node";
import { Message } from "./message";

export enum HighlightType {
    operator,
    keyword,
    variable,
    string,
    comment,
    number
};

export class Highlight {
    begin: number;
    end: number;

    type: HighlightType;

    constructor(begin: number, end: number, type: HighlightType) {
        this.begin = begin;
        this.end = end;
        this.type = type;
    }
}

// export enum ReferenceType {
//     formula,
//     bibliography,
//     default
// }

export class Reference {
    name: string;
    // type: ReferenceType;
    node: Node;

    constructor(name: string, node: Node) {
        this.name = name;
        this.node = node;
    }
}

export interface IResult<T> {
    merge(result: T): void;
}

export enum ResultState {
successful = 3,
skippable = 2,
matched = 1,
failing = 0
}

export class Result<T> {
    content: T;
    messages: Message[];
    highlights: Highlight[];
    state: ResultState;

    discarded: boolean;
    analysedContent: T;
    references: Reference[];

    private promotedToMatched: boolean;

    constructor(content: T, analysedContent: T, messages: Message[] = [], highlights: Highlight[] = [], discarded = false, references: Reference[] = []) {
        this.state = ResultState.failing;
        this.content = content;
        this.analysedContent = analysedContent;
        this.messages = messages;
        this.highlights = highlights;
        this.discarded = discarded;
        this.promotedToMatched = false;
        this.references = references;
    }

    get shouldTerminate(): boolean {
        if(this.promotedToMatched) {
            if(this.state === ResultState.failing) {
                console.log("result.shouldTerminate has logic error");
            }
            return this.state === ResultState.matched;
        }
        else {
            if(this.state === ResultState.matched) {
                console.log("result.shouldTerminate has logic error");
            }
            return this.state === ResultState.failing;
        }
        
    }

    get matched(): boolean {
        return this.state !== ResultState.failing;
    }

    get failed(): boolean {
        return this.state === ResultState.failing;
    }

    get succeeded(): boolean {
        return this.state === ResultState.successful;
    }

    promoteToSkippable() {
        if(this.promotedToMatched) {
            if(this.state !== ResultState.matched) {
                console.log("result.promote has logic error");
            }
            this.state = ResultState.skippable;
        }
        else {
            if(this.state !== ResultState.failing) {
                console.log("result.promote has logic error");
            }
            this.state = ResultState.skippable;
        }
        
    }

    GuaranteeMatched() {
        this.promotedToMatched = true;
        if(this.state === ResultState.failing) {
            this.state = ResultState.matched;
            //console.log("guarantee");
        }
    }

    mergeState(state: ResultState) {
        // successful = 3,
        // skippable = 2,
        // matched = 1,
        // failing = 0
        if (this.promotedToMatched) {
            const table = [[-1, -1, -1, -1], [1, 1, 2, 3], [1, 1, 2, 2], [1, 1, 2, 3]]
            let res = table[this.state][state];
            if (res === -1) {
                console.log("result.merge has logic error");
                return;
            }
            else {
                this.state = res;
            }
        }
        else {
            const table = [[0, 0, 2, 3], [-1, -1, -1, -1], [0, 0, 2, 2], [0, 0, 2, 3]]
            let res = table[this.state][state];
            if (res === -1) {
                console.log("result.merge has logic error");
                return;
            }
            else {
                this.state = res;
            }
        }
    }

    merge<R>(result: Result<R>): void {
        this.mergeState(result.state);

        for(let msg of result.messages) {
            this.messages.push(msg);
        }
        for(let hlt of result.highlights) {
            this.highlights.push(hlt);
        }
        for(let ref of result.references) {
            this.references.push(ref);
        }
    }

}