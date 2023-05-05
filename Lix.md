# Lix 文档

Lix 开发的目的在于简化 Latex 的复杂语法并且尽可能的保留 Latex 的排版能力，并且提供更直观易读的源文件。

* 页面设置：页边距
* 自定义指令
* 字体：字体、字号、字形（粗体、斜体）


计划采用 环境+标签 的模式，类似于html+css

# Syntax
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