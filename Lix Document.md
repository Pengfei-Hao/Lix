# Lix Document

## Basic Concepts

一个Lix文档由一系列 block 组成,这些block沿垂直方向从上到下依次排列,组成文档的基本布局.Block可以嵌套子block.下面是几种基本的块:

* Text block: 文本块代表了一行文本, 也就是说里面不能含有换行以及其他影响文本结构的内容, 这个块会自动适应页面的尺寸.文本块中还可以包含行内数学公式,以及引用,如下
  * Words: 纯文本
  * Inline-formula: / ... / 行内数学公式
  * Reference: @ ... 引用
  * Format: [emph ... ]  强调
  * Escape char: \... 转义字符
* Formula block: 公式块包含一行或多行的数学公式,并且占据一行空间.
* Figure block: 图片块可以容纳一张或多张图片，并且占据一行空间.
* List block: 列表块包含一列编号或无编号的列表项,占据一行空间.
* Table block: 表格块包含一个表格,占据一行空间.
* Code block: 代码块包含一段代码,占据一行空间.

以及负责组织文档结构的块:

* Paragraph block: 逻辑上的一段文字,可以包含数行文字,图标,公式等,以一个或多个基本块为子节点.
* Document block: 根节点,是所有block的容器.任意block都可以作为他的子节点.

Lix还负责交叉引用. 某些block可以设置一个计数器,以及标签,可以通过 Reference: @ ... 来进行引用.

在Lix中,在block以外还可以插入设置语句,负责配置文档的各种参数.使用如下的语句:

* Setting Statement: 设置语句.

Lix 中的注释有以下两种:

* 行注释: // ...
* 多行注释: /* ... */

block 还负责组织文章的结构, 如上面提到的 paragraph, document. 负责文章结构的Block可以由Lix Template自行定义,下面列举几个例子.
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

在 Lix 中使用方括号 [] 来代替其他编程语言中常见的 {}, 在Lix中的block的语法如下:

[block_name ...]

不需要显式写document block. 为了书写方便,在正文有一些关于text block和paragraph block的语法糖,使用空格和换行来代替[], 以便于编辑.

在lix正文中(也就是不进入任何block时)以及在text block和paragraph block中,空白分为两种,一种相当于空格(整段空白换行数小于等于1),另一种相当于换行(换行数大于1),其中//注释相当于一个换行,而 /* */注释相当于一个空格. 正文的解析采用排除法,即只要没有进入block就认为是text block, 在这些文本中又由上边的第二种空白分割出了paragraph block. 此外在正文中还可能存在setting语句和转义字符以及行内数学公式.

在进入block之后,应该按照block规定的语法进行解读.

### Basic Notations

下面是一些基本的记号.

EOF : 文件结束标记
[abcdefg] : 从括号中选择一个匹配
() : 小括号表示运算优先级
+ : 表示参数

NULL : 未匹配标记
! : 表示匹配错误, 匹配到该项后要报错
* : 匹配退回标记, 匹配到该项后要退回

下面介绍Lix文法的规则. 一个产生式如下所示

name -> token token ...

其中token可以是 |, repeat end, 符号, 或上述记号中的一种. 一个产生式对应一个match函数, 如 XXX 产生式对应 matchXXX, match 函数的要求见下节. 同时为了辅助匹配过程, 还有一类 is 函数, 要求同样见下节. 通过嵌套的调用这些match函数, 就可以实现文法的解析.

### 'match' and 'is' Function

在 Parser 中有 index 变量用来指示当前读取到的位置, 有 move 和 curChar 函数用来操控 index 和读取当前的字符.

#### match

match 函数负责如下几个部分的工作:

* parser的上下文信息
  * 调整index
  * parser中的node堆栈信息(begin和end)
* 构造result
  * 维护state
  * 构造content信息
    * type, content, children
    * range: begin, end
  * 维护附加信息messages和highlight

下面逐一讲解上面的要求. match函数的基本格式:

match 函数不接受参数, 返回 Result<Node> 类型, 同时 index的范围在[0, length]中, 特别是index=length时不能崩溃.

**维护state**

下面是对返回的state的要求.

