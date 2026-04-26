import { Config } from "../../common/config";
import { Path } from "../../common/file-system/path";
import { SourceText } from "../../common/source-text";
import { TypeTable } from "../../common/syntax-tree/type-table";
import { ParserTexts } from "../texts";

export abstract class Module {

    constructor(
        protected config: Config,
        protected path: Path,
        protected texts: ParserTexts,

        protected typeTable: TypeTable,
        protected sourceText: SourceText
    ) {
    }

    abstract init(): void;
}