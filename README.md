# Lix 文档

Lix 开发的目的在于简化 Latex 的复杂语法并且尽可能的保留 Latex 的排版能力，并且提供更直观易读的源文件。

* 页面设置：页边距
* 自定义指令
* 字体：字体、字号、字形（粗体、斜体）


计划采用 环境+标签 的模式，类似于html+css

# 配置及编译

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