
var text: string = "";
var formattedText: string = "";

var introduction: string = "";
var document: string = "";

var index: number = 0;

export function initParser(source: string) {
    text = source;
    formattedText = "";
    introduction = "";
    document = "";
}

export function exportLatex(): string {
    return `\\documentclass{article}\n${introduction}\n\\begin{document}\n${document}\n\\end{document}`;
}

export function parse() {
    //initParser("line1 .// a中文bc \nline2 ... /* aaa \nline3*  / xxx */\n\nline4 // abc\nlint5/* aa中文 */");
    
    //initParser("  #paper : a4\n\n #size\t: 500\nline1   is  [bold a] nt r \nline 2\n \t \t [LiX] is [delete very]   good.\t\n   \t\n   \n\t\n line3 [emph[bold comes]].\n\n */");

    //initParser("#paper:a4\n [title LiX Document]\n\n[author Mateo Hao]\n\n [date 2023.4.22]\n\n[section Introduction]\n\n This is a short Introduction to LiX.\n");

    
    // 统一行尾
    text = text.replace(/\n\r/g, "\n");
    text = text.replace(/\r/g, "\n");

    // 去除注释
    text = text.replace(/\/\/.*\n/g, "\n").replace(/\/\*[^]*?\*\//g, " ");

    // 获取setting

    var setting = text.match(/\s*#\s*([a-zA-z0-9-]+)\s*:\s*.*\n/g);
    text = text.replace(/\s*#\s*([a-zA-z0-9-]+)\s*:\s*.*\n/g, "\n");

    // 压缩空白
    /* while(index < text.length) {
        var curChar = text[index];
        if(isBlankChar()) {
            while(nextIsBlankChar()) {

            }
        }
    } */
    text = text.replace(/[\t \v\f]+/g," ");
    text = text.replace(/ ?(\n ?)+\n ?/g,"[newline]");
    text = text.replace(/ ?\n ?/g," ");
    text = text.replace(/\[newline\]/g, "\n");

    // parse
    index = 0;
    var res = content();
    res;
}

function content(onlyRead: boolean = false): [boolean, string] {
    var res: string = "";
    while(index < text.length) {
        if(is("[")) {
            index++;
            skipBlank();
            var name = labelName();
            if(name[0] === false) {
                console.log("Error");
                return [false, res];
            }
            else {
                skipBlank();

                processLabel(name[1], onlyRead);
                
            }
        }
        else if(is("]")) {
            index++;
            return [true, res];
        }
        else {
            res += text[index];
            if(!onlyRead) {
                document+= text[index];
            }
            
            index++;
        }
    }
    return [true, res];
}

function labelName(): [boolean, string] {
    if(isName()) {
        var name = text[index];
        while(next(isName)) {
            index++;
            name += text[index];
        }
        index++;
        return [true, name];
    }
    else {
        return [false, ""];
    }
}

function isBlankChar(): boolean {
    var reg = /^[\t \v\f]$/g;
    return reg.exec(text[index]) !== null;
}

function skipBlank() {
    if(isBlankChar()) {
        while(next(isBlankChar)) {
            index++;
        }
        index++;
    }
}

function next(func: () => boolean) {
    if(index + 1 < text.length) {
        index ++;
        var res = func();
        index--;
        return res;
    }
    else {
        return false;
    }
}

function is(char: string): boolean {
    return text[index] === char;
}

function isName(): boolean {
    var reg = /[a-zA-Z0-9-]/g;
    return reg.exec(text[index]) !== null;
}

function processLabel(name: string, onlyRead : boolean = false): [boolean, string] {
    var res = "";
    switch (name) {
        case "section":
        case "subsection":
            res += "\\";
            res += name;
            res += "{"; 
            if(!onlyRead) {
                document += res;
            }
            
            var subRes = content();
            if (subRes[0] === true) {
                res += subRes[1];
                res += "}";
                if(!onlyRead) {
                    document += "}";
                }
            }
            else {
                res += subRes[1];
                if(!onlyRead) {
                    document += subRes[1];
                }
                return [false, res];
            }
            break;

        case "title":
        case "author":
        case "date":
            res += "\\";
            res += name;
            res += "\n";
            if(!onlyRead) {
                document += res;
            }
            var subRes = content(true);
            if(subRes[0]) {
                introduction += "\\";
                introduction += name;
                introduction += "{";
                introduction += subRes[1];
                introduction += "}\n";
            }
            else {
                return [false, res];
            }
            
    }

    return [true, res];
}