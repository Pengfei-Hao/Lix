# Lix: 轻量级的排版系统

Lix 是一种标记语言, 同时也是一个轻量级的排版系统. 当前, 已经有许多优秀的文档排版工具. 作为一种轻量级标记语言, Markdown 语法简洁易用, 但在排版效果的精确控制上有所不足; 而 LaTeX 虽然能够生成精美的排版效果, 但其语法复杂且冗长. Lix 旨在在这两种工具之间寻找一个平衡, 在提供精细排版的同时, 保持语法清晰易用. 

Lix 提供了一套简洁易读的语法, 具有较强的表达能力, 可以简单明了地实现精确的排版效果. 同时, Lix 作为 VSCode 插件, 能够提供高效的编辑体验和直观的预览功能. Lix 的实现原理是将 Lix 代码转换为其他排版系统的代码, 如 LaTeX 或 Markdown, 从而实现较强的兼容性与扩展性. 

特别值得一提的是, Lix 的数学公式系统兼顾易读性和高效性, 能够在便捷输入的同时, 提供直观的公式预览效果. 


## 配置及运行

首先在合适的文件夹内使用
```
git clone https://github.com/Pengfei-Hao/Lix
```
克隆 git 库, 然后使用
```
npm install
```
安装所需的依赖库, 然后按 `F5` 或在 `Run and Debug` 中点击绿色箭头即可运行.

安装成功后, 在 VSCode 设置中为 `Font Family` 选项添加 `STIX Two Math` 字体 (可能需要另行下载), 并禁用 `Ambiguous Characters` 选项.

新建（或打开 `./tests/` 目录中）拓展名为 `lix` 的文件, 即可使用 Lix.

## 功能介绍

在打开 Lix 文件后, 当前页面的右上角有 3 个按钮, 从左到右分别是

* Compile: 将 Lix 文件编译并生成 PDF 文件, PDF 文件位于 Lix 文件所在的同一目录下.
* Generate: (仅用于 Debug) 将 Lix 文件编译并展示生成的 Latex 代码.
* Parse: (仅用于 Debug) 将 Lix 文档进行词法语法分析并展示语法树.

此外, 在 VSCode 的左侧还有一个 Lix 的面板, 其中有三个列表, 分别是

* Block List: 展示 Lix 中可用的所有块.
* Font List: 展示 Lix 中可用的所有字体.
* Math List: 展示 Lix 数学公式中所有可用的数学符号以及缩写.

Lix 在命令面板中有如下命令
* `Enable/Disable debug mode`: 启用 / 关闭调试模式, 调试模式开启时会自动显示语法树, 并自动跳转到光标所处位置对应的语法树节点, 并显示 LaTeX 编译面板.
* `Compile Lix file to PDF`: 功能等同于 `Compile` 按钮
* `Generate target (LaTeX, Markdown...) code`: 功能等同于 `Generate` 按钮
* `Parse the file and generate syntax tree`: 功能等同于 `Parse` 按钮

## 语法介绍

Lix 的排版是以 **块 (Block)** 为核心的, 一个 Lix 文档中是由许多块组成的, 如包含文本的 **文本块 (Text Block)**, 包含图片的 **图片块 (Figure Block)**, 包含代码的 **代码块 (Code Block)** 等等. 一些块可以嵌套在另一些块之中, 比如上述的几个块都可以嵌套在 **段落块 (Paragraph Block)** 之中, 而段落块又可以嵌套在 **文档块 (Document Block)** 之中, 换言之, 一个 Lix 文档由许多段落块以及其他块组成, 而段落又由许多文本块, 图片块, 代码块等基础块组成. 一个典型的块有如下的结构:
```
[ block-name (argument1, argument2, ...) block-content ]
```
特别地, 在 Lix 中默认使用 `[]` 作为分界符使用, 而不是其他语言中常见的 `{}`, 这是因为在文档排版中方括号的使用频率少于花括号.

接下来以一个例子来介绍 Lix 的基本用法. 更详细的用法可以参考 `./tests/` 目录下的几个文档:
* `basic-test.lix`: Lix 基本块 (pargraph, text) 的用法以及测试用例.
* `core-test.lix`: Lix 其他块 (figure, code) 的用法以及测试用例.
* `formula-test.lix`: Lix 数学公式的文档以及公式块 (formula, theorem, lemma, proof) 的用法和测试用例.
```
[title Example]
[author Lix]

[section Text and Paragraph Block]

[paragraph
[text This is a text block. This text block in contained in a paragraph block. [emph Empasize some words.] Normal words. [bold Make these words bold.]]
[text A new line of words. ]
[text New line of words again. ]
]

[paragraph
This is a text block. This text block in contained in a paragraph block. [emph Empasize some words.] Normal words. [bold Make these words bold.] \\
A new line of words. \\
New line of words again.
]

This is a text block. This text block in contained in a paragraph block. [emph Empasize some words.] Normal words. [bold Make these words bold.] \\
A new line of words. \\
New line of words again.

[section Formula and Other Block]

Inline formula.  let /𝜌(x,y) = norm [x-y]/, then /lim x→∞: sin x⁄x = 𝜌(0,0)/.

Formula block.
[formula
F = min_[x_i∊X] f(x₁,x₂,…,x_s) + [∑ i=1 to s : r_i(x_i)]
]

This is a line comment. // line comment.

This is a multiline comment.  /* comment
comment */ Amultiline comment.

Embeded comment. /* comment /* Embeded comment. */ */
```
前边提到 Lix 文档是由许多块组成的, 可以结合这个例子具体解释. 文档开头有两个块 `title` 和 `author`, 分别表示文章的标题和作者为 `Example` 以及 `Lix`. 此外, 在两个块之间的空白字符会被忽略, 也就是说这两个块可以写成下面的样子.
```
[title Example]

[author Lix]
```
或
```
[title Example][author Lix]
```
接下来是 `section` 块, 代表此处是一个章节, 章节的名字是 `Text and Paragraph Block`.

