# Lix Document

## Basic concepts

一个Lix文档由一系列block组成,这些block沿垂直方向从上到下依次排列,组成文档的基本布局.Block可以嵌套子block.下面是几种基本的块:

* Text block: 文本块代表了一行文本, 也就是说里面不能含有换行以及其他影响文本结构的内容, 这个块会自动适应页面的尺寸.文本块中还可以包含行内数学公式,以及引用,如下
  * Words: 纯文本
  * Inline-formula: / ... / 行内数学公式
  * Reference: @ ... 引用
  * Format: [emph ... ]  强调
* Formula block: 公式块包含一行或多行的数学公式,并且占据一行空间.
* Figure block: 图片块可以容纳一张或多张图片，并且占据一行空间.
* List block: 列表块包含一列编号或无编号的列表项,占据一行空间.
* Table block: 表格块包含一个表格,占据一行空间.
* Code block: 代码块包含一段代码,占据一行空间.
* Paragraph block: 逻辑上的一段文字,可以包含数行文字,图标,公式等,以一个或多个基本块为子节点.
* Reference block: 引用标签.
* Document block: 根节点,是所有block的容器.任意block都可以作为他的子节点.


Lix还负责自动化如交叉引用等功能.
某些block可以设置一个计数器,以及标签,可以通过下面的block来引用:

* Reference block: 引用标签.

在Lix中,在block以外还可以插入设置语句,负责配置文档的各种参数.使用如下的

* Setting Statement: 设置语句.

Lix 中的注释有以下两种

* 行注释: // ...
* 多行注释: /* ... */

此外block还负责组织文章的结构,负责文章结构的Block可以由Lix Template自行定义,下面列举几个例子.
注意block的嵌套关系并不代表文章结构的隶属关系,只是为了方便排版.

对于Article模版来说,其还有如下的block:

* Title block: 文章的题目,以一个Text block作为子节点.
* Author block: 文章的作者,以一个Text block作为子节点.
* Date block: 写作的时间,以一个Text block作为子节点.
* Section block以及sub...: 节以及小节的标题,以一个Text block作为子节点.
* Contents block: 目录,无任何子节点.

对于Beamer模版来说,有如下的block:

* Title block: 文章的题目,以一个Text block作为子节点.
* Author block: 文章的作者,以一个Text block作为子节点.
* Date block: 写作的时间,以一个Text block作为子节点.
* Page block: 幻灯片中的一页,以多个paragraph block作为子节点.
* Section block以及sub...: 节以及小节的标题,以一个Text block作为子节点.
* Contents block: 目录,无任何子节点.

## Grammers

block的语法如下:

[block ...]

不需要显式写document block. 为了书写方便,在正文中加入一些语法糖,不需要写text block和paragraph block,转而使用空格代替.

在lix正文中(也就是不进入任何block时),空白分为两种,一种相当于空格(整段空白换行数小于等于1),另一种相当于换行(换行数大于1),其中//注释相当于一个换行,而 /* */注释相当于一个空格. 正文的解析采用排除法,即只要没有进入block就认为是text block, 在这些文本中又由上边的第二种空白分割出了paragraph block. 此外在正文中还可能存在setting语句和转义字符以及行内数学公式.

而在进入block之后,应该按照block规定的语法.

## Grammers

EOF : 文件结束标记
NULL : 未匹配标记
[abcdefg] : 从括号中选择一个匹配
() : 小括号表示运算优先级
+ : 表示参数
! : 表示匹配错误, 匹配到该项后要报错

### result 结构

state:

在匹配的过程中有以下几个属性

succeeded: 标志着本次解析是否成功匹配到
matched: 标志着本次解析一定匹配到, 如发现前导符号#,[等
skippable: 标志着此处虽然有错但是可以跳过, 方便跳过错误继续分析

可能的组合:
successful: (true,true,true) 完全正确,没有问题
skippable: (false,true,true) 确认是自己的语法,匹配失败,可跳过
matched: (false,true,false) 确认是自己的语法,但是匹配失败,无法跳过
failing: (false,false,false) 匹配失败,无法确认是自己的节点

使用state字段代表如上四个状态.

在match函数中进行匹配时,如果成功则使用successful状态; 如果出现可恢复的错误,使用skippable; matched 主要用于或运算中, 要保证或运算的各个分支是相互独立的, 也就是有且仅有一个分支可能为真, 同时所有分支的并集要尽可能大, 以保证更强的适应性; 如果无法匹配, 比如引导的符号错误, 则使用failing.

对于多重选择的match方式,只要结果不是failing就认为是匹配的,错误信息使用这个

content:

messages:

highlights:

preIndex:


### 顺序匹配
按照从左到右的顺序挨个匹配.

