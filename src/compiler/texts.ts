import { ParserTexts as ParserTexts } from "../parser/texts";
import { GeneratorTexts as GeneratorTexts } from "../generator/texts";

export type CompilerTexts = {};

// export interface CompilerTextBundle {
//     parserTexts: ParserTexts;
//     generatorTexts: GeneratorTexts;
//     compilerTexts: CompilerTexts;
// }

export const compilerExceptionTexts = {
    GeneratorAlreadyExists: "Generator '${0}' is already registered.",
    GeneratorNotExist: "Generator '${0}' does not exist."
} as const;