接下来的
```
[paragraph
[text This is a text block. This text block in contained in a paragraph block. [emph Empasize some words.] Normal words. [bold Make these words bold.]]
[text A new line of words. ]
[text New line of words again. ]
]
```
是一个段落块, 一个段落块内部可以包含多个文本块以及代码块, 图片块等, 此处仅以文本块举例. 此处的段落内包含三个文本块, 分别是
```
[text This is a text block. This text block in contained in a paragraph block. [emph Empasize some words.] Normal words. [bold Make these words bold.]]
```
```
[text A new line of words. ]
```
```
[text New line of words again. ]
```
在文本块内部还可以调整文本块的格式, 如使用 `emph` 块来表示强调文本 `Empasize some words.`, `bold` 块来表示加粗文本 `Make these words bold.`.


由于段落块与文本块十分常用, Lix 提供了简化书写的方式. 文本块可以去掉外层的 `[text ...]`, 直接输入文本块的内容即可. 在两个文本块之间, 可以使用 `\\` 来分隔. 如代码所示
```
[paragraph
This is a text block. This text block in contained in a paragraph block. [emph Empasize some words.] Normal words. [bold Make these words bold.] \\
A new line of words. \\
New line of words again.
]
```
上述代码还可以写成
```
[paragraph
This is a text block. ... \\
A new line of words.
[text New line of words again.]
]
```
```
[paragraph
[text This is a text block. ...]
A new line of words.
[text New line of words again.]
]
```
```
[paragraph
[text This is a text block. ...]
A new line of words. \\
New line of words again.
]
```
这两种写文本块的方式可以自由切换.

此外, 段落块也有简化的写法. 去掉外层的 `[paragraph ...]`, 直接写段落的内容即可. 在两个段落之间使用多行 (大于等于两个换行) 的空白来分隔, 而单个 (小于等于一个换行) 的空白则被当作一个空格, 这与 LaTeX 的处理方式是相同的. 段落的简化写法可以与文本块的简化写法一起使用, 如
```
This is a text block. This text block in contained in a paragraph block. [emph Empasize some words.] Normal words. [bold Make these words bold.] \\
A new line of words. \\
New line of words again.
```
```
[text This is a text block. ...]
A new line of words. \\
New line of words again.
```

接下来是下一个章节块, 不再赘述. 下面主要介绍公式块以及其他块的用法.

接下来的
```
Inline formula.  let /𝜌(x,y) = norm [x-y]/, then /lim x→∞: sin x⁄x = 𝜌(0,0)/.
```
是一个行内的公式的例子. 行内公式可以放在文本块内部, 使用两个反斜线 `/ ... /` 包围. 在公式内部可以直接输入 Unicode 字符来使用对应的数学符号, 十分直观. Unicode 字符可以由 VSCode 的自动补全直接输入.

```
Formula block.
[formula
F = min_[x_i∊X] f(x₁,x₂,…,x_s) + [∑ i=1 to s : r_i(x_i)]
]
```
是公式块, 它代表一个行间公式. 公式的输入与行内公式完全相同.

下面是注释的例子.
```
This is a line comment. // line comment.

This is a multiline comment.  /* comment
comment */ Amultiline comment.

Embeded comment. /* comment /* Embeded comment. */ */
```
Lix 支持单行以及多行注释, 分别使用 `// ...` 以及 `/* ... */`, 特别地, 多行注释可以嵌套, 如上所示.

## 文档

Lix 详细的开发文档可以参阅 `Lix Document.md`, 其中包含了本项目的架构设计, 代码规范等; 关于语法分析, 词法分析的部分可以参考 `Lix Grammers.md`, 其中包含了 Lix 的文法, 以及对应的实现细节; 关于 Lix 的使用文档可以参考 `./tests/` 中的 `basic-test.lix`, `core-test.lix`, `formula-test.lix`, 前文已有介绍.

## License

Copyright (c) Pengfei Hao. All rights reserved.

Licensed under the [MIT](https://github.com/Pengfei-Hao/Lix/blob/main/LICENSE.txt) license.