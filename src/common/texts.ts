
export type CommonTexts = {};

export const commonExceptionTexts = {
    GetIndexOutOfBounds: "getIndex: line or character out of bounds.",
    GetPositionOutOfBounds: "getLineAndCharacter: index out of bounds.",
    IndexOutOfBoundsInclusive: "Index out of bounds [0, length].",
    IndexOutOfBoundsExclusive: "Index out of bounds [0, length).",
    ResultMergeLogicError: "Logical error in Result.merge.",
    ResultPromoteLogicError: "Logical error in Result.promote.",
    ResultShouldTerminateLogicError: "Logical error in Result.shouldTerminate.",
    TypeAlreadyExists: "Type '${0}' is already registered.",
    TypeNotExist: "Type '${0}' does not exist."
} as const;

export const nodeStringifyTexts = {
    Template: '${space}${type}: "${content}", range: [${begin}, ${end})',
    Space: '\t',
    Newline: '\n',
    ContentNewline: '\\n'
} as const;

export const messageStringifyTexts = {
    Template: '${code}${type}${message}${position}${stack}',
    TypeMessage: "Message: ",
    TypeWarning: "Warning: ",
    TypeError: "Error: ",
    Code: '[${0}] ',
    Position: ' in [${0}, ${1})',
    Stack: '\n  when processing ${0}',
    StackSeparator: ' >> '
} as const;