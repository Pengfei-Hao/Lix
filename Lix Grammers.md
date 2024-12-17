# Lix Grammers

在本文中主要讲解 Lix 语法解析部分的实现. 语法部分的设计以及使用可以参考 `Lix Document.md`, 本文重点关注实现细节.

本文首先给出语法的产生式以及相关记号, 然后详细介绍代码实现的细节, 本文主要对应 `src/parser` 中的代码部分.

## Production Rule

在本节中给出 Lix 所有语法的产生式, 具体实现在 Implement 节中.

### Notation

首先介绍本文用到的产生式的写法. 一个产生式如下所示
```
name -> token token ...
```
其中 token 可以是
* 终结符号 : 直接将符号写出即可, 如 `formula ->  [ formula <formula-expr> ]` 中箭头右边的的 `[`, `formula`, `]`.
* 其他产生式 : 使用一对尖括号将产生式的名字包住, 如上例中的`<formula-expr>`. 
* EOF : 文件结束标记, 直接写出.
* \[abcdefg\] : 从括号中选择一个匹配.
* NULL : 未匹配标记, 一般用于或运算和 repeat-end 运算中, 见下文.

此外, token 还可以加修饰, 如下
* \+ : 表示参数, 如 `<blank> + greater than two`.
* ! : 表示匹配错误, 匹配到该项后要输出一个警告或错误.
* \* : 匹配退回标记, 匹配到该项后要退回该项.

在本文的文法中还有两类运算, 分别是或运算和 repeat-end 运算, 注意小括号可以用来调整各个运算的优先级, 如下
* 或运算 : 用符号 | 表示, 只要匹配到其中一个即可, 如 `element -> <notation> | <symbol>`.
* repeat-end 运算 : 表示一直重复匹配直到结束条件满足, 如 `free-text -> repeat (<escape-char> | <reference>) end (*EOF)`.

下面给出 Lix 各部分的文法.

### Foundation

本部分给出最基础的词法符号的产生式, 如名称, 换行, 空白, 注释等.

```
name -> repeat([A-Za-z0-9-]) end (*<repeat-failing>)
newline -> [\r\n]
blankchar -> [\t \v\f]

singleline-comment -> / / repeat (<not-end>) end (*EOF | *<newline>)

multiline-comment -> / * repeat (<multiline-comment> | <not-end>) end (!EOF | * / )

singleline-blank ->  repeat (<blankchar> | <multiline-comment>) end (*EOF | <singleline-comment> | <repeat-failing>)

multiline-blank -> repeat (<blankchar> | <newline> | <singleline-comment> | <multiline-comment>) end (*EOF | <repeat-failing>)

skip-blank -> singleline-blank | NULL

skip-multiline-blank -> multiline-blank | NULL
```

### Document & Setting & Block

本部分给出 Lix 基础功能的产生式, 包括 document, setting, block 的基本处理.

```
document -> repeat (<setting> | <free-paragraph> | <block>) end (*EOF)

// setting

setting -> # <skip-blank> <name> <skip-blank> : repeat(<not-end>) end (*EOF | *<newline>)

// block

arguments -> ( < !EOF | ( > | <name> repeat ( , <name> ) end (!EOF | >) ) ) | : | NULL

block -> [ <skip-blank> <name> <skip-blank> <arguments> <name-block-handler>

error-block -> <block> + name != other, basic, format

// otherBlocks: paragraph

other-block -> <block> + name = paragraph
// paragraph-block-handler 在 paragraph & text 节中

// basicBlocks: text, formula, figure, list, table, code
basic-block -> <block> + name = text, formula, figure, list, table, code
// text-block-handler 在 paragraph & text 节中
// formula-block-handler 在 math 节中
// figure, list, table, code-block-handler 在 core 节中

// formatBlocks: emph, bold, italic
format-block -> <block> + name = emph, bold, italic
// emph, bold, italic-block-handler 在 core 节中

= matchBlock(): Result<Node>
```

### Paragraph & Text

本部分给出 paragraph 块, text 块及其简略写法的产生式.

```
// paragraph & text

// free-paragraph 的错误处理放到 free-text 中, 因为free-text 是一个 <not-end>, 因此只会在 end 条件停下来. 此处只要 free-text 加 * 的终止条件作为全集, 其他或条件构成这个全集不交并即可.

free-paragraph -> repeat (<free-text> | <basic-block>) end (*EOF | <multiline-blank-ge-than-1> | *<other-block> | *#)

escape-char -> \ [[]()#@/]

multiline-blank-le-than-or-eq-1 -> ...
multiline-blank-ge-than-1 -> ...

reference -> @ <name> <skip-blank>

// inline-formula 在 math 节中

// embeded formula 要放到 blank 之后, 因为注释的前缀也是 /
free-text -> repeat (<multiline-blank-le-than-or-eq-1> | <escape-char> | <reference> | <inline-formula> | <format-block> | <not-end>) end (*EOF | *<multiline-blank-ge-than-1> | \ \ | *<other-block> | *<basic-block> | *#)

// 同 paragraph, 一部分错误处理要放到 par free text 中
paragraph-block-handler -> repeat (<par-free-text> | <basic-block> | !<other-block>) end (!EOF | ])

par-free-text -> repeat (<multiline-blank-le-than-or-eq-1> | !<multiline-blank-ge-than-1> | <escape-char> | <reference> | <inline-formula> | <format-block> | <not-end>) end (*EOF | *] | \ \ | *<basic-block> | *<other-block>)

text-block-handler -> repeat (<multiline-blank-le-than-or-eq-1> | !<multiline-blank-ge-than-1> | <escape-char> | <reference> | <inline-formula> | <format-block> | !<basic-block> | !<other-block> | !<error-block> | !(\ \) | <not-end>) end (!EOF | ])
```

