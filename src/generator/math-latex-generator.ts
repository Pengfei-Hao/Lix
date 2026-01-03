import { Compiler } from "../compiler/compiler";
import { Config } from "../compiler/config";
import { FileSystem } from "../compiler/file-system";
import { Reference } from "../parser/result";
import { Node } from "../sytnax-tree/node";
import { Type } from "../sytnax-tree/type";
import { TypeTable } from "../sytnax-tree/type-table";
import { Generator } from "./generator";

export class MathLatexGenerator extends Generator {

    // Math Module

    formulaType: Type;
    elementType: Type;
    inlineTextType: Type;
    infixType: Type;
    prefixType: Type;
    matrixType: Type;

    // Map from formula to latex
    latexSymbolsAndNotations: Map<string, string>;
    latexOperator: Map<string, string>;

    json: {
        SymbolsAndNotations: [string, string],
        Operators: [string, string],
        Newline: string,
        InlineText: string,
        DefaultElement: string,
        MatrixColumnSeparator: string,
        MatrixRowSeparator: string,
        DefaultPrefixOperator: string,
        DefaultInfixOperator: string,
        Default: string
    }

    constructor(compiler: Compiler) {
        super(compiler);

        this.formulaType = this.typeTable.get("formula");
        this.elementType = this.typeTable.get("element");
        this.inlineTextType = this.typeTable.get("inline-text");
        this.infixType = this.typeTable.get("infix");
        this.prefixType = this.typeTable.get("prefix");
        this.matrixType = this.typeTable.get("matrix");

        this.latexSymbolsAndNotations = new Map();
        this.latexOperator = new Map();
        this.json = JSON.parse(this.config.get("formula-latex"));
        for (let [key, value] of this.json.SymbolsAndNotations) {
            this.latexSymbolsAndNotations.set(key, value);
        }
        for (let [key, value] of this.json.Operators) {
            this.latexOperator.set(key, value);
        }
    }

    init(): void  {
        this.output = "";
    }

    // 此处不作正确性检查, 请确保输入的语法树是 parser 生成的
    generate(syntaxTree: Node, references: Reference[]): void {
        this.init();

        this.output = this.generateTermOrOperator(syntaxTree.children.at(-1)!);
    }

    // 此处不作正确性检查, 请确保输入的语法树是 parser 生成的
    generateSingleline(syntaxTree: Node, references: Reference[]): void {
        this.init();

        this.output = this.generateTermOrOperator(syntaxTree.children.at(-1)!);
    }

    // **************** Math Module ****************

    // 生成的 Latex 保证为 Latex 中的一项或多项
    generateTermOrOperator(node: Node): string {
        let code: string | undefined;
        switch (node.type) {
            case this.inlineTextType:
                return this.json.InlineText.format(node.content);

            case this.elementType:
                return this.latexSymbolsAndNotations.get(node.content) ?? this.json.DefaultElement;

            case this.matrixType:
                let res = "";
                let newRow = false;
                for (let rowNode of node.children) {
                    if (newRow) {
                        res += this.json.MatrixRowSeparator;
                    }
                    newRow = true;

                    let newColumn = false;
                    for (let columnNode of rowNode.children) {
                        if (newColumn) {
                            res += this.json.MatrixColumnSeparator;
                        }
                        newColumn = true;
                        res += this.generateTermOrOperator(columnNode);
                    }
                }
                return res;

            case this.prefixType:
                code = this.latexOperator.get(node.content);
                if (code === undefined) {
                    return this.json.DefaultPrefixOperator;
                }
                let nCode: string[] = [];
                node.children.forEach(subNode => nCode.push(this.generateTermOrOperator(subNode)));
                return code.formatWithAutoBlank(...nCode);

            case this.infixType:
                code = this.latexOperator.get(node.content);
                if (code === undefined) {
                    return this.json.DefaultInfixOperator;
                }

                if (node.content === "") {
                    let res = code;
                    for (let subNode of node.children) {
                        res = res.formatWithAutoBlank(this.generateTermOrOperator(subNode) + code);
                    }
                    res = res.format("");
                    return res;
                }
                else {
                    let nCode: string[] = [];
                    node.children.forEach(subNode => nCode.push(this.generateTermOrOperator(subNode)));
                    return code.formatWithAutoBlank(...nCode);
                }
        }
        return this.json.Default;
    }
}