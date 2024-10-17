import { CodeLens } from "vscode";
import { Message } from "./message";
import { integer, State } from "vscode-languageclient";
import { stat } from "fs";

export enum HighlightType {
    operator,
    keyword,
    variable,
    string,
    comment
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

export interface IResult<T> {
    merge(result: T): void;
}

export enum ResultState {
successful = 3,
skippable = 2,
matched = 1,
failing = 0
}

export class Result<T> implements IResult<Result<T>> {
    content: T;
    messages: Message[];
    highlights: Highlight[];
    state: ResultState;

    private promotedToMatched: boolean;

    constructor(content: T, messages: Message[] = [], highlights: Highlight[] = []) {
        this.state = ResultState.failing;
        this.content = content;
        this.messages = messages;
        this.highlights = highlights;
        this.promotedToMatched = false;
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

    promote(state: ResultState) {
        if(this.state === ResultState.failing && (state === ResultState.matched || state === ResultState.skippable)) {
            this.state = state;
            return;
        }
        console.log("result.promote has logic error");
    }

    promoteToSkippable() {
        if(this.state === ResultState.failing) {
            this.state = ResultState.skippable;
            return;
        }
        console.log("result.promote has logic error");
    }

    GuaranteeMatched() {
        this.promotedToMatched = true;
    }

    mergeState(state: ResultState) {
        switch(this.state) {
            case ResultState.skippable:
                switch(state) {
                    case ResultState.successful:
                    case ResultState.skippable:
                        this.state = ResultState.skippable;
                        break;
                    case ResultState.matched:
                    case ResultState.failing:
                        this.state = ResultState.failing;
                        break;
                }
                break;
            case ResultState.successful:
            case ResultState.failing:
                switch(state) {
                    case ResultState.matched:
                        this.state = ResultState.failing;
                        break;
                    default:
                        this.state = state;
                        break;
                }
                break;
            case ResultState.matched:
                console.log("result.merge has logic error");
                return;
        }
        if(this.promotedToMatched && this.state === ResultState.failing) {
            this.state = ResultState.matched;
        }
    }

    /*
    mergeState(state: ResultState) {
        switch(this.state) {
            case ResultState.successful:
                switch(state) {
                    case ResultState.successful:
                        this.state = ResultState.successful;
                        break;
                    case ResultState.skippable:
                        this.state = ResultState.skippable;
                        break;
                    case ResultState.matched:
                    case ResultState.failing:
                        this.state = ResultState.matched;
                        break;
                }
                break;
            case ResultState.skippable:
                switch(state) {
                    case ResultState.successful:
                    case ResultState.skippable:
                        this.state = ResultState.skippable;
                        break;
                    case ResultState.matched:
                    case ResultState.failing:
                        this.state = ResultState.matched;
                        break;
                }
                break;
            case ResultState.failing:
                this.state = state;
                break;
            case ResultState.matched:
                switch(state) {
                    case ResultState.skippable:
                        this.state = ResultState.skippable;
                        break;
                    default:
                        console.log("result.merge has logic error");
                        break;
                }
                break;
        }
    }
    */

    merge<R>(result: Result<R>): void {
        this.mergeState(result.state);

        for(let msg of result.messages) {
            this.messages.push(msg);
        }
        for(let hlt of result.highlights) {
            this.highlights.push(hlt);
        }
    }


}

/*
export class AnalyseResult extends Result<null> {
    constructor(messages: Message[] = [], highlights: Highlight[] = []) {
        super(null, messages, highlights);
        //this.preIndex = preIndex;
    }
}
    */

// export class AnalyseResult implements IResult<AnalyseResult> {
//     success: boolean;
//     messages: Message[];
//     highlights: HighlightType[];

//     constructor(success: boolean, messages: Message[] = [], highlights: HighlightType[] = []) {
//         this.success = success;
//         this.messages = messages;
//         this.highlights = highlights;
//     }

//     merge(result: AnalyseResult): void {
//         this.success = this.success && result.success;
//         for(let msg of result.messages) {
//             this.messages.push(msg);
//         }
//         for(let hlt of result.highlights) {
//             this.highlights.push(hlt);
//         }
//     }
// }