对于|运算的match, 如果能完整的匹配到产生式中的各个项, 则状态为successful; 

如果不能完整匹配但能通过某些结构特点或字符来界定这个产生式的结束位置, 则可以"跳过"这个产生式, 继续进行后续的分析, 并将状态设置为skippable; 撞到eof也设为skippable

如果不能完整匹配且无法界定结束为止, 但是可以根据某些结构特点, 如前导字符等等, 来确定出后面的内容属于这个产生式, 则返回match状态; 

如果界定出不属于或者无法界定, 则匹配失败, 状态设为failing.

对于非|运算的match, 如果能完整的匹配到产生式中的各个项, 则状态为successful; 如果不能完整匹配但能通过某些结构特点或字符来界定这个产生式的结束位置, 则可以"跳过"这个产生式, 继续进行后续的分析, 并将状态设置为skippable; 如果不能完整匹配且无法界定结束为止, 则匹配失败, 状态设为failing.

也就是说 | 运算的matched 和 failing 是对 非 | 运算的 failing 进行更细致的分割. result 的 shouldTerminate 定义为 failing || matched.

对于 | 运算 match 来说, result 的 matched 定义为 matched || skippable || successful.

**调整index**

对于|运算的match, match 函数从当前的 index 开始向后匹配, 如果state是 successful 则停止在该 match 匹配到的语法完成后的下一个位置, 若是 skippable 则停止在吃掉错误后的下一个位置, 若是 matched 则停在随机位置, 若是 failing 则停在原位.

对于非|运算的match, match 函数从当前的 index 开始向后匹配, 如果结果是 successful 则停止在该 match 匹配到的语法完成后的下一个位置, 若是 skippable 则停止在吃掉错误后的下一个位置, 若是 failing 则停在原位.

**node堆栈信息**

每次进入match函数后调用begin函数, 退出match函数后调用end函数, 这个功能通过 match 调用myMatch来实现. 堆栈名字应该与产生式节点同名.

**维护附加信息**

在适当的时候添加语法高亮和报错信息.
语法高亮

**维护content**

适当的时候添加 type, content, children,
content 的range信息应当恰好包含所有的内容, 即如果有[...]应当不包含括号.

#### is

is 函数的默认行为:

仅|运算的match有相应的 is 函数, 该函数要求如下

* 不接受参数, 返回boolean, index 位于[0,length]之间, 注意处理eof
* is函数工作方式相当于同名的 match 函数, 并且在匹配完成后回退 index, 但是只要得到的 state 为 matched 及以上就为 true, 否则为 false. is 函数适用于或运算匹配 end 标签中加 * 的部分.

is 函数使用方式:
if(this.is(XXX)) {
  ...
}

is函数不产生任何影响,故无需处理

### Result Structure

**state**

在匹配的过程中有以下几个状态:

successful: match 过程中未发现错误, 并且完整匹配到了产生式中的所有项
skippable: match 过程中虽然有错误但是可以跳过, 不会影响对后续文档进行分析, 方便跳过错误继续分析
matched: 此状态仅应在 | 运算中参与的产生式中使用, 表示能确保是这个分支但是出现了不可跳过的错误, 同时所有参与 | 运算的产生式应当两两不相交.
failing: 此状态在 | 运算中表示能确认不是此分支, 在其他地方表示出现了不可跳过的错误.

使用state字段代表如上四个状态.

在match函数中进行匹配时,如果不在|运算的分支中, 成功则使用successful状态; 如果出现可跳过的错误, 使用skippable; 如果出现不可跳过的错误或无法匹配, 使用failing. 如果在|运算的分支中, successful和skippable的含义相同, 但如果能确保是这个分支但出现了不可跳过的错误使用 matched, 同时要保证或运算的各个分支是相互独立的, 也就是有且仅有一个分支可能为真, 同时所有分支的并集要尽可能大, 以保证更强的鲁棒性; 如果确定不是这个分支, 比如引导的符号错误, 则使用failing.


**content**

match 的结果.

**messages**

信息, 包括错误, 警告,和一般信息.

**highlights**

语法高亮信息


### Matching Process: Sequential

上面已经阐述了对match 函数的具体要求, 接下来具体实现match函数.