### Math

本部分给出 Math 模块对应功能的产生式, 主要包括 formula 块以及行内 foumula 块的产生式.

```
formula -> 

elements -> repeat (<element> | [ <elements> | <multiline-blank-le-than-or-eq-1> | !<multiline-blank-ge-than-1> ) end (!EOF | ] | ` | / )

element -> ( repeat([A-Za-z0-9]) end (*<repeat-failing>) ) | <element-char> | ( ` repeat(<not-end>) end(!EOF | *` ) ` )

inline-formula -> / <elements> + endWith /
formula-block-handler -> <elements> + endWith ]


elements -> repeat(<multiline-blank-le-than-or-eq-1> | !<multiline-blank-ge-than-1> | <formula> | <defination> | <escape-element> | <inline-text> | <element> | !<not-end>) end (!EOF | EndWith...)
defination -> ` <elements> `
formula -> [ <elements> ]

escape-element -> @ <element>

element -> <notation> | <symbol>
notation -> repeat([A-Za-z0-9]) end (*<repeat-failing>)
symbol -> Symbol... | UnicodeSymbol...

inline-text -> " repeat(<not-end>) end (!EOF | ")




element-char ->

inline-text ->
element ->
formula ->

term -> <formula> | <defination> | <inline-text> | <element> + not operator | <escape-element> | <element> + prefix-operator
operator -> <element> + infix-operator

prefix -> <operator> <expression> <operator> <expression> 
infix -> <expression> <operator> <expression> 
expression -> repeat (<term> | <operator>) end (*EOF | *endTerm...)
```

### Core

本部分给出 Core 模块对应功能的产生式, 主要包括 figure, code, table 等基础块以及 emph, bold 等格式块的产生式.

