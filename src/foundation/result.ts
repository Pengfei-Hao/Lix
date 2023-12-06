import { CodeLens } from "vscode";
import { Message } from "./message";


export class Result<T> {
    success: boolean;
    content: T;
    messages: Message[];

    constructor(success: boolean, content: T, messages: Message[]) {
        this.success = success;
        this.content = content;
        this.messages = messages;
    }
}