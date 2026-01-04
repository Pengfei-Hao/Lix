
export type SyntaxTreeTexts = {};

// export interface SyntaxTreeTextBundle {
//     syntaxTreeTexts: SyntaxTreeTexts;
// }

export const syntaxTreeExceptionTexts = {
    TypeAlreadyExists: "Type '${0}' is already registered.",
    TypeNotExist: "Type '${0}' does not exist."
} as const;