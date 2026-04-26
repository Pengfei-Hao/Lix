# Lix Grammers

在本文中主要讲解 Lix 语法解析部分的实现. 语法部分的设计以及使用可以参考 `Lix Document.md`, 本文重点关注实现细节.

本文首先给出语法的产生式以及相关记号, 然后详细介绍代码实现的细节, 本文主要对应 `src/parser` 中的代码部分.

下面给出 Lix 所有语法的产生式.

## Notation

首先介绍本文用到的产生式的写法. 一个产生式如下所示
```
name → token ...
```
其中 token 可以是
* 终结符号 : 用 \*\* 包裹, 如 **//**, **block**.
* 非终结符号 : 直接写名称即可, 如 document, string. 
* EOF : 文件结束标记, 直接写出.
* 正则表达式 : 使用极少, 主要用于给出名称, 数字等字母组成.
* NULL : 未匹配标记, 一般用于或运算中.

在本文中还有以下运算
* | 运算 : 或运算, 只要匹配到其中一个即可, 如 `symbol | **&**`.
* ? 运算 : 表示匹配 0 次或 1 次.
* \+ 运算 : 表示匹配 1 次或多次.
* \* 运算 : 表示匹配 0 次或多次.
* ^ 运算 : 取反, 不匹配后边的符号.
* ! 运算 : 表示匹配到该项后要报错.

下面给出 Lix 各部分的文法.

## Translate

本节介绍上述产生式翻译到代码的标准形式, 以及一些注意事项.

终结符号/非终结符号:
```
result.merge(skipBlank());
---
let res = result.merge(matchXxx());
if (result.shouldStop) {
  /* message, node */
  /* promote */
  return;
}
/* highlights, message, node, file, reference */
```
| 运算:
```
if (isXxx()) {
  let res = result.merge(matchXxx());
  if (result.shouldStop) {
    return;
  }
  /* highlights, message, node, file, reference */
}
else if((res = matchXxx()).matched) {
  result.merge(res);
  if (result.shouldStop) {
    return;
  }
  /* highlights, message, node, file, reference */
}
else {
  /* message, node */
  /* 注意, else 必须要写, 如果是 token | NULL 就merge successful, 否则 merge failed 并 return. */
}
```
? + * ^ 运算:
```
token? = token | NULL
token+ = token token*
token* = (token token*) | NULL
---
/* ? 转换成 | */
---
/* + 转换为 * */
---
/* * 转换为 while 和 |; | 的 else 直接 break; ^ 转换为 is, 如果进入分支就 break; 有 ^ 时要判断 ^EOF; ^ 如果还剩 else 直接报 error */
```
! 标记:
```
/* 匹配到后直接 merge failed 报错并 return; 或 recover 恢复到 skippable */
```

## Foundation

本节给出最基础的词法符号的产生式, 如名称, 换行, 空白, 注释等.

name → [A-Za-z0-9-]
nameWithHyphen → [A-Za-z0-9-]+
newline → [\r\n]
blankchar → [\t \v\f]
digit → [0-9]

### 名字和常数

nameWithHyphen → ( **A** | ... | **Z** | **a** | ... | **z** | **0** | ... | **9** | **-** )+

string → raw-string-1 | raw-string-2 | raw-string-3

raw-string-1 → **"** (^**"** ^EOF | !newline)* **"**

raw-string-2 → **'** (^**'** ^EOF | !newline)* **'**

