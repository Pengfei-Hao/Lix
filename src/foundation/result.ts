import { CodeLens } from "vscode";
import { Message } from "./message";
import { integer, State } from "vscode-languageclient";
import { stat } from "fs";

export type HighlightType = {begin: number, end: number, type: number};

export interface IResult<T> {
    //success: boolean;

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
    highlights: HighlightType[];
    //preIndex: number;
    state: ResultState;

    constructor(content: T, messages: Message[] = [], highlights: HighlightType[] = []) {
        this.state = ResultState.failing;
        this.content = content;
        this.messages = messages;
        this.highlights = highlights;
        //this.preIndex = preIndex;
    }

    get shouldTerminate(): boolean {
        return this.state === ResultState.failing || this.state === ResultState.matched;
    }

    get matched(): boolean {
        return this.state !== ResultState.failing;
    }

    get failed(): boolean {
        return this.state === ResultState.failing;
    }

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

    merge<R>(result: Result<R>): void {
        //this.success = this.success && result.success;
        this.mergeState(result.state);

        for(let msg of result.messages) {
            this.messages.push(msg);
        }
        for(let hlt of result.highlights) {
            this.highlights.push(hlt);
        }
    }
}

export class AnalyseResult implements IResult<AnalyseResult> {
    success: boolean;
    messages: Message[];
    highlights: HighlightType[];

    constructor(success: boolean, messages: Message[] = [], highlights: HighlightType[] = []) {
        this.success = success;
        this.messages = messages;
        this.highlights = highlights;
    }

    merge(result: AnalyseResult): void {
        this.success = this.success && result.success;
        for(let msg of result.messages) {
            this.messages.push(msg);
        }
        for(let hlt of result.highlights) {
            this.highlights.push(hlt);
        }
    }
}