match 函数的基本模式是顺序匹配, 按照从左到右的顺序挨个匹配, 即从文本中读取一个token(可以为终结符号或者产生式), 然后合并到原有的结果上, 如果结果为 successful 或者 skippable, 则继续match过程; 否则中止match过程并且报错.

#### 准备阶段

* 记录当前的index为preIndex, 用于state 为failing时恢复.
* node 堆栈begin
* state 设为failing
* new Node
* node 的range begin 设为当前的index.

```
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
```

#### 匹配阶段

只有 index, state, node, message, highlights需要手动调整,
mergeState函数仅处理state,

&&& 表示 merge + match 可以做到的事情


* &&& 处理 index
* 生成 node
* &&& 合并 state
  * 如果shouldTerminate需要返回
    * 合适的时候 promoteToSkippable
* &&& 合并 message
  * 添加新的 msg
* &&& 合并 highlights
  * 添加新的 hlt
* |函数需要在合适的时候GuaranteeMatched


**state处理**

state采用逐步合并的方式, 初始时的state为failing, 每match到一个term后就将该term的state合并到原有的state上. 注意在这个过程中只能使用非|运算的match, 也就是说state只有failing,skippable,successful三种. 在状态为 failing时应当结束match, 其余状态可以继续match. 

对于match函数本身是一个非|函数的情况, state合并的规则如下:

f + s = s, f + sk = sk, f + f = f (end). 本行用于从初始状态第一次匹配时状态从 f 转换到其他状态

s + s = s, s + sk = sk, s + f = f (end);
sk + s = sk, sk + sk = sk, sk + f = f (end).
这行用于正常匹配时继续向后匹配的状态合并

以及 promote: f + sk = sk 用于skip.

对于match函数是一个|函数的情况, state合并规则如下:

f + s = s, f + sk = sk, f + f = f (end). 本行用于从初始状态第一次匹配时状态从 f 转换到其他状态

s + s = s, s + sk = sk, s + f = f (end);
sk + s = sk, sk + sk = sk, sk + f = f (end).
这行用于正常匹配时继续向后匹配的状态合并.

以及 promote: f + m = m 用于实现matched.

也就是说, 在match失败返回时, 可以根据设定好的规则(如遇到前导字符)人为地将failing提升为matched.


完整版如下:

f + s = s, f + sk = sk, f + m = f(end), f + f = f (end);
s + s = s, s + sk = sk,  s + m = f(end), s + f = f (end);
sk + s = sk, sk + sk = sk,  sk + m = f(end), sk + f = f (end);
promote: f + sk = sk, f + m = m

其余操作均非法.

**终结符号**

如果match的这一项为终结符号,如某个字符, blank 写法如下:

result.merge(this.match("xxx"));
if (result.shouldTerminate) {
  msg.push(this.getMessage("xxx"));

  // 如果需要skippable写在这
  // 向后skip的代码
  result.promote(ResultState.skippable);

  // 如果能够判断出matched
  result.promote(ResultState.matched);

  return;
}
node...content...children
highlight...
guarantee...


result.merge(this.skipBlank()); // skipBlank 不会出failing而无需判断

**非终结符号**

如果match的这一项为非终结符号,如其他的产生式等,写法如下:

let res = this.matchXXX();
result.merge(res);
if (result.shouldTerminate) {
    // 不需要错误信息, 因为 res 中已经有错误信息了.

    // 一般不需要skip
    return;
}
node...content...children
highlight...
guarantee...

#### 结束阶段

* 如果state 为failing则恢复index
* node堆栈end
* node 的range end 设为 当前index


### | 运算

| 是或运算, 按照从左到右的顺序依次匹配, 直到第一个成功后就不再匹配.

state 的处理: 如果某个标签 state 为 matched, skippable, successful 则停止匹配, 运算结果为该标签的结果; 若没有标签为上述三个, 则运算结果为 failing; 然后将该结果合并到原来的结果上.

为了兼容|运算, 需要添加几个运算规则来兼容matched状态

f + m = f(end), sk + m = f(end), s + m = f(end)
promote: f + m = m

这种手段的目的是保证matched状态只在返回failing的时候被创造出来,然后在|运算后的merge中被消除, 保证运行流程中不出现matched.

