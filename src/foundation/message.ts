export enum MessageType {
    message,
    warning,
    error
}

export class Message {
    line: number;
    character: number;
    process: string[];

    type: MessageType;

    code: number;
    message: string;

    constructor(message: string, type: MessageType, code: number, line: number, character: number, process: string[]) {
        this.line = line;
        this.character = character;
        this.process = process;
        this.type = type;
        this.code = code;
        this.message = message;
    }


    toString(showType: boolean = false, showPosition: boolean = false, showStack: boolean = false, showCode: boolean = false): string {
        let msg = "";
        if(showType) {
            switch(this.type) {
                case MessageType.message:
                    msg += "Message: ";
                    break;
                case MessageType.warning:
                    msg += "Warning: ";
                    break;
                case MessageType.error:
                    msg += "Error: ";
                    break;
            }
        }
        if (showCode) {
            msg += `[${this.code}] `;
        }
        if (showPosition) {
            msg += `(at line ${this.line + 1} character ${this.character + 1}) `;
        }

        if(showStack) {
            msg += `[`;
            if (this.process.length !== 0) {
                msg += `${this.process[0]}`;
                for (let i = 1; i < this.process.length; i++) {
                    msg += `>>${this.process[i]}`;
                }
            }
            msg += `] `;
        }

        msg += `${this.message}`;
        return msg;
    }
}