```
// core

figure-block-handler -> <multiline-blank-le-than-or-eq-1> repeat (<single-figure> <multiline-blank-le-than-or-eq-1>) end (])
single-figure -> ` repeat (<not-end>) end (`) <skip-blank> [ <text-block-handler>

list-block-handler -> ...

table-block-handler -> ...

code-block-handler -> ...

emph-block-handler -> repeat (<multiline-blank-le-than-or-eq-1> | !<multiline-blank-ge-than-1> | <escape-char> | <reference> | <inline-formula> | !<format-block> | !<basic-block> | !<other-block> | !<error-block> | !(\ \) | <not-end>) end (!EOF | ])

bold-block-handler -> repeat (<multiline-blank-le-than-or-eq-1> | <escape-char> | <reference> | <inline-formula> | <not-end>) end (])

italic-block-handler -> repeat (<multiline-blank-le-than-or-eq-1> | <escape-char> | <reference> | <inline-formula> | <not-end>) end (])

```

## Implement

在本节介绍 Parser 的具体实现, 主要代码位于 `src/parser` 内. 本文主要介绍 Parser 在语法解析部分的实现, Parser 类的设计以及与其他类的结合在 `Lix Document.md` 中介绍.

在 Parser 中有 `index` 变量用来指示当前解析到的位置, 有 `move` 和 `curChar` 函数 (以及对应的 Unicode 版本) 用来操控 `index` 和读取当前的字符.

一般来说, 上节中的每个产生式都对应一个同名的 match 函数, 用于具体实现对产生式的解析, 如 `document` 产生式对应 `matchDocument`, match 函数的具体介绍见后文. 同时为了辅助解析过程进行, 还有一类 is 函数, 介绍同样见后文. 通过递归地调用这些match函数, 就可以实现文法的解析.

### 'match' Function

match 函数的功能是从当前的 index 开始, 按照其对应的产生式向后不断匹配字符, 直到成功匹配或产生错误, 并给出相应的结果.
一般来说, match 函数不接受参数, 返回 Result<Node> 类型, 同时 index 的范围可以取在 [0, length] 之间, 特别要注意处理 index=length 的情况 (即 `isEOF` 成立, 见后文).

match 函数主要负责如下几个部分的工作:

* 维护 parser 的上下文信息
  * 调整 index 到合适的位置
  * 维护 parser 中的调用堆栈信息 (用 `begin` 和 `end` 函数)
* 构造 result
  * 维护 state
  * 构造 content 信息
    * type, content, children
    * range: begin, end
  * 维护附加信息 messages 和 highlight

下面逐一讲解上面的要求.

#### Result Structure

**维护 state**

在 match 的结果中有以下几个状态:
* successful: match 过程中未发现错误, 并且完整匹配到了产生式中的所有项.
* skippable: match 过程中虽然有错误但是可以跳过, 不会影响对后续文档进行分析, 方便跳过错误继续分析.
* matched: 此状态仅应在可以出现在 | 运算中的产生式中使用, 表示能确保是这个分支但是出现了不可跳过的错误, 同时所有参与 | 运算的产生式所匹配的符号应当两两不相交.
* failing: 此状态在 | 运算中表示能确认不是此分支, 在其他地方表示出现了不可跳过的错误.

上述的状态对应 `Result.state` 字段. 下面是对 match 函数返回的 state 的要求.

对于参与 | 运算的 match 函数, 
* 如果能完整的匹配到产生式中的各个项, 则状态为successful; 
* 如果不能完整匹配但能通过某些结构特点或字符来界定这个产生式的结束位置, 则可以"跳过"这个产生式, 继续进行后续的分析, 并将状态设置为skippable; 撞到 eof 也设为 skippable;
* 如果不能完整匹配且无法界定结束位置, 但是可以根据某些结构特点, 如前导字符等, 来确定出后面的内容属于这个产生式, 则返回matched; 同时还要保证或运算的各个分支是相互独立的, 也就是有且仅有一个分支可能为真, 同时所有分支的并集要尽可能大, 以保证更强的鲁棒性;
* 如果界定出不属于这个产生式或者无法界定, 则匹配失败, 状态为 failing.

对于不参与 | 运算的 match 函数,
* 如果能完整的匹配到产生式中的各个项, 则状态为successful;
* 如果不能完整匹配但能通过某些结构特点或字符来界定这个产生式的结束位置, 则可以"跳过"这个产生式, 继续进行后续的分析, 并将状态设置为skippable;
* 如果不能完整匹配且无法界定结束为止, 则匹配失败, 状态设为failing.

也就是说 (参与 | 运算的 match 函数) 的 matched 和 failing 状态是对(不参与 | 运算的 match 函数) 的 failing 状态的更细致的划分. 下面还有几个便于使用的简写
* result.shouldTerminate = failing || matched,
* result.matched = matched || skippable || successful.

**维护附加信息**

在适当的时候添加语法高亮和报错信息.

语法高亮对应 `result.highlights`, 主要用于提供高亮信息, 便于渲染.

报错信息对应 `result.messages`, 分为错误, 警告和信息, 用于输出分析结果.

**维护 content**

content 对应 `result.content`, 表示语法树的一个节点, 类型为 `Node`.
在适当的时候添加 type, content, children, 用于生成语法树.
content 的range信息应当恰好包含所有的内容, 即如果有[...]应当不包含括号.

#### Maintain the Context of Parser

**调整index**

对于参与 | 运算的 match 函数, match 函数从当前的 index 开始向后匹配, 如果 state 是
* successful, 则 index 停止在该 match 匹配到的产生式完成后的下一个位置, 
* skippable, 则停止在吃掉错误后的下一个位置,
* matched, 则停在随机位置, 或者说无法确定 index 的具体位置,
* failing, 则停在原位.

对于不参与 | 运算的 match 函数, match 函数从当前的 index 开始向后匹配, 如果 state 是
* successful, 则停止在该 match 匹配到的语法完成后的下一个位置,
* skippable, 则停止在吃掉错误后的下一个位置,
* failing, 则停在原位.

**node堆栈信息**

每次进入 match 函数后调用 begin 函数, 退出 match 函数后调用 end 函数, 这个功能通过 match 调用 myMatch 来实现, 见后文. 堆栈名字应该与产生式节点同名.

### 'is' Function

is 函数的功能是从当前 index 开始, 向后判断此处的字符是否满足其对应的产生式, 这个函数与 match 函数不同的是不会造成任何影响, 即不会调整 index 位置, 也不会生成 result.

一般来说, is 函数不接受参数, 返回boolean, index 可以位于 [0,length] 之间, 同样要注意处理 index=length. 还有如下要求
* is 函数工作方式与同名的 match 函数类似, 只是在匹配完成后不改变 index 且不生成结果. 只要同名 match 函数得到的 state 为 matched || skippable || successful 那么 is 函数的结果就为 true, 否则为 false. is 函数适用于或运算匹配 end 标签中加 * 的部分.


### Matching Process: Sequential

上面已经阐述了对 match 函数行为的具体要求, 接下来实现 match 函数的内部细节.

match 函数的基本模式是顺序匹配, 与产生式的匹配规则一致, 按照从左到右的顺序依次匹配: 即从文本中读取一个token (可以为终结符号或者产生式), 然后合并到原有的结果上, 如果结果为 successful 或者 skippable, 则继续match过程; 否则中止 match 过程并且进行相应处理.

为了实现的简单, 这里采用 match + myMatch 的实现模式, match 主要用于维护上下文并在内部调用 myMatch, myMatch 真正进行产生式匹配.

#### Preparatory & Concluding Phase

在准备以及结尾阶段可以维护上下文信息, 主要在 match 函数中进行, 具体操作如下

准备阶段:
* 记录当前的 index 为 preIndex, 用于 state 为 failing 时恢复,
* node 堆栈 begin,
* state 设为 failing,
* new Node,
* node 的 range begin 设为当前的 index.

结尾阶段:
* 如果state 为 failing 则恢复 index,
* node 堆栈 end,
* node 的 range end 设为 当前 index.

以下是 match 函数的模版.

```
matchXXX(): Result<Node> {
    let result = new Result<Node>(new Node(this.xxxType));
    let preIndex = this.index;
    this.begin("xxx");
    this.myMatchXxx(result);
    this.end();
    result.content.begin = preIndex;
    result.content.end = this.index;
    if (result.failed) {
        this.index = preIndex;
    }
    return result;
}
```

#### Matching Phase

匹配阶段主要在 myMatch 函数中进行, 需要处理的有 index, state, node, message, highlights, 如下
* &&& 移动 index
* 完善 node
  * type
  * 添加 children
  * 设置 content
* &&& 合并 state
  * 在合适的时候 GuaranteeMatched, 见下文
  * 如果 shouldTerminate 需要返回
    * 合适的时候 promoteToSkippable, 见下文
* &&& 合并 messages, highlights
  * 添加新的 message, highlight

由于 match 函数是依次匹配的, 每次匹配到终结符或产生式后, 都可以得到一个 `Result<Node>`, 此时可以用 `result.merge()` 函数将前边的结果合并到现有的结果上, 上边 '&&&' 表示 merge 函数会自动处理的任务. 此外还有 `result.mergeState()` 函数仅用于处理 state.

message 和 highlights 这两个信息的提供的原则是哪个函数 match 了这个符号则提供报错, 信息和高亮, (例外: 终结符号 match 函数, matchName 函数的信息, 高亮等由调用方提供) 防止重复.

promoteToSkippable 一般只对自身的问题进行错误恢复, 但如果调用了其他产生式, 一般不对其进行错误恢复 (例外: matchBlock 中对于 blockHandler 出错的情况有默认的错误恢复机制).

注意 EOF 的报错只需要发生在 not-end 的循环或者模式匹配中, 是notend的一种特例或者未匹配的一种特例, EOF 一般 promoteToSkippable.

GuaranteeMatched 仅在需要产生 matched 状态的函数中使用, 如果第一个合并的符号为终结符或者产生式 (如 `match("@")`), 则 GuaranteeMatched 函数应该加在
```
let res = matchXXX();
result.merge(res);
if(result.shouldTerminate) {
    return;
}
result.guaranteeMatched();
```
如果第一个合并的符号是一个或运算或者一个 repeat-end, 则应当
```
while(true) {
if((res = matchXXX()).matched) {
    result.merge(res);
    result.guaranteeMatched();
    if(result.shouldTerminate) {
        return;
    }
}
}

```

#### Block Handler & Insertion Handler

Block handler 和 insertion handler 是两类特殊的 match 函数, 它们与 match 的用法基本相同, 但是有一下几点需要注意:

Block Handler
* Block handler 是 Lix 中各种 block 的 match 函数, 其语法匹配的范围位于 `[block-name : block-content]` 的 `:` 之后到 `]` 之前的位置, 注意 `:` 以及 `]` 的高亮不需要在 handler 内提供, 同时 handler 不应当 match `]`.
* Block handler 是由 matchBlock 调用的, 如果 Block handler 的 state 为 sk, s, 则会用 block handler 的结果替代掉 block node, 反之则会保留 block node 并提供默认的 skip.
* 要保证停在 EOF 或 `]` 处, 并且处理 EOF 的报错, 无需处理 ] 的报错.
* 要注册一个新的 handler, 在 Moudle 的 constructor 内向 `parser.blockHanlderTable` 添加函数, 并且声明该 block 属于 `formatBlock`, `basicBlock`, `otherBlock` 中的哪一类.
  * format: 该类 block 会在 text block 内被处理, 处理完后的内容作为 text 的子节点, 并且对内容进行格式化;
  * basic: 该类 block 会在 paragraph block 内被处理, 处理完后作为 paragraph 的子节点;
  * other: 该类会在 document 外进行处理, 处理完后作为 document 的子节点.

