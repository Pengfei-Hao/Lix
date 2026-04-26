import { AddOnlyList } from "../../foundation/add-only-list";
import { Range } from "../source-text";

export enum HighlightType {
    operator,
    keyword,
    variable,
    string,
    comment,
    number
}

export class Highlight {

    constructor(
        public readonly range: Range,
        public readonly type: HighlightType
    ) {
    }
}

export class HighlightList implements AddOnlyList<Highlight> {

    private rawHighlights: Highlight[];

    constructor() {
        this.rawHighlights = [];
    }

    public get items(): readonly Highlight[] {
        return this.rawHighlights;
    }

    push(...highlights: Highlight[]) {
        this.rawHighlights.push(...highlights);
    }

    add(type: HighlightType, range: Range): void {
        this.rawHighlights.push(new Highlight(range, type));
    }
}