state 采用逐步合并的方式, 每 match 到一个元素就合并一次状态. state 初始为 failing, 只要匹配到一个元素后就变为其他三种. 如果合并后的状态为 m 或 f 则应终止解析. 通过这种手段可以保证状态始终为 s 或 sk.

state 合并如下:
s + s = s, s + sk = sk, s + m = m (end), s + f = m (end)
sk + s = sk, sk + sk = sk, sk + m = m (end), sk + f = m (end)
前两行用于正常匹配时继续向后匹配的状态合并

m + sk = sk
本项用于向后匹配失败后将状态改为 sk 并向后跳

f + s = s, f + sk = sk, f + m = m (end), f + f = f (end)
本行用于第一次匹配时状态从 f 转换到其他状态

### match 和 is 函数

match 函数的默认行为:
match 函数从当前的 index 开始向后匹配, 如果结果是 successful 则停止在该 match 匹配到的语法完成后的下一个位置, 若是 skippable 则停止在吃掉错误后的位置, 若是 matched 则停在随机位置, 若是 failing 则停在原位.

match 函数的使用方式:
let XXXRes = this.matchXXX();
result.merge(XXXRes);
if(result.shouldTerminate) {
  // 不需要错误信息, 因为 XXXRes 中已经有错误信息了.
  return;
}

is 函数的默认行为:
is 函数从当前 index 开始向后检查, 最后仍保持 index 不变. is 函数返回boolean, 其工作方式相当于同名的 match 函数, 并且在匹配完成后回退 index, 但是只要得到的 state 为 matched 及以上就为 true, 否则为 false. is 函数适用于或运算匹配 end 标签中加 * 的部分.

is 函数使用方式:
if(this.is(XXX)) {
  mergeState();
  this.move();
}


### | 运算
| 是或运算, 按照从左到右的顺序依次匹配, 直到第一个成功后就不再匹配.

state 的处理: 如果某个标签 state 为 matched, skippable, successful 则停止匹配, 运算结果为该标签的结果; 若没有标签为上述三个, 则运算结果为 failing; 然后将该结果合并到原来的结果上.

对应的代码:
```
label1 | label2 | label3

if(label1 != failing) {
  // 合并 state
}
else if(label2 != failing) {
  // 合并 state
}
else if(label3 != failing) {
  // 合并 state
}
else {
  failing
}
```

### repeat end 标签

repeat ... end : 执行过程, 先判断 end 条件是否满足(判断时先看是否为 EOF), 若满足则结束; 若不满足再看 repeat 条件是否满足, 若满足则重复上述流程, 若不满足则报错.

特殊标签:
<not-end>: 只要end 不满足就是真
<repeat-failing>: repeat 匹配不到了就为真, 这个标签遇到 EOF 也为真, 本身相当于加了 *
* 这两种标签实际上代表了默认行为的三种处理方式(还有两个标签都不加也算一种, 见下面三份代码)
在 end 中 加 * 代表此标签为结束标记, 不会吃掉这个标签, 并且必须使用 is 函数处理

State 处理:
repeat end 内部相当于一个或运算, 每次选出一个元素合并到 state 即可. 此外加 * 的 end 标签不合并, 上述三种状态见代码.

对应的代码:
```
repeat (<cond1> | <cond2> | <not-end>) end (<end1> | <end2>)

while(true) {
  // 判断 end 标签
  if (EOF) { (merge; error;) break; } // 无论 end 中是否有 EOF 都要判断, 且如果没有 EOF 要报错, 并合并状态
  else if (end1 != failing) { merge; break; } // 不加 * 的 end 标签要合并 state
  else if (end2 != failing) { break; }

  // 判断 repeat 标签
  if(cond1 != failing) { merge; } // 要合并 state
  else if(cond2 != failing) { merge; }
  else { merge; this.move(); } //合并 successful
}
```

```
repeat (<cond1> | <cond2>) end (<end1> | <end2> | *<repeat-failing>)

while(true) {
  // 判断 EOF 标签
  if (EOF) { break; } // 无论 end 中是否有 EOF 都要判断, 但不需要报错
  else if (end1 != failing) { merge; break; } // 不加 * 的 end 标签要合并 state
  else if (end2 != failing) { break; }

  // 判断 repeat 标签
  if(cond1 != failing) { merge; } // 要合并 state
  else if(cond2 != failing) { merge; }
  else { break; } // <repeat-failing>
}
```

```
repeat (<cond1> | <cond2>) end (<end1> | <end2>)

while(true) {
  // 判断 end 标签
  if (EOF) { (merge; error;) break; } // 无论 end 中是否有 EOF 都要判断, 且如果没有 EOF 要报错
  else if (end1 != failing) { merge; break; } // 不加 * 的 end 标签要合并 state
  else if (end2 != failing) { break; }
  
  // 判断 repeat 标签
  if(cond1 != failing) { merge; } // 要合并 state
  else if(cond2 != failing) { merge; }
  else { merge; error; break; } // 不匹配, 报错
}
```

