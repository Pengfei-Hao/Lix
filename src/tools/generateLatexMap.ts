let source = ["\\A","\\B","\\C","\\D","\\E","\\F","\\G","\\H","\\I","\\J","\\K","\\L","\\M","\\N","\\O","\\P","\\Q","\\R","\\S","\\T","\\U","\\V","\\W","\\X","\\Y","\\Z",];

let res: [string, string][] = [];

for(let item of source) {
    res.push([item, `\\mathbb{${item.charAt(1)}}`]);
}

console.log(JSON.stringify(res));