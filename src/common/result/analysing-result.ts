import { HighlightList } from "./highlight";
import { Result } from "./result";

export class ValueResult<T> extends Result {

    // content
    public readonly highlightList: HighlightList;

    value: T;

    constructor(value: T) {
        super();

        this.highlightList = new HighlightList();

        this.value = value;
    }


    override merge<T extends Result>(result: T): T {
        super.merge(result);
        if (result instanceof ValueResult) {
            this.highlightList.push(...result.highlightList.items);
        }
        return result;
    }
}