Insertion Handler
* Insertion handler 是 Lix 中 text block (包括 free text, 以及位于 paragraph 内的 free text) 内部的插入语, 如行内公式 `/ ... /` 以及引用 `@ ...`. 注意insertion 中的所有高亮信息 (包括前导符号) 都需要在 handler 内提供.
* Insertion handler 是由 matchFreeText (包括 matchParFreeText, textBlockHandler) 调用的, 如果匹配成功, 其匹配结果会被作为 text node 的一个子节点插入, 否则会插入一个 insertion 节点并进行默认 skip.
* 要注册一个新的 handler, 在 Moudle 的 constructor 内向 `parser.insertionHanlderTable` 添加函数, 并且提供前导符号, 必须为一个字符.

#### Matching Terminal Token & Production Rule

下面说明如何顺序匹配一个终结符号. 在顺序匹配的过程中, 我们只使用三种状态, failing, skippable, successful, 每次 merge 都会在这三种状态中转换:
```
// 本行用于从初始状态第一次匹配时状态从 f 转换到其他状态, (end) 表示应当中止解析
f + s = s, f + sk = sk, f + f = f (end);

// 这行用于正常匹配时继续向后匹配的状态合并
s + s = s, s + sk = sk, s + f = f (end);
sk + s = sk, sk + sk = sk, sk + f = f (end).

// promote: 用于在发现错误后手动跳过错误
promote: f + sk = sk
```
要注意的是如果运算结果为 failing 应当结束解析, 以保证除第一次合并外每次合并都不会有 f 与其他状态合并的情况.

如果要匹配的的这个终结符号为某个字符, 符号等, 写法如下:
```
result.merge(this.match("xxx"));
if (result.shouldTerminate) {
    result.message.push(this.parser.getMessage("xxx"));

    // 如果需要skippable写在这
    result.promoteToSkippable();
    // 向后skip的代码
    return;
}
node...content...children
highlight...
```