raw-string-3 → **\`** (^**\`** ^EOF | !newline)* **\`**

number → ( **+** | **-** | NULL ) digit+ ( **.** digit* | NULL ) skip-blank ( **%** | **px** | **em** | **cm** | NULL )

### 换行和空白

singleline-comment → **//** (^newline ^EOF)*

multiline-comment → **/\*** (^**\*/** ^EOF | multiline-comment)* **\*/**

singleline-blank → singleline-comment | ((blank | multiline-comment)+ singleline-comment?)

multiline-blank → (blank | newline | singleline-comment | multiline-comment)+

multiline-blank-leq-1 → /* multiline-blank */
multiline-blank-gt-1 → /* multiline-blank */

skip-blank → singleline-blank | NULL

skip-multiline-blank → multiline-blank | NULL

## Core (Document & Command & Block)

本部分给出 Lix 基础功能的产生式, 包括 document, command, block 的基本处理.

有三类可以自定义的元素
* command: 与 structural block 和 free paragraph 平级
* insertion: 位于 text 内部, 与 words 平级
* block: 可以分种类添加 block
注意 command 和 insertion 需要吃掉前导符号, 如果 match 失败直接报 error; block 前后方括号都不要吃掉; 三类元素均不能有 matched 状态; 三类元素遇到多行换行要结束; 名称 name-command-handler, name-insertion-handler, name-block-handler; (暂不用, block 需要停在 \], EOF, 多行换行前)

// 根据 free paragraph 的讨论, 只会剩下下面的四种情况

document → (command | free-paragraph | multiline-blank-gt-1 | structural-block | !subblock-block)* EOF

### Command 部分

command → setting-command /* customized */

### Block 部分

argument → (**@** skip-blank nameWithHyphen) | ( nameWithHyphen (skip-blank **:** skip-blank (nameWithHyphen | string | number))? )

arguments → skip-blank ( 
  **(** skip-blank ((argument skip-blank (**,** skip-blank argument skip-blank)*) | NULL) **)**
  ) | **:** | NULL

block → **[** skip-blank nameWithHyphen skip-blank arguments name-block-handler **]**

structural-block → paragraph-block

basic-block → text-block | formula-block | figure-block | list-block | table-block | code-block

format-block → emph-block | bold-block | italic-block

subblock-block → item-block

invalid-block → /* blocks except from above */

## Paragraph & Text & Other

本部分给出 paragraph 块, text 块, setting 命令, reference 插入及其简略写法的产生式.

### Paragraph & Text 部分

escape-char → **\\** (**\[** | **\]** | **\(** | **\)** | **#** | **@** | **/**)

embedment → **\\\\**

insertion → reference-insertion

text-insertion → 

// free-text 只会剩下 multiline-blank-gt-1, structural-block, basic-block, subblock-block, command, EOF 因此处理后只剩 structural-block, subblock-block, command, EOF

free-paragraph → (free-text | basic-block | embedment)+

// insertion 要放到 blank 之后, 因为注释和 formula 的前缀都是 /, escape char 和 \\ 会冲突

free-text → (^multiline-blank-gt-1 ^structural-block ^basic-block ^subblock-block ^command ^embedment ^EOF | multiline-blank-leq-1 | escape-char | insertion | format-block | !invalid-block)+

par-free-text → (^multiline-blank-gt-1 ^structural-block ^basic-block ^subblock-block ^embedment ^**\]** ^EOF | multiline-blank-leq-1 | escape-char | insertion | format-block | !invalid-block)+

### Block 部分

// 在 par free text 中处理后只会剩下 
multiline-blank-gt-1, structural-block, basic-block, subblock-block, **\]**, embedment, EOF

paragraph-block-handler → (par-free-text | basic-block | embedment | !multiline-blank-gt-1 | !structural-block | !subblock-block)*

text-block-handler → (^multiline-blank-gt-1 ^**\]** ^EOF | !structural-block | !basic-block | !subblock-block | multiline-blank-leq-1 | escape-char | insertion | format-block | !invalid-block)*

### Custom Block 部分

subblock-like-block-handler → ( multiline-blank-leq-1 | allowed-block | !disallowed-block )*

format-like-block-handler → 
(^multiline-blank-gt-1 ^**\]** ^EOF | !block | multiline-blank-leq-1 | escape-char | !text-insertion | insertion | !invalid-block)*

text-like-block-handler → (^multiline-blank-gt-1 ^**\]** ^EOF | multiline-blank-leq-1 | escape-char | insertion | allowed-block | !disallowed-block | !invalid-block)*

paragraph-like-block-handler → (par-free-text | embedment | !multiline-blank-gt-1 | allowed-block | !disallowed-block )*

multi-paragraph-like-block-handler → ( free-paragraph | multiline-blank-gt-1 | structural-block | !subblock-block)*

// 自定义 end, border

par-free-like-text → end | (
(^multiline-blank-gt-1 ^structural-block ^basic-block ^subblock-block ^border ^end ^EOF | multiline-blank-leq-1 | escape-char | insertion | format-block)+ end?
)





### Setting 部分

setting-command-handler → **#** skip-blank nameWithHyphen skip-blank **:** (^newline ^EOF)*

### Insertion 部分

reference-insertion → **@** skip-blank nameWithHyphen skip-blank **;**?

## Core

format 部分

emph-block-handler → /* format-like-block-handler */

bold-block-handler → /* format-like-block-handler */

italic-block-handler → /* format-like-block-handler */

insertion 部分

code-insertion-handler → ((**\`** (**\^**)+ **\`**) (^pattern ^multiline-blank-gt-1 ^EOF)* pattern) | (**\`** (^**\`** ^multiline-blank-gt-1 ^EOF)* **\`**)

figure 部分

figure-block-handler → (image-block | caption-block | !block | multiline-blank-leq-1)*

image-block-handler → /* format-like-block-handler */

caption-block-handler → /* format-like-block-handler */

code 部分

code-block-handler → (skip-multiline-blank (**\`** (**\^**)+ **\`**) (^pattern ^EOF)* pattern skip-multiline-blank) | (skip-multiline-blank **\`** (^**\`** ^EOF)* **\`** skip-multiline-blank) | ((^**\]** ^EOF)*)

list 部分

list-block-handler → (item | free-item | !structural-block | !subblock-block)*

item-block-handler → /* paragraph-like-block-handler */

// 还剩 multiline-blank-gt-1, structural-block, subblock-block, **\]**, EOF 待处理

free-item → ( **\***+ (list-free-text | basic-block)* ) | ( (list-free-text | basic-block)+ )

list-free-text → **\\\\** | (
(^multiline-blank-gt-1 ^structural-block ^basic-block ^subblock-block ^**\]** ^**\*** ^**\\\\** ^EOF | multiline-blank-leq-1 | escape-char | insertion | format-block)+ **\\\\**?
)

table 部分

table-block-handler → (cell | free-cell | **&** | **;** | !structural-block | !subblock-block)*

cell-block-handler → /* paragraph-like-block-handler */

// 还剩 multiline-blank-gt-1, structural-block, subblock-block, **\]**, **&**, **;**, EOF 待处理

free-cell → (table-free-text | basic-block)+

table-free-text → **\\\\** | (
(^multiline-blank-gt-1 ^structural-block ^basic-block ^subblock-block ^**\]** ^**&** ^**;** ^**\\\\** ^EOF | multiline-blank-leq-1 | escape-char | insertion | format-block)+ **\\\\**?
)

## Math

parse 部分

formula-block-handler → formula

formula-insertion-handler → **/** formula **/**

formula → (^end ^multiline-blank-gt-1 ^EOF | multiline-blank-leq-1 | escape-element | (**\[** formula **\]**) | inline-text | operator-text | element | !other)*

element → notation | symbol

notation → name /* defined in math.json */

symbol → /* defined in math.json */

inline-text → raw-inline-text-1

operator-text → raw-inline-text-2

raw-inline-text-1 → **"** (^**"** ^EOF | !newline)* **"**

raw-inline-text-2 → **\`** (^**\`** ^EOF | !newline)* **\`**

escape-element → (**@** element) | (**\\** element)

analyse 部分

// parse 后的 formula 节点子节点类型可能为 formula, escape-element, element, inline-text, operator-text

// formula 分析后为 infix, prefix, matrix, element, inline-text, operator-text

formula → matrix | sub-formula /* 进入 children 中 */


// matrix 分析后为 matrix

matrix → (sub-formula (**&** | **;**)?)*

// sub-formula 分析后为 infix, prefix, element, inline-text, operator-text

sub-formula → (^end | term | operator)*

// term 分析后为 prefix, postfix, element, inline-text, operator-text

term → (formula | inline-text | operator-text | prefix | element | escape-element) postfix*

// operator 分析后为 infix

operator → infix

// 三种表达式子节点中类型与 formula 相同

prefix → /* element 中的自定义类型 */

infix → /* element 中的自定义类型 */

postfix → /* element 中的自定义类型 */

## Article

document 部分

title-block-handler → /* format-like-block-handler */

author-block-handler → /* format-like-block-handler */

date-block-handler → /* format-like-block-handler */

section-block-handler → /* format-like-block-handler */

subsection-block-handler → /* format-like-block-handler */

subsubsection-block-handler → /* format-like-block-handler */

tableofcontents-block-handler → /* format-like-block-handler */

newpage-block-handler → /* format-like-block-handler */

bibliography 部分

bibliography-block-handler → (bib-item-block | !block | multiline-blank-leq-1)*

bib-item-block-handler → /* text-like-block-handler */


math 部分

definition-block-handler → /* paragraph-like-block-handler */

lemma-block-handler → /* paragraph-like-block-handler */

proposition-block-handler → /* paragraph-like-block-handler */

theorem-block-handler → /* paragraph-like-block-handler */

proof-block-handler → /* paragraph-like-block-handler */

corollary-block-handler → /* paragraph-like-block-handler */
