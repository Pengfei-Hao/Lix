export enum MessageType {
    success,
    warning,
    error
}

export class Message {
    line: number;
    position: number;
    process: string[];

    type: MessageType;

    code: number;
    message: string;

    constructor(message: string, type: MessageType, code: number, line: number, position: number, process: string[]) {
        this.line = line;
        this.position = position;
        this.process = process;
        this.type = type;
        this.code = code;
        this.message = message;
    }


    toString(): string {
        let mes = "";
        switch(this.type) {
            case MessageType.success:
                mes += "Message: ";
                break;
            case MessageType.warning:
                mes += "Warning: ";
                break;
            case MessageType.error:
                mes += "Error: ";
                break;
        }

        mes += `(at line ${this.line + 1} position ${this.position + 1}) `;
        
        if(this.process.length == 0) {
            mes += `: [${this.code}] ${this.message}`;
        }
        else {
            mes += `${this.process[0]}`;
            for(let i = 1; i < this.process.length; i++) {
                mes += `->${this.process[i]}`;
            }
            mes += `: [${this.code}] ${this.message}`;
        }
        return mes;
    }
}

/*
type LinePositionGetter = () => {line: number, position: number} | undefined;

export class MessageList {

    messages: string[];
    swallowCount: number;

    getLP: LinePositionGetter;

    swallow() {
        this.swallowCount++;
    }

    realise() {
        this.swallowCount--;
    }

    begin(context: string) {
        this.contexts.push(context);
        
    }

    end() {
        this.contexts.pop();
    }

    send(message: string, type: MessageType, code: number = 0) {
        if(this.swallowCount == 0) {
            return;
        }
        let mes = "";
        switch(type) {
            case MessageType.success:
                mes += "Message: ";
                break;
            case MessageType.warning:
                mes += "Warning: ";
                break;
            case MessageType.error:
                mes += "Error: ";
                break;
        }

        let lp = this.getLP() ?? {line: -1, position: -1};
        mes += `(at line ${lp.line} position ${lp.position}) `;
        
        if(this.contexts.length == 0) {
            mes += `: [${code}] ${message}`;
        }
        else {
            mes += `${this.contexts[0]}`;
            for(let cont of this.contexts) {
                mes += `->${cont}`;
            }
            mes += `: [${code}] ${message}`;
        }
        this.messages.push(mes);
    }

    constructor(linePosition: LinePositionGetter) {
        this.messages = [];
        this.contexts = [];
        this.getLP = linePosition;
        this.swallowCount = 0;
    }

    /*
    static makeSuccess<T>(content: T, message?: string): Result<T> {
        let result = new Result(true, content);
        result.failed = false;
        if(message) {
            result.messages.push(new Message(message, MessageType.success));
        }
        return result;
    }

    static makeWarning<T>(content: T, message: string): Result<T> {
        let result = new Result(true, content);
        result.failed = false;
        result.messages.push(new Message(message, MessageType.warning));
        return result;
    }

    static makeError<T>(content: T, message: string): Result<T> {
        let result = new Result(false, content);
        result.failed = true;
        result.messages.push(new Message(message, MessageType.error));
        result.messages = [];
        return result;
    }

    private static merge<T>(prev: Result<T>, result: Result<T>) {
        result.failed = prev.failed || result.failed;
        result.success = !result.failed;
        result.messages = prev.messages.concat(result.messages);
    }

    static makeSuccessWith<T>(prev: Result<T>, content: T, message?: string): Result<T> {
        let result = this.makeSuccess(content, message);
        this.merge(prev, result);
        return result;
    }

    static makeWarningWith<T>(prev: Result<T>, content: T, message: string): Result<T> {
        let result = this.makeWarning(content, message);
        this.merge(prev, result);
        return result;
    }

    static makeErrorWith<T>(prev: Result<T>, content: T, message: string): Result<T> {
        let result = this.makeError(content, message);
        this.merge(prev, result);
        return result;
    }
    
}
*/