如果要跳过空白, 由于 skipBlank 不会出 failing 而无需判断, 而且一般也无需给空白生成其他结果, 使用
```
result.merge(this.skipBlank());
```

如果match的这一项为其他的产生式等,写法如下:
```
let res = this.matchXXX();
result.merge(res);
if (result.shouldTerminate) {
    // 不需要错误信息, 因为 res 中已经有错误信息了.

    // 一般不需要skip
    return;
}
node...content...children
// 一般不需要高亮, res 已经提供
```

要使用带参数版本的 match, 先用对应参数的 is 函数, 如果 is 成立则直接使用不带参数版本的 match 函数.

为了方便或运算, 使得本函数可以返回 matched 状态, 可以使用 `result.GuaranteeMatched()` 函数, 它表示从当前状态开始, 不再出现 failing 状态, 而是用 matched 状态代替, 即从当前位置开始只使用 matched, skippable, successful 三种状态, 如果当前是 failing 则会替换为 matched:
```
// 本行用于从初始状态第一次匹配时状态从 f 转换到其他状态, (end) 表示应当中止解析
m + s = s, m + sk = sk, m + f = m (end);

// 这行用于正常匹配时继续向后匹配的状态合并
s + s = s, s + sk = sk, s + f = m (end);
sk + s = sk, sk + sk = sk, sk + f = m (end).

// promote: 用于在发现错误后手动跳过错误
promote: m + sk = sk
```

#### | Operation

或运算按照从左到右的顺序依次匹配, 直到第一个成功后就不再匹配.

state 的处理: 如果某个或运算的分支 state 为 matched, skippable, successful 则停止匹配, 然后将该分支的结果合并到 result 上; 若没有标签为上述三个, 则运算结果为 failing; 然后将该结果合并到原来的结果上.

为了兼容 | 运算, 需要添加几个运算规则来兼容 matched 状态:

在未 GuaranteeMatched 时
```
f + m = f(end), sk + m = f(end), s + m = f(end)
```
在已 GuaranteeMatched 时
```
m + m = m(end), sk + m = m(end), s + m = m(end)
```
这种手段的目的是保证 matched, failing 状态不会同时出现导致问题.

以下是几种在或运算中常用的修饰和记号的实现:

对于 * 修饰, 要用 is 函数, 使用 is 函数的不合并状态
```
if(isXXX()) {
    // ...
}
```

对于 EOF, 由于 EOF 不能被匹配, 使用
```
if(isEOF()) {
    
}
```

对于 NULL, 实际是或语句的最后一个 else, 使用
```
...
else {
    state
    node...content...children
    highlight...
    guarantee...

    msg.push(this.getMessage("xxx"));
}
```

对于 ! 修饰, 同样使用 match 函数, 但要报错
```
if ((res = this.matchXXX()).matched) { // Error
    result.merge(res);
    node...content...children
    highlight...

    msg.push(this.getMessage("xxx"));
    
    // 不严重的错误 skip
    result.mergeState(ResultState.skippable);
    // 向后skip的代码
    return;

    --------
    result.mergeState(ResultState.failing);
    // 严重的错误 fail
    return;
}

```

或运算对应的代码:
```
let res: Result<Node>;

if ((res = this.matchXXX()).matched) { // Matched
    guarantee... // 要放在前边
    // 其余与产生式相同
}
else if ((res = this.matchXXX()).matched) { // Error
    // ! 修饰
}
else if (isXXX()) { // Is
    // * 修饰
}
...
else { // Null
    // NULL 修饰
}
```

#### Repeat-End Operation

repeat ... end : 执行过程, 先判断 end 条件是否满足(判断时先看是否为 EOF), 若满足则结束; 若不满足再看 repeat 条件是否满足, 若满足则重复上述流程, 若不满足则报错.

特殊标签:
* <not-end>: 只要 end 不满足就是真, 每次吃掉一个字符;
* <repeat-failing>: repeat 匹配不到了就为真, 这个标签遇到 EOF 也为真, 本身相当于加了 * 修饰.
在 end 中 加 * 代表此标签为结束标记, 不会吃掉这个标签, 并且必须使用 is 函数处理.

0-repeat ... end : repeat 重复 0 次也成功, 适用于空串也是正确语法的场景. 实现方式是在 repeat 之前 merge 一个 successful. 注意如果 repeat 之前已经有 token 那么 0-repeat 与 repeat 是相同的.

repeat end 内部相当于一个或运算, 每次选出一个元素合并到 result 即可. 

repeat end 有三种使用方式, 见下边的三份代码.
下述三种情况中, 第一种必须处理 EOF, 第二种可选, 第三种一般不用处理.

**直到结束**
```
repeat (<cond1> | <cond2> | <not-end>) end (<end1> | <end2>)

while(true) {
  // 判断 end 标签
  if ((res = matchXXX()).matched) { // 见或运算...; break; } // 不加 * 修饰的 end 标签要合并 state
  else if (isXXX()) { break; } // 加 * 修饰的直接返回

  // 判断 repeat 标签
  else if ((res = matchXXX()).matched) { ... } // 要合并 state
  ...
  // <not-end> 标签处理
  else if (isEOF()) { mergeState(failing); message; return; } // 因为 not-end 每次吃一个字符, 所以遇到 EOF 要报错.
  else { mergeState(successful); this.move(); node..., highlight...} // 吃一个字符并合并 successful
}
```

