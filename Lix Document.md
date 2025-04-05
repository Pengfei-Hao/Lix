# Lix Document

## 架构设计

本节主要介绍整个工程的目录结构以及代码的组织结构.

以下是工程的目录结构:
* `./config`: Lix 的所有配置文件.
* `./language`: VSCode 语言相关的配置文件.
* `./syntaxes`: VSCode 语法相关的配置文件.
* `./icons`: 图标文件.
* `./src`: Lix 源代码.
* `./tests`: 所有的测试文件.
* `./package.json`: VSCode Extension 配置文件.
* `./tsconfig.json`: TypeScript 配置文件.
* `./LICENSE.txt`: License 文件.
* `./README.md`: README.
* `./Lix Document.md`: Lix 代码文档.
* `./Lix Grammers.md`: Lix 语法部分文档.

下面介绍 Lix 代码的组织结构. Lix 所有代码均位于 `./src` 目录内, 所有的目录和文件可以分为下面两部分:
* VSCode 相关部分
  * `extension.ts`: Lix 的入口, 初始化 VSCode 插件以及其他环境.
  * `extension`: 所有与 VSCode Extension 相关的实现, 如各种 Provider, 文件操作, 配置文件, UI 实现等.
* Lix 编译器部分
  * `foundation`: 一些重要的数据结构, 如 Heap, Result, Message 等编译器需要的数据结构.
  * `sytnax-tree`: 语法树节点的数据结构, 以及相关的类型.
  * `compiler`: 编译器相关的部分, 以及相关的类型.
  * `generator`: 生成器部分, 将语法树转换为对应的 LaTeX, Markdown 代码.
  * `parser`: 词法分析部分, 语法分析部分, 将文本解析为语法树.

## Basic Concepts

一个 Lix 文档由一系列 block 组成,这些 block 沿垂直方向从上到下依次排列, 组成文档的基本布局. block 可以嵌套子 block.下面是几种基本的块:

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

## Todos

* 更好的错误报告
* ! 更好的数学公式系统
* 文本标记，如emph等
* ! 引用系统
* block的参数
* setting系统
* ! latex生成
* 自动提示、目录结构、命令列表
