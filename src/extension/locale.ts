import "../foundation/format";
import { ParserTexts } from "../parser/texts";
import { GeneratorTexts } from "../generator/texts";
import { NodePathTexts, UITexts, VSCodeFileSystemTexts } from "./texts";
import { CompilerTexts } from "../compiler/texts";
import { SyntaxTreeTexts } from "../syntax-tree/texts";

export type Texts = {

    // Extension texts
    NodePath: NodePathTexts;
    VSCodeFileSystem: VSCodeFileSystemTexts;

    // Parser texts
    Parser: ParserTexts;

    // Generator texts
    Generator: GeneratorTexts;

    // Compiler texts
    Compiler: CompilerTexts;

    // Syntax tree texts
    SyntaxTree: SyntaxTreeTexts;

    // UI texts
    UI: UITexts;
}

const locales = new Set(["en-US", "zh-CN"]);

export function loadTexts(json: string, locale: string): Texts {
    locale = locales.has(locale) ? locale : "en-US";
    return JSON.parse(json)[locale];
}