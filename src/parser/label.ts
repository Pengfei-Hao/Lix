import { Node, Type } from "./AST";
import { matchEquation } from "./math";
import { matchParagraphInside } from "./parser";

export class MatchResult {
    constructor(public success: boolean,
        public node: Node) {
    }
}
export type MatchFunction = () => MatchResult;

export function init() {
    add("title", matchParagraphInside);
    add("author", matchParagraphInside);
    add("section", matchParagraphInside);
    add("subsection", matchParagraphInside);
    add("_1", matchParagraphInside);
    add("equation", matchEquation);
    add("$", matchEquation);
}

let labels: Map<string, MatchFunction> = new Map();

export function has(name: string): boolean {
    return labels.get(name) != undefined;
}

export function add(name: string, match: MatchFunction): boolean {
    if(has(name)) {
        return false;
    }
    labels.set(name, match);
    return true;
}

export function getMatchFunction(name: string): MatchFunction | undefined {
    return labels.get(name);
}

export function getLabelAndMatch(name: string): MatchResult {
    let match = labels.get(name);
    if(match != undefined) {
        return match();
    }
    else {
        return new MatchResult(false, new Node(Type.label, "[[[Label name cannot be found.]]]"));
    }
}