### Rules

Foundation:
状态不使用 matched,
不产生 message,
只使用 result 中的 state, content, preIndex

```
name -> repeat([A-Za-z0-9-]) end (*<repeat-failing>)
= matchName(): Result<string>
- state: 只要匹配到就是successful, 否则failing
- content: 

newline -> [\r\n]
blankchar -> [\t \v\f]
= is(newline/blankchar): Result<null>
- state: 只要匹配到就是true, 否则false

= match(text: string): Result<null>
- state: 只有 successful, failing 两种, 辅助函数

singleline-comment -> / / repeat (<not-end>) end (*EOF | *<newline>)
= matchSinglelineComment(): Result<null>
- state: 只要匹配到 // 就是successful, 否则failing

multiline-comment -> / * repeat (<multiline-comment> | <not-end>) end (!EOF | * / )
= matchMultilineComment(): Result<null>
- state: 要完整匹配到 /* ... */ 就是successful, 否则failing, 如果丢掉了 */ 就是 skippable

singleline-blank ->  repeat (<blankchar> | <multiline-comment>) end (*EOF | <singleline-comment> | <repeat-failing>)
= matchSinglelineBlank(): Result<null>
- state: 匹配到空白就是successful, 否则failing, 如果多行注释出错就是 skippable

multiline-blank -> repeat (<blankchar> | <newline> | <singleline-comment> | <multiline-comment>) end (*EOF | <repeat-failing>)
= matchMultilineBlank(lessThan2, moreThan1): Result<number>
- state: 匹配到空白就是successful, 否则failing, 如果多行注释出错就是 skippable
- content: 返回视觉上 newline 个数(多行注释中的换行不算在内)

skip-blank -> singleline-blank | NULL
= skipBlank(): Result<null>
- state: 只能为 successful, skippable (若多行注释出错)

skip-multiline-blank -> multiline-blank | NULL
= skipMutilineBlank(): Result<number>
- state: 只能为 successful, skippable (若多行注释出错)
```

Core:
```
document -> repeat (<setting> | <free-paragraph> | <block>) end (*EOF)
= matchDocument(): Result<Node>
	- state: 整段文本的 state
	- content: type: document, content: [unused], children: [Paragraph, Setting | Block]
	- message:
	- highlights:


// setting

setting -> # <skip-blank> <name> <skip-blank> : repeat(<not-end>) end (*EOF | *<newline>)
= matchSetting(): Result<Node>
	- state: 只要遇到#就是matched, 否则failing; 若有能恢复的错误skippable, 并跳到第一个newline处, 不能恢复的错误matched.
	- content: type: setting, content: (name of this setting), children: [type: settingParameter, content: (parameter of this setting), children: [unused]]
	- message:
	- highlights:

// block

arguments -> ( < !EOF | ( > | <name> repeat ( , <name> ) end (!EOF | >) ) ) | : | NULL
block -> [ <skip-blank> <name> <skip-blank> <arguments> <name-block-handler>
= matchSetting(): Result<Node>
	- state: 只能为 successful 和 skippable
	- content: 
	- message:
	- highlights:


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
- state: 只要遇到[就是matched, 否则failing; 若有能恢复的错误skippable, 并按照[]括号向后跳, 不能恢复的错误matched; 若block名字不符合参数要求,仍然为matched, 但是argError也为真
- content: type: (depends on label), content: (depens on label), children: (depends on the label)

// paragraph & text

// free-paragraph 的错误处理放到 free-text 中, 因为free-text 是一个 <not-end>, 因此只会在 end 条件停下来. 此处只要 free-text 加 * 的终止条件作为全集, 其他或条件构成这个全集不交并即可.

free-paragraph -> repeat (<free-text> | <basic-block>) end (*EOF | <multiline-blank-ge-than-1> | *<other-block> | *#)
= matchFreeParagraph(): Result<Node>
- state: 只要向前移动了就是matched, 否则failing; 若有能恢复的错误skippable, 停止位置不确定, 不能恢复的错误matched
- content: type: paragraph, content: [unused], children: [type: text, content: (text), children: [unused]], [type: label]]

escape-char -> \ [[]()#@/]

multiline-blank-le-than-or-eq-1 -> ...
multiline-blank-ge-than-1 -> ...

reference -> @ <name> <skip-blank>
= matchReference(): Result<Node>
- state: 
- content: 
- message:
- highlights:

// inline-formula 在 math 节中

// embeded formula 要放到 blank 之后, 因为注释的前缀也是 /
free-text -> repeat (<multiline-blank-le-than-or-eq-1> | <escape-char> | <reference> | <inline-formula> | <format-block> | !<error-block> | <not-end>) end (*EOF | *<multiline-blank-ge-than-1> | \ \ | *<other-block> | *<basic-block> | *#)
= matchFreeText(): Result<Node>
- state: 只要向前移动了就是matched, 否则failing; 若有能恢复的错误skippable,位置不确定, 不能恢复的错误matched
- content: 

// 同 paragraph, 一部分错误处理要放到 par free text 中
paragraph-block-handler -> repeat (<par-free-text> | <basic-block>) end (])
= paragraphBlockHandler(): Result<Node>
- state: 只要向前移动了就是matched, 否则failing; 若有能恢复的错误skippable,按照括号向后跳, 不能恢复的错误matched
- content: 

par-free-text -> repeat (<multiline-blank-le-than-or-eq-1> | !<multiline-blank-ge-than-1> | <escape-char> | <reference> | <inline-formula> | <format-block> | !<other-block> | !<error-block> | <not-end>) end (!EOF | *] | \ \ | *<basic-block>)
= matchParFreeText(): Result<Node>
- state: 只要向前移动了就是matched, 否则failing; 若有能恢复的错误skippable,位置不确定, 不能恢复的错误matched
- content: 

text-block-handler -> repeat (<multiline-blank-le-than-or-eq-1> | !<multiline-blank-ge-than-1> | <escape-char> | <reference> | <inline-formula> | <format-block> | !<basic-block> | !<other-block> | !<error-block> | !(\ \) | <not-end>) end (!EOF | ])
= textBlockHandler(): Result<Node>
- state: 只要向前移动了就是matched, 否则failing; 若有能恢复的错误skippable,位置不确定, 不能恢复的错误matched
- content: 

```

