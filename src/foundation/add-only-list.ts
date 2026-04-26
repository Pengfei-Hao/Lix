
export interface AddOnlyList<T> {

    get items(): readonly T[];

    push(...items: T[]): void;
}