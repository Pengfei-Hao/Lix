import "./format";

// **************** Language Related Text ****************

export type ParserText = {
    ArgumentCommaMissing: string;
    ArgumentEnumerationValueInvalid: string;
    ArgumentTypeMismatch: string;
    ArgumentUnknown: string;
    ArgumentUnrecognized: string;
    ArgumentValueMissing: string;
    ArgumentsEndedUnexpectedly: string;
    BlockClosingBracketMissing: string;
    BibliographyDisallowsOtherBlocks: string;
    BibliographyDisallowsText: string;
    CodeBlockEndedUnexpectedly: string;
    CodeBlockHeaderRequiresNewline: string;
    DocumentRequiresStructuralBlocks: string;
    EscapeSequenceIncomplete: string;
    ExpressionMissingLastTerm: string;
    FigureDisallowsOtherBlocks: string;
    FigureDisallowsText: string;
    FormatDisallowsLineBreakEscape: string;
    FormatDisallowsNestedBlocks: string;
    FormulaInlineTextEndedUnexpectedly: string;
    FormulaMissingBacktick: string;
    FormulaMissingRightBracket: string;
    FormulaUnrecognizedCharacter: string;
    InlineCodeEndedUnexpectedly: string;
    InlineFormulaMissingClosingSlash: string;
    InlineMathAtMustFollowElement: string;
    InlineMathBackslashMustFollowElement: string;
    InvalidEscapeSequence: string;
    InfixOperatorPatternInvalid: string;
    InfixOperatorRepeated: string;
    ListDisallowsOtherBlocks: string;
    MultilineCommentEndedUnexpectedly: string;
    ParagraphDisallowsOtherBlocks: string;
    PrefixElementEndedUnexpectedly: string;
    PrefixElementMatchFailed: string;
    PrefixTermMatchFailed: string;
    ReferenceDuplicated: string;
    ReferenceNameMissing: string;
    ReferencesNotAllowedInBlock: string;
    SettingColonMissing: string;
    SettingNameMissing: string;
    StringEndedUnexpectedly: string;
    StringNewlineForbidden: string;
    TableDisallowsOtherBlocks: string;
    TextDisallowsLineBreakEscape: string;
    TextDisallowsNonFormatBlocks: string;
    UnknownArgumentImplicitValue: string;
    UnknownArgumentImplicitValueNotUnique: string;
    InlineFormatCannotContainBlock: string;
};

export type GeneratorText = {};

export type VscodeText = {
    DirectoryCreateFailed: string;
    DirectoryReadFailed: string;
    FileCopyFailed: string;
    FileReadFailed: string;
    FileWriteFailed: string;
};

type TextBundle = {
    Parser: ParserText;
    Generator: GeneratorText;
    Vscode: VscodeText;
};

type I18nConfig = {
    "zh-CN": TextBundle;
    "en-US": TextBundle;
};

const languages = new Set(["en-US", "zh-CN"]);

function getTextBundle<K extends keyof TextBundle>(json: string, key: K, language = "en-US"): TextBundle[K] {
    const lang = languages.has(language) ? language : "en-US";
    return JSON.parse(json)[lang as keyof I18nConfig][key];
}

export const getParserText = (json: string, language?: string) => getTextBundle(json, "Parser", language);
export const getGeneratorText = (json: string, language?: string) => getTextBundle(json, "Generator", language);
export const getVscodeText = (json: string, language?: string) => getTextBundle(json, "Vscode", language);

// **************** Exception Text ****************

export const exceptionText = {
    ArgumentHasNoValue: "Argument '${0}' has no value.",
    ArgumentNotFound: "Argument not found.",
    BlockHandlerAlreadyExists: "Block handler '${0}' is already registered.",
    GetIndexOutOfBounds: "getIndex: line or character out of bounds.",
    GetLineAndCharacterOutOfBounds: "getLineAndCharacter: index out of bounds.",
    IndexOutOfBoundsInclusive: "Index out of bounds [0, length].",
    IndexOutOfBoundsExclusive: "Index out of bounds [0, length).",
    InsertionHandlerAlreadyExists: "Insertion handler '${0}' is already registered.",
    LogicalAnalyseFormulaFailed: "Logical error: analysing formula.",
    LogicalAnalyseSubformulaFailed: "Logical error: analysing subformula.",
    LogicalFreeCellBranch: "Logical error: unexpected branch while parsing free cell.",
    LogicalFreeListBranch: "Logical error: unexpected branch while parsing free list item.",
    LogicalFreeParagraphBranch: "Logical error: unexpected branch while parsing free paragraph.",
    LogicalMatchDocumentFailed: "Logical error: failed to match paragraph, setting, or block.",
    LogicalMatchListItemFailed: "Logical error: failed to match list item or free item.",
    LogicalMatchTableCellFailed: "Logical error: failed to match table cell or free cell.",
    LogicalParagraphBlockBranch: "Logical error: unexpected branch while parsing paragraph block.",
    PrefixOperatorTypeInvalid: "Invalid prefix operator type.",
    ResultMergeLogicError: "Logical error in Result.merge.",
    ResultPromoteLogicError: "Logical error in Result.promote.",
    ResultShouldTerminateLogicError: "Logical error in Result.shouldTerminate.",
    TypeAlreadyExists: "Type '${0}' is already registered.",
    TypeNotExist: "Type '${0}' does not exist."
} as const;

// export type ExceptionKey = keyof typeof exceptionMessages;