```

// math

embeded-formula -> ...
formula-block-handler -> ...

formula -> 

symbols -> repeat (<symbol> | [ <symbols> | <multiline-blank-le-than-or-eq-1> | !<multiline-blank-ge-than-1> ) end (!EOF | ] | ` | / )
= matchSymbols(): Result<Node>
- state: 
- content: 

symbol -> ( repeat([A-Za-z0-9]) end (*<repeat-failing>) ) | <symbol-char> | ( ` repeat(<not-end>) end(!EOF | *` ) ` )
= matchSymbol(): Result<string>
- state: 
- content: 


symbol-char ->

// core

figure-block-handler -> <multiline-blank-le-than-or-eq-1> repeat (<single-figure> <multiline-blank-le-than-or-eq-1>) end (])
single-figure -> ` repeat (<not-end>) end (`) <skip-blank> [ <text-block-handler>

list-block-handler -> ...

table-block-handler -> ...

code-block-handler -> ...

emph-block-handler -> repeat (<multiline-blank-le-than-or-eq-1> | !<multiline-blank-ge-than-1> | <escape-char> | <reference> | <inline-formula> | !<format-block> | !<basic-block> | !<other-block> | !<error-block> | !(\ \) | <not-end>) end (!EOF | ])
= emphBlockHandler(): Result<Node>
- state: 只要向前移动了就是matched, 否则failing; 若有能恢复的错误skippable,位置不确定, 不能恢复的错误matched
- content: 


bold-block-handler -> repeat (<multiline-blank-le-than-or-eq-1> | <escape-char> | <reference> | <inline-formula> | <not-end>) end (])

italic-block-handler -> repeat (<multiline-blank-le-than-or-eq-1> | <escape-char> | <reference> | <inline-formula> | <not-end>) end (])

```

### Todos

* 更好的错误报告
* !更好的数学公式系统
* 文本标记，如emph等
* !引用系统
* block的参数
* setting系统
* !latex生成
* 自动提示、目录结构、命令列表

\frac{dx_{M}}{dt}=&x_M(r_M-\alpha_M x_M)\\
\frac{dx_{F}}{dt}=&x_F(r_F-\alpha_F x_F+D x_M)\\
\alpha_M=&\frac{I_a\tilde{\alpha}_M}{N+I_b},\quad \alpha_F=\frac{I_a\tilde{\alpha}_F}{N+I_b} \\
r_M=&\frac{2\tilde{S}}{\tilde{R}+1}, \quad r_F=\frac{2\tilde{R}\tilde{S}}{\tilde{R}+1}\\

['d'x_M]/['d't]=x_M(r_M-alpha_M x_M)
['d'x_M/'d't]=x_M(r_M-alpha_M x_M)
frac['d'x_M, 'd't]=x_M(r_M-alpha_M x_M)
alpha_M=[I_a alpha_M/N+I_b]
r_F=[2 R S / R+1]