**直到匹配失败**
```
repeat (<cond1> | <cond2>) end (<end1> | <end2> | *<repeat-failing>)

while(true) {
  // 判断 EOF 标签
  if ((res = matchXXX()).matched) { ... break; } // 不加 * 的 end 标签要合并 state
  else if (isXXX()) { break; }

  // 判断 repeat 标签
  else if ((res = matchXXX()).matched) { ... } // 要合并 state
  ...
  else { break; } // <repeat-failing>
}
```

**模式匹配**
```
repeat (<cond1> | <cond2>) end (<end1> | <end2>)

while(true) {
  // 判断 end 标签
  if ((res = matchXXX()).matched) { ...; break; } // 不加 * 的 end 标签要合并 state
  else if (isXXX()) { break; }

  // 判断 repeat 标签
  else if ((res = matchXXX()).matched) { ... } // 要合并 state
  ...
  else { mergeState(failing); message; skip, match; return; } // 不匹配上述条件之一, 报错 (EOF 处理也在这里)
}
```

#### State Merging

前文已经阐述过 state 合并的机制, 在这里再次回顾一下.

state 采用逐步合并的方式, 初始时的 state 为 failing, 每 match 到一个 token 后就将该 token 的 state 合并到原有的 state 上. 在顺序匹配的过程中, 且未使用 GuaranteeMatched 时, 我们只使用三种状态, failing, skippable, successful, 每次 merge 都会在这三种状态中转换:
```
// 本行用于从初始状态第一次匹配时状态从 f 转换到其他状态, (end) 表示应当中止解析
f + s = s, f + sk = sk, f + m = f(end), f + f = f (end);

// 这行用于正常匹配时继续向后匹配的状态合并
s + s = s, s + sk = sk, sk + m = f(end), s + f = f (end);
sk + s = sk, sk + sk = sk, s + m = f(end), sk + f = f (end).

// promote: 用于在发现错误后手动跳过错误
promote: f + sk = sk
```
要注意的是如果运算结果为 failing 应当结束解析, 以保证除第一次合并外每次合并都不会有 f 与其他状态合并的情况. 此外上述运算已经兼容或运算产生的 matched 状态.


在使用 `result.GuaranteeMatched()` 函数后, 不会再出现 failing 状态, 而是用 matched 状态代替, 即从当前位置开始只使用 matched, skippable, successful 三种状态:
```
// 本行用于从初始状态第一次匹配并 Guarantee 之后状态从 m 转换到其他状态, (end) 表示应当中止解析
m + s = s, m + sk = sk, m + m = m(end), m + f = m (end);

// 这行用于正常匹配时继续向后匹配的状态合并
s + s = s, s + sk = sk, s + m = m(end), s + f = m (end);
sk + s = sk, sk + sk = sk, sk + m = m(end), sk + f = m (end).

// promote: 用于在发现错误后手动跳过错误
promote: m + sk = sk
```

完整版如下:
```
// 未 GuaranteeMatched 
f + s = s, f + sk = sk, f + m = f(end), f + f = f (end);
s + s = s, s + sk = sk,  s + m = f(end), s + f = f (end);
sk + s = sk, sk + sk = sk,  sk + m = f(end), sk + f = f (end);
promote: f + sk = sk

// GuaranteeMatched 
m + s = s, m + sk = sk, m + m = m(end), m + f = m (end);
s + s = s, s + sk = sk,  s + m = m(end), s + f = m (end);
sk + s = sk, sk + sk = sk,  sk + m = m(end), sk + f = m (end);
promote: m + sk = sk
```
其余操作均非法.

### Details

本节描述了所有产生式对应的 match 函数以及可能产生的状态和结果.
由于 index 的行为前文已经规定, 故不在阐述; content.range 为对应产生式的第一个字符位置到最后一个字符位置的后一个位置. 故仅描述下列字段:
* state:
* messages:
* highlights:
* content: Node
  * type:
  * content:
  * children:

#### Foundation

终结符号使用函数 `match` 以及 `is`, 对于 EOF 使用 `isEOF`:
* state: f, s
* messages: []
* highlights: []
* content: null

`name -> repeat([A-Za-z0-9-]) end (*<repeat-failing>)`
* state: f, s
* messages: []
* highlights: []
* content: Node
  * type: nameType
  * content: name matched.
  * children: []

`newline -> [\r\n]`
`blankchar -> [\t \v\f]`
对应 is

`singleline-comment -> / / repeat (<not-end>) end (*EOF | *<newline>)`
* state: f, s
* messages: []
* highlights: []
* content: null

`multiline-comment -> / * repeat (<multiline-comment> | <not-end>) end (!EOF | * / )`
* state: f, sk, s
* messages: ["multiline comment ended..."]
* highlights: []
* content: null

`singleline-blank ->  repeat (<blankchar> | <multiline-comment>) end (<singleline-comment> | <repeat-failing>)`
* state: f, sk, s
* messages: [Inherited]
* highlights: []
* content: null

`multiline-blank -> repeat (<blankchar> | <newline> | <singleline-comment> | <multiline-comment>) end (*EOF | <repeat-failing>)`
* state: f, sk, s
* messages: [Inherited]
* highlights: []
* content: number: number of line breaks

