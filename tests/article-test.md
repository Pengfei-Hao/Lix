# Article Test

Author: Lix

Date: 2025.10.7

本文是文章模块的测试文档, 同时也是一份教学手册. 本文档展示了标题作者日期, 章节, 目录, 参考文献, 数学环境等块的用法.



## 标题作者日期

标题作者日期使用 `[title ...]`, `[author ...]`, `[date ...]` 插入, 例如

```
[title Article Test]
[author Lix]
[date 2025.10.7]

```

效果见本文开头.

## 章节目录

章节使用 `[section ...]`, `[subsection ...]`, `[subsubsection ...]` 插入, 例如

```
[subsection 小节]
[subsubsection 小小节]
[subsection 另一小节]

```

### 小节

#### 小小节

### 另一小节

目录使用 `[tableofcontents]`, 例如

```
[tableofcontents]

```

效果见开头. 新页使用 `[newpage]`, 例如

```
[newpage]

```



新建一页.

## 数学环境

数学环境使用 `[definition ...]`, `[lemma ...]`, `[proposition ...]`, `[theorem ...]`, `[proof ...]`, `[corollary ...]`, 例如

```
[definition This is a test math environment. [formula ∑i=1 to∞:∑j=1 to∞:f(i,j)=S.]]
[lemma This is a test math environment. [formula ∑i=1 to∞:∑j=1 to∞:f(i,j)=S.]]
[proposition This is a test math environment. [formula ∑i=1 to∞:∑j=1 to∞:f(i,j)=S.]]
[theorem This is a test math environment. [formula ∑i=1 to∞:∑j=1 to∞:f(i,j)=S.]]
[proof This is a test math environment. [formula ∑i=1 to∞:∑j=1 to∞:f(i,j)=S.]]
[corollary This is a test math environment. [formula ∑i=1 to∞:∑j=1 to∞:f(i,j)=S.]]

```

This is a test math environment.

$$
\sum_{i=1}^{\infty}\sum_{j=1}^{\infty}f\left(i,j\right)=S.
$$

This is a test math environment.

$$
\sum_{i=1}^{\infty}\sum_{j=1}^{\infty}f\left(i,j\right)=S.
$$

This is a test math environment.

$$
\sum_{i=1}^{\infty}\sum_{j=1}^{\infty}f\left(i,j\right)=S.
$$

This is a test math environment.

$$
\sum_{i=1}^{\infty}\sum_{j=1}^{\infty}f\left(i,j\right)=S.
$$

This is a test math environment.

$$
\sum_{i=1}^{\infty}\sum_{j=1}^{\infty}f\left(i,j\right)=S.
$$

This is a test math environment.

$$
\sum_{i=1}^{\infty}\sum_{j=1}^{\infty}f\left(i,j\right)=S.
$$

## 参考文献

目录使用 `[bibliography ...]`, 并用 `[bib-item ...]` 添加条目, 例如

```
[bibliography
[bib-item Reference 1.]
[bib-item Reference 2.]
[bib-item Reference 3.]
]

```

效果如下

## Bibliography
* Reference 1.
* Reference 2.
* Reference 3.