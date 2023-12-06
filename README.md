# Lix 文档

Lix 开发的目的在于简化 Latex 的复杂语法并且尽可能的保留 Latex 的排版能力，并且提供更直观易读的源文件。

* 页面设置：页边距
* 自定义指令
* 字体：字体、字号、字形（粗体、斜体）


计划采用 环境+标签 的模式，类似于html+css

## 配置及编译

首先在合适的文件夹内使用
```
git clone https://github.com/Pengfei-Hao/Lix
```
克隆Git库，然后使用
```
npm install
```
安装所需的依赖库，然后按F5即可运行。

新建（或打开/tests/目录中）拓展名为**lix**的文件，即可使用Lix。

* Show Latex：展示编译过后的Latex源代码。
* Show PDF：将文档编译为PDF，PDF文件位于文档所在目录下的**lix_temp**目录内。

## 原理

### Syntax
语法：
实意字符char
空白字符：连续两个换行newline，连续空白blank

上述符号不包括#和[]的

词法符号
```
blank -> (space\t\v\f)+和单个的\n
newline -> \n((blank)*\n)+
char -> 其他
```

```
LiX ->setting|
```

### 架构设计

LiX的核心部分负责将lix文件解析为抽象语法树，由于LiX被设计为各个标签可以有不同的语法，因此我们词法分析和语法分析阶段合并。

将源文本分割，并根据标签的名称选择对应的处理函数。

对Label的管理，

node.ts 对抽象语法树节点及类型的管理，类型分为Type Id Name，这三种类型是等价的，在内部统一使用Id进行管理。

## LiX 支持的属性

标题

字体字号：加粗 倾斜 删除线 
字体 字号 颜色 前景、背景色
上下标

居中、左右对齐

分割线

引用

列表

表格

图片

代码

数学

段落、换行

### 数学环境

数学环境使用
```
[formula ...]
[$ ...]
```
其中 ...代表一串符号列，其中符号的名称由字母和数字组成，并且以空格分隔。
```
token1 token2 [token3 token4] ...
```
可以自定义符号：
```
'd => [textbf d]' 
```

内置符号有以下这些：
```
Math functions:
Refer to math.json.

Operator & Symbols:
Refer to math.json.

Alphabets:
Latin Alphabet: a b c ...  A B C ...
Greek Alphabet: alpha beta ...
Digits: 0 1 2 ...



Structures:
Fraction: [... / ...]
Matrix: [... , ... , ...; ... , ... , ...; ...]
Matrix with brackets:
Multiline:
Aligned:

Sqrt: [... ^2]
Sum: [sum ... to ... : ...]
Product: [prod ^ ... _ ...]
Limit: [lim ... : ]
Integral: [int ... to ... : ...]

Script:
Superscript: [... ^ ...]
Subscript: [... _ ...]
Super-subscript: [... ^ ... _ ...]

Brackets:
Round brackets: [( ... )]
Square brackets: (unsupported)
Curly brackets: [{ ... }]
Angle brackets: [< ... >]
Pipes: [| ... |]
Double pipes: [|| ... ||]

Tag:
``` 


## 开发

### Parser

#### 文法

document -> blank [paragraph|setting]* eof
setting -> # blank name : command \n blank
paragraph -> [label | [escapeChar | blank | text]]
label -> '[' blank name blank  ']'
blank -> [ [\t \v\f\r\n]+ | // ... \n | /* ... */] *
#### Match 函数

每个myMatch函数对应一个语法节点，功能是从index开始匹配该语法节点，如果成功index设置为该语法节点结尾后一个字符的位置，如果失败index位置是随机的。

##### myMatch模版
let node = new Node(this.xxxType);
let msg: Message[] = [];
this.begin("xxx");
node.begin = this.index;

match syntax ...

   保证index位置正确

需要用到其他match函数时：
let result = this.tryToMatchLabel();
this.mergeMessage(msg, result.messages);
if (!result.success) {
    this.sendMessage(msg, "Match label failed.");
    return new Result(false, node, msg);
}
node.children.push(result.content);

需要试错match函数时
let result = this.matchXXX();
if (result.success) {
    this.syntaxTree.children.push(result.content);
    this.mergeMessage(msg, result.messages);
    return new Result(true, node, msg);
}

result = this.matchXXX();
if (result.success) {
    this.syntaxTree.children.push(result.content);
    this.mergeMessage(msg, result.messages);
    return new Result(true, node, msg);
}

this.sendMessage(msg, "xxx");
return new Result(false, node, msg);

返回时(失败)
this.sendMessage(msg, "xxx");
return new Result(false, node, msg);

返回时(成功)
return new Result(true, node, msg);

每个match函数对应相应的match函数，提供试错机会，并且在myMatch失败后将index放回初始位置,并且不产生message.
match模版
let preIndex = this.index;
let result = this.matchSetting();
this.end();
result.content.end = this.index;
if (!result.success) {
    this.index = preIndex;
}
return result;


#### Match 两种模式

扫描模式

while(this.notEnd()) {
    if(this.is(Parser.blank)) {
        do {
            this.move();
        } while(this.notEnd() && this.is(Parser.blank));
    }
    else if(this.is("/") && this.nextIs("/")) {
        this.move(2);
        while(this.notEnd()) {
            if(this.is("\n")) {
                this.move();
                break;
            }
            this.move();
        }
    }
    else if(this.is("/") && this.nextIs("*")) {
        this.move(2);
        while(this.notEnd(1) && )
    }
    else {
        this.move();
    }
}