// 下面是 multiline-blank 的带参数形式, 对应于同名的 is 函数, 其 Result 结构与上文相同, 不再重复
`multiline-blank-le-than-or-eq-1 -> <multiline-blank> + blank <= 1`
`multiline-blank-ge-than-1 -> <multiline-blank> + blank > 1`

`skip-blank -> singleline-blank | NULL`
* state: sk, s
* messages: [Inherited]
* highlights: []
* content: null

`skip-multiline-blank -> multiline-blank | NULL`
* state: sk, s
* messages: [Inherited]
* highlights: []
* content: number: number of line breaks

#### Document & Setting & Block

本部分给出 Lix 基础功能的产生式, 包括 document, setting, block 的基本处理.

`document -> 0-repeat (<setting> | <free-paragraph> | <block>) end (*EOF)`
* state: f, sk, s
* messages: [Inherited, New]
* highlights: [Inherited]
* content: Node
  * type: documentType
  * content: ""
  * children: 0 or more node of setting, paragraph or other block

// setting

`setting -> # <skip-blank> <name> <skip-blank> : repeat(<not-end>) end (*EOF | *<newline>)`
* state: f, sk, s
* messages: [Inherited, New]
* highlights: [New]
* content: Node
  * type: settingType
  * content: name of setting
  * children: a node of settingParameterType, its content contains the command.

// block

`arguments -> ( \( <skip-blank> (!EOF | \) | <name> <skip-blank> repeat ( , <skip-blank> <name> <skip-blank> ) end (!EOF | \)) ) ) | : | NULL`
* state: sk, s
* messages: [Inherited, New]
* highlights: [New]
* content: Node
  * type: argumentsType
  * content: ""
  * children: 0 or more node of argumentItemType, its content contains argument.

`block -> [ <skip-blank> <name> <skip-blank> <arguments> <name-block-handler>`
* state: f, sk, s
* messages: [Inherited, New]
* highlights: [Inherited, New]
* content: Node
  * type: blockType
  * content: Before handling, name of block;
  * children: Before handling, [a node of argument];

// 下面是带参数的 block, 其分别对应 同名 is 函数, 其 Result 的结构与 block 相同, 不再重复.

// otherBlocks: paragraph, section ...
`other-block -> <block> + name = paragraph`
// paragraph-block-handler 在 paragraph & text 节中
// section-block-handler, ... 在 Aritcle 节中

// basicBlocks: text, formula, figure, list, table, code
`basic-block -> <block> + name = text, formula, figure, list, table, code`
// text-block-handler 在 Paragraph & Text 节中
// formula-block-handler 在 Math 节中
// figure, list, table, code-block-handler 在 Core 节中

// formatBlocks: emph, bold, italic
`format-block -> <block> + name = emph, bold, italic`
// emph, bold, italic-block-handler 在 Core 节中

#### Paragraph & Text

本部分给出 paragraph 块, text 块及其简略写法的产生式.

// free-paragraph 的错误处理放到 free-text 中, 因为free-text 是一个 <not-end>, 因此只会在 end 条件停下来. 此处只要 free-text 加 * 的终止条件作为全集, 其他或条件构成这个全集不交并即可.

`free-paragraph -> repeat (<free-text> | <basic-block>) end (*EOF | <multiline-blank-ge-than-1> | *<other-block> | *<setting>)`
* state: f, sk, s
* messages: [Inherited, New]
* highlights: [Inherited]
* content: Node
  * type: paragraphType
  * content: ""
  * children: [0 or more text and basic blocks]

`escape-char -> \ [[]()#@/]`
* state: f, s
* messages: [New]
* highlights: [New]
* content: Node
  * type: escapeCharType
  * content: "escape char"
  * children: []


`reference -> @ <name> <skip-blank>`
* state: f, sk, s
* messages: [Inherited, New]
* highlights: [Inherited, New]
* content: Node
  * type: referenceType
  * content: "reference name"
  * children: []

// inline-formula 在 math 节中

// embeded formula 要放到 blank 之后, 因为注释的前缀也是 /
`free-text -> repeat (<multiline-blank-le-than-or-eq-1> | <escape-char> | <reference> | <inline-formula> | <format-block> | <not-end>) end (*EOF | *<multiline-blank-ge-than-1> | \ \ | *<other-block> | *<basic-block> | *<setting>)`
* state: f, sk, s
* messages: [Inherited, New]
* highlights: [Inherited, New]
* content: Node
  * type: textType
  * content: ""
  * children: [word, insertion, format ...]

// 同 paragraph, 一部分错误处理要放到 par free text 中
`paragraph-block-handler -> 0-repeat (<par-free-text> | <basic-block> | !<other-block>) end (!EOF | !<multiline-blank-ge-than-1> | *])`
* state: f, sk, s
* messages: [Inherited, New]
* highlights: [Inherited, New]
* content: Node
  * type: paragraphType
  * content: ""
  * children: [0 or more text and basic blocks]

`par-free-text -> repeat (<multiline-blank-le-than-or-eq-1> | <escape-char> | <reference> | <inline-formula> | <format-block> | <not-end>) end (*EOF | *<multiline-blank-ge-than-1> | *] | \ \ | *<basic-block> | *<other-block>)`
* state: f, sk, s
* messages: [Inherited, New]
* highlights: [Inherited, New]
* content: Node
  * type: textType
  * content: ""
  * children: [text, formula, escape-char ...]