对应的代码:
```
let res: Result<Node>;

if ((res = this.matchXXX()).matched) { // Matched
    result.merge(res);
    if (result.shouldTerminate) {
      msg.push(this.getMessage("xxx"));

      // 如果需要skippable写在这
      // 向后skip的代码
      result.promote(ResultState.skippable);
      return;

      // 如果能够判断出matched
      result.promote(ResultState.matched);
      return;
    }
    node...content...children
    highlight...
}
else if ((res = this.matchXXX()).matched) { // Error
    msg.push(this.getMessage("xxx"));
    result.mergeState(ResultState.failing);
    
    // 不严重的错误 skip
    // 向后skip的代码
    result.promote(ResultState.skippable);
    return;

    // 如果能够判断出matched
    result.promote(ResultState.matched);
    return;
    
    --------
    // 严重的错误 fail
    return;
}
...
else { // None // failed
    msg.push(this.getMessage("xxx"));
    result.mergeState(ResultState.failing);

    // 如果需要skippable写在这
    // 向后skip的代码
    result.promote(ResultState.skippable);
    return;

    // 如果能够判断出matched
    result.promote(ResultState.matched);
    return;

}
```

对于match开销较大的函数, 其对应的is函数可以仅仅匹配到满足match条件的地方;对于多个分支有可以复用的is函数,可以写成有返回值的is函数,根据返回值确定是哪一个分支.

```
if (isXXX()) { 
    let res = matchXXX();
    result.merge(res);
    if (result.shouldTerminate) {
      msg.push(this.getMessage("xxx"));

      // 如果需要skippable写在这
      // 向后skip的代码
      result.promote(ResultState.skippable);
      return;

      // 如果能够判断出matched
      result.promote(ResultState.matched);
      return;
    }
    node...content...children
    highlight...
}

if (isXXX()) { 
    move(xxx);
    mergeState(xxx);

    if (result.shouldTerminate) {
      msg.push(this.getMessage("xxx"));

      // 如果需要skippable写在这
      // 向后skip的代码
      result.promote(ResultState.skippable);
      return;

      // 如果能够判断出matched
      result.promote(ResultState.matched);
      return;
    }
    node...content...children
    highlight...
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
repeat end 内部相当于一个或运算, 每次选出一个元素合并到 state 即可. 此外加 * 的 end 标签不合并, 上述三种状态见代码. 注意repeat 至少合并一项才是successful, 否则比如只有一个*<xx>是failing.

对应的代码:

**直到结束**
```
repeat (<cond1> | <cond2> | <not-end>) end (<end1> | <end2>)

while(true) {
  // 判断 end 标签
  if (isEOF()) { mergeState(failing); message; return; } // 无论 end 中是否有 EOF 都要判断, 且如果没有 EOF 要报错, 并合并状态
  else if ((res = matchXXX()).matched) { merge(res); if(shouldTerminate) {message; skip, match; return;} node...; highlights...; break; } // 不加 * 的 end 标签要合并 state
  else if (isXXX()) { break; }

  // 判断 repeat 标签
  else if ((res = matchXXX()).matched) { merge(res); if(shouldTerminate) {message; skip, match; return;} node...; highlights...; } // 要合并 state
  ...
  else { mergeState(successful); this.move(); node..., highlight...} //合并 successful
}
```

**直到匹配失败**
```
repeat (<cond1> | <cond2>) end (<end1> | <end2> | *<repeat-failing>)

while(true) {
  // 判断 EOF 标签
  if (EOF) { break; } // 无论 end 中是否有 EOF 都要判断, 但不需要报错
  else if ((res = matchXXX()).matched) { merge(res); if(shouldTerminate) {message; skip, match; return;} node...; highlights...; break; } // 不加 * 的 end 标签要合并 state
  else if (isXXX()) { break; }

  // 判断 repeat 标签
  else if ((res = matchXXX()).matched) { merge(res); if(shouldTerminate) {message; skip, match; return;} node...; highlights...; } // 要合并 state
  ...
  else { break; } // <repeat-failing>
}
```

**模式匹配**
```
repeat (<cond1> | <cond2>) end (<end1> | <end2>)

