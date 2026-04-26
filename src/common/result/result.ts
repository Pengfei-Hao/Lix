import { MessageList } from "./message";
import { error } from "../../foundation/error";
import { commonExceptionTexts } from "../texts";

export enum ResultState {
    successful = 3,
    skippable = 2,
    matched = 1,
    failing = 0
}

export abstract class Result {

    // state
    private rawState: ResultState;

    // promote
    private promotedToMatched: boolean;

    // environment
    public readonly messageList: MessageList;


    constructor() {
        this.rawState = ResultState.successful;
        this.promotedToMatched = false;
        this.messageList = new MessageList();
    }

    // **************** State ****************

    get state(): ResultState {
        return this.rawState;
    }

    get shouldStop(): boolean {
        if (this.promotedToMatched) {
            if (this.rawState === ResultState.failing) {
                error(commonExceptionTexts.ResultShouldTerminateLogicError);
            }
            return this.rawState === ResultState.matched;
        }
        else {
            if (this.rawState === ResultState.matched) {
                error(commonExceptionTexts.ResultShouldTerminateLogicError);
            }
            return this.rawState === ResultState.failing;
        }

    }

    get matched(): boolean {
        return this.rawState !== ResultState.failing;
    }

    get failed(): boolean {
        return this.rawState === ResultState.failing;
    }

    ensureMatched() {
        this.promotedToMatched = true;
        if (this.rawState === ResultState.failing) {
            this.rawState = ResultState.matched;
        }
    }

    // state
    private mergeState(state: ResultState) {
        // successful = 3,
        // skippable = 2,
        // matched = 1,
        // failing = 0
        if (this.promotedToMatched) {
            const table = [[-1, -1, -1, -1], [1, 1, 2, 3], [1, 1, 2, 2], [1, 1, 2, 3]]
            let res = table[this.rawState][state];
            if (res === -1) {
                error(commonExceptionTexts.ResultMergeLogicError);
            }
            else {
                this.rawState = res;
            }
        }
        else {
            const table = [[0, 0, 2, 3], [-1, -1, -1, -1], [0, 0, 2, 2], [0, 0, 2, 3]]
            let res = table[this.rawState][state];
            if (res === -1) {
                error(commonExceptionTexts.ResultMergeLogicError);
            }
            else {
                this.rawState = res;
            }
        }
    }

    recoverToSkippable() {
        if (this.promotedToMatched) {
            if (this.rawState !== ResultState.matched) {
                error(commonExceptionTexts.ResultPromoteLogicError);
            }
            this.rawState = ResultState.skippable;
        }
        else {
            if (this.rawState !== ResultState.failing) {
                error(commonExceptionTexts.ResultPromoteLogicError);
            }
            this.rawState = ResultState.skippable;
        }

    }

    mergeSuccessfulState() {
        this.mergeState(ResultState.successful);
    }

    mergeFailedState() {
        this.mergeState(ResultState.failing);
    }

    // **************** Merge ****************

    // state + environment
    merge<T extends Result>(result: T): T {
        this.mergeState(result.rawState);
        this.messageList.push(...result.messageList.items);
        return result;
    }
}