`text-block-handler -> 0-repeat (<multiline-blank-le-than-or-eq-1> | <escape-char> | <reference> | <inline-formula> | <format-block> | !<basic-block> | !<other-block> | !<error-block> | !(\ \) | <not-end>) end (!EOF | !<multiline-blank-ge-than-1> | *])`
* state: f, sk, s
* messages: [Inherited, New]
* highlights: [Inherited, New]
* content: Node
  * type: textType
  * content: ""
  * children: [text, formula, escape-char ...]

#### Math

本部分给出 Math 模块对应功能的产生式, 主要包括 formula 块以及行内 foumula 块的产生式.

`inline-formula -> / <elements> /`
* state: sk, s, matchElements 中对上述模式匹配中有默认的处理机制 (跳过该字符), 所以不会出现 f, 直到遇到结束条件之一.
* messages: []
* highlights: []
* content: Node
  * type: formulaType
  * content: "escape element"
  * children: []

`formula-block-handler -> <elements> + withDefnation`
* state: f, sk, s
* messages: [Inherited]
* highlights: [Inherited]
* content: Node
  * type: formulaType
  * content: "formula block"
  * children: []


`elements -> 0-repeat(<multiline-blank-le-than-or-eq-1> | <escape-element> | <formula> | <defination> | <inline-text> | <element>) end (!EOF | !<multiline-blank-ge-than-1> | *EndWith...)`
`` defination -> ` <elements> ` ``
`formula -> [ <elements> ]`
* state: sk, s, matchElements 中对上述模式匹配中有默认的处理机制 (跳过该字符), 所以不会出现 f, 直到遇到结束条件之一.
* messages: []
* highlights: []
* content: Node
  * type: formulaType
  * content: "escape element"
  * children: []

`escape-element -> @ <element> | \ <element>`
* state: f, sk, s
* messages: []
* highlights: []
* content: Node
  * type: escapeElementType
  * content: "escape element"
  * children: []

`element -> <notation> | <symbol>`
`notation -> repeat([A-Za-z0-9]) end (*<repeat-failing>)`
`symbol -> Symbol... | UnicodeSymbol...`
* state: f, s
* messages: []
* highlights: []
* content: Node
  * type: elementType
  * content: "element: notation or symbol"
  * children: []


`inline-text -> " repeat(<not-end>) end (!EOF | ")`
* state: f, sk, s
* messages: [New]
* highlights: []
* content: Node
  * type: inlineTextType
  * content: "text"
  * children: []



element-char ->

inline-text ->
element ->
formula ->

`term -> <formula> | <defination> | <inline-text> | <element> + not operator | <escape-element> | <element> + prefix-operator`
* state: f, sk, s
* messages: [New, Inherited]
* highlights: [Inherited]
* content: Node
  * type: infix/ prefix / element / inlineText
  * content: "depends"
  * children: [tree of operator]

operator -> <element> + infix-operator

prefix -> <operator> <expression> <operator> <expression> 
infix -> <expression> <operator> <expression> 

`expression -> repeat (<term> | <operator>) end (*EOF | *endTerm...)`
* state: f, sk, s
* messages: [New, Inherited]
* highlights: [Inherited]
* content: Node
  * type: infixType / elementType
  * content: "depends"
  * children: [tree of operator]


#### Core

本部分给出 Core 模块对应功能的产生式, 主要包括 figure, code, table 等基础块以及 emph, bold 等格式块的产生式.

// core

`figure-block-handler -> <multiline-blank-le-than-or-eq-1> repeat (<single-figure> <multiline-blank-le-than-or-eq-1>) end (])`
`` single-figure -> ` repeat (<not-end>) end (`) <skip-blank> [ <text-block-handler> ``
* state: f, sk, s
* messages: [Inherited, New]
* highlights: [Inherited, New]
* content: Node
  * type: figureType
  * content: ""
  * children: [ a figureCaption Node (same as Text Node) in front, others are 0 or more figureItem Node, its content is path, has a optional child figureCaption Node.]

list-block-handler -> ...

table-block-handler -> ...

`code-block-handler -> ...`
* state: f, sk, s
* messages: [Inherited, New]
* highlights: [Inherited, New]
* content: Node
  * type: codeType
  * content: "code"
  * children: []


`emph-block-handler -> repeat (<multiline-blank-le-than-or-eq-1> | <escape-char> | <reference> | <inline-formula> | !<block> | !(\ \) | <not-end>) end (!EOF | !<multiline-blank-ge-than-1> | *])`
`bold-block-handler -> ...`
`italic-block-handler -> ...`
* state: f, sk, s
* messages: [Inherited, New]
* highlights: [Inherited, New]
* content: Node
  * type: boldType, emphType, ...
  * content: ""
  * children: [word, insertion]

// 还有问题, 暂时不用
`inline-emph-handler -> * ... *`
`inline-bold-handler -> ~ ... ~`
`italic-block-handler -> ...`
* state: f, sk, s
* messages: [Inherited, New]
* highlights: [Inherited, New]
* content: Node
  * type: boldType, emphType, ...
  * content: ""
  * children: [text, formula, escape-char ...]
  
#### Article

// 这些等同于 matchText
`section -> ...`
`subsection -> ...`
`subsubsection -> ...`
`title -> ...`
`author -> ...`
`date -> ...`