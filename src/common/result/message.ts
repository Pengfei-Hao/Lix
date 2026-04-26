import { AddOnlyList } from "../../foundation/add-only-list";
import { Range } from "../source-text";
import { messageStringifyTexts } from "../texts";

export enum MessageType {
    message,
    warning,
    error
}

export class Message {

    constructor(
        public readonly message: string,
        public readonly range: Range,
        public readonly type: MessageType,
        public readonly code: number,
        public readonly process: readonly string[]
    ) {
    }

    toString(showType: boolean = true, showPosition: boolean = true, showStack: boolean = true, showCode: boolean = true): string {

        let code = "";
        let position = "";
        let type = "";
        let stack = "";

        if (showCode) {
            code = messageStringifyTexts.Code.format(this.code);
        }
        if (showType) {
            switch (this.type) {
                case MessageType.message:
                    type = messageStringifyTexts.TypeMessage;
                    break;
                case MessageType.warning:
                    type = messageStringifyTexts.TypeWarning;
                    break;
                case MessageType.error:
                    type = messageStringifyTexts.TypeError;
                    break;
            }
        }
        if (showPosition) {
            position = messageStringifyTexts.Position.format(this.range.begin.value, this.range.end.value);
        }
        if (showStack) {
            let process = "";
            if (this.process.length !== 0) {
                process += `${this.process[0]}`;
                for (let i = 1; i < this.process.length; i++) {
                    process += `${messageStringifyTexts.StackSeparator}${this.process[i]}`;
                }
            }
            stack = messageStringifyTexts.Stack.format(process);
        }
        return messageStringifyTexts.Template.format({ message: this.message, code: code, position: position, type: type, stack: stack });
    }
}

export class MessageList implements AddOnlyList<Message> {

    private rawMessages: Message[];

    constructor() {
        this.rawMessages = [];
    }

    public get items(): readonly Message[] {
        return this.rawMessages;
    }

    push(...messages: Message[]) {
        this.rawMessages.push(...messages);
    }

    add(message: string, range: Range, type: MessageType, code: number = 0, process: string[] = []): void {
        this.rawMessages.push(new Message(message, range, type, code, process));
    }
}
