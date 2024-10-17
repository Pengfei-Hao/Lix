export class Heap<T> {
    protected items: Array<T>;

    constructor() {
        this.items = new Array();
    }

    push(item: T) {
        this.items.push(item);
    }

    pop(): T | undefined {
        return this.items.pop();
    }

    top(): T | undefined {
        return this.items.at(-1);
    }

    
    public get length() : number {
        return this.items.length;
    }
    
    
}