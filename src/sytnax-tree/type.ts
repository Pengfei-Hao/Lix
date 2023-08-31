import { TypeTable } from "./type-table";

export class Type {
    name: string;
    table: TypeTable;

    constructor(name: string, table: TypeTable) {
        this.name = name;
        this.table = table;
    }
}

/*

export class Type {
    public id: integer;

    constructor(id: integer) {
        this.id = id;
    }

    public static document: Type;

    public static paragraph: Type;
    public static text: Type;

    public static setting: Type;
    public static settingParameter: Type;

    public static label: Type;

    public static equation: Type;
    public static symbol: Type;
    public static defination: Type;
    public static fraction: Type;
    public static matrix: Type;
}

let idToName: string[] = [];
let nameToId: Map<string, integer> = new Map();
let idToType: Type[] = [];
let count = 0;

export function init() {
    idToName = [];
    nameToId = new Map();
    idToType = [];
    count = 0;

    Type.document = addType("document")!;
    Type.paragraph = addType("paragraph")!;
    Type.text = addType("text")!;
    Type.setting = addType("setting")!;
    Type.settingParameter = addType("setting-parameter")!;
    Type.label = addType("label")!;
    Type.equation = addType("equation")!;
    Type.symbol = addType("symbol")!;
    Type.defination = addType("defination")!;
    Type.fraction = addType("fraction")!;
    Type.matrix = addType("matrix")!;
}

export function getType(name: string): Type | undefined
export function getType(id: integer): Type | undefined
export function getType(param: string | integer): Type | undefined {
    let id: integer;
    if(typeof(param) === 'string') {
        let res = getId(param);
        if(res != undefined) {
            id = res;
        }
        else {
            return undefined;
        }
    }
    else {
        id = param;
    }

    if(id >= 0 && id < count) {
        return idToType[id];
    }
    return undefined;
}

export function getId(name: string): integer | undefined;
export function getId(type: Type): integer | undefined;
export function getId(param: string | Type): integer | undefined {
    if(typeof(param) === 'string') {
        return nameToId.get(param);
    }
    else {
        return param.id;
    }
}

export function getName(id: integer): string | undefined;
export function getName(type: Type): string | undefined;
export function getName(param: integer | Type): string | undefined {
    let id: integer;
    if(typeof(param) != 'number') {
        id = param.id;
    }
    else {
        id = param;
    }
    if(id >= 0 && id < count) {
        return idToName[id];
    }
    return undefined;
}
 
export function addType(name: string): Type | undefined {
    if(getId(name) != undefined) {
        return undefined;
    }
    idToName.push(name);
    nameToId.set(name, count);
    let temp = new Type(count);
    idToType.push(temp);
    count++;
    return temp;
}

*/