while(true) {
  // 判断 end 标签
  if (EOF) { mergeState(failing); message; return; } // 无论 end 中是否有 EOF 都要判断, 且如果没有 EOF 要报错
  else if ((res = matchXXX()).matched) { merge(res); if(shouldTerminate) {message; skip, match; return;} node...; highlights...; break; } // 不加 * 的 end 标签要合并 state
  else if (isXXX()) { break; }

  // 判断 repeat 标签
  else if ((res = matchXXX()).matched) { merge(res); if(shouldTerminate) {message; skip, match; return;} node...; highlights...; } // 要合并 state
  ...
  else { mergeState(failing); message; skip, match; return; } // 不匹配, 报错
}
```

### Paragraph & Text Block

### Formula Block

formula 部分会经历两次分析, 第一次是词法分析, 第二次是语法分析.

在词法分析过程中, 有以下几类节点

* formula: 数学公式的根结点, 也是公式中被括号[]括起来的部分的节点类型.
* element: 公式中可以由字母组合和符号组成, 分别称为 notations 和 symbols, 例如 notations: lim, in, leq ...; symbols: * / - ↔ 𝒴 ..., 可以包含 unicode 符号. notations 和 symbols 统称为 elements.
* inline-text: 公式中还可以包含文字
* defination: 公式中还可以手工定义符号, 此节点仅允许出现在第一级formula 后.

在随后的语法分析过程中, 有一下几类节点

* expression: 表达式, 等同于formula
* element: 等同于element
* prefix: 前缀运算符
* infix: 中缀运算符

### Rules

**Foundation**

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

**Core**

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
free-text -> repeat (<multiline-blank-le-than-or-eq-1> | <escape-char> | <reference> | <inline-formula> | <format-block> | <not-end>) end (*EOF | *<multiline-blank-ge-than-1> | \ \ | *<other-block> | *<basic-block> | *#)
= matchFreeText(): Result<Node>
- state: 只要向前移动了就是matched, 否则failing; 若有能恢复的错误skippable,位置不确定, 不能恢复的错误matched
- content: 


// 同 paragraph, 一部分错误处理要放到 par free text 中
paragraph-block-handler -> repeat (<par-free-text> | <basic-block> | !<other-block>) end (!EOF | ])
= paragraphBlockHandler(): Result<Node>
- state: 只要向前移动了就是matched, 否则failing; 若有能恢复的错误skippable,按照括号向后跳, 不能恢复的错误matched
- content: 

par-free-text -> repeat (<multiline-blank-le-than-or-eq-1> | !<multiline-blank-ge-than-1> | <escape-char> | <reference> | <inline-formula> | <format-block> | <not-end>) end (*EOF | *] | \ \ | *<basic-block> | *<other-block>)
= matchParFreeText(): Result<Node>
- state: 只要向前移动了就是matched, 否则failing; 若有能恢复的错误skippable,位置不确定, 不能恢复的错误matched
- content: 


text-block-handler -> repeat (<multiline-blank-le-than-or-eq-1> | !<multiline-blank-ge-than-1> | <escape-char> | <reference> | <inline-formula> | <format-block> | !<basic-block> | !<other-block> | !<error-block> | !(\ \) | <not-end>) end (!EOF | ])
= textBlockHandler(): Result<Node>
- state: 只要向前移动了就是matched, 否则failing; 若有能恢复的错误skippable,位置不确定, 不能恢复的错误matched
- content: 

```

**math**

```



formula -> 

elements -> repeat (<element> | [ <elements> | <multiline-blank-le-than-or-eq-1> | !<multiline-blank-ge-than-1> ) end (!EOF | ] | ` | / )
= matchElements(): Result<Node>
- state: 
- content: 

element -> ( repeat([A-Za-z0-9]) end (*<repeat-failing>) ) | <element-char> | ( ` repeat(<not-end>) end(!EOF | *` ) ` )
= matchelement(): Result<string>
- state: 
- content: 

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

**other**

```

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
* ! 更好的数学公式系统
* 文本标记，如emph等
* ! 引用系统
* block的参数
* setting系统
* ! latex生成
* 自动提示、目录结构、命令列表
