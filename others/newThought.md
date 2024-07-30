[paragraph
Changes in number of individuals of a species reflects the stability of this species. If quantity changes are drastic, quantity of individuals of the species will fluctuate a lot, leading to larger standard deviation, vice versa. Thus we use the standard deviation $sigma_i$ of species $i$ to represent its stability:
\begin{equation}
	\sigma_i = \sqrt{\sum^{n}_{t=1}(x_i(t) - \bar{x_i})^2},
\end{equation}
where $x_i(t)$ represents the quantity of species $i$ at time $t$, $\bar{x_i}$ is the average of $x_i(t)$ with respect to $t$.
]

[paragraph
Changes in number of individuals of a species reflects the [emph stability] of this species. If quantity changes are **drastic**, quantity of individuals of the species will fluctuate a lot, leading to standard deviation /delta, vice versa. Thus we use the standard deviation $sigma_i$ of species i to represent its stability:
we plus /x to /y and 
]

[paragraph
The biomass of species /i is denoted by
[formula(centering)
	M_i = m_i x_i,
]
where /Mi is *biomass* of species /i/, /mi/ is the average mass of individuals of species /i, and /xi is the individual numbers of species /i. The *total biomass* /M is defined to be
[formula(centering)
	M = \sum_{i=1}^{n}M_i.
    M=sum{i=1 to n:M_i}
]
[formula
`x0=>[x_0]`
[{
    [d x_0 / d t]=x0( r_0 - alpha_0 x_0 - [gamma_10] x_1)+delta_0\\
    \frac{dx_{M}}{dt}=&x_M(r_M-H_M-\alpha_M x_M+\gamma_{1M}x_1)+\delta_M\\
    [d[x_M]/d t]=[x_M][([r_M]-[H_M]-[alpha_M][x_M]+[gamma_1M][x_1])] + [delta_M]\\
    \frac{dx_M}{dt}=x_M(r_M-H_M-\alpha_M x_M + \gamma_{1M}x_1+\delta_M)

    \frac{dx_{F}}{dt}=&x_F(r_F-H_F-\alpha_F x_F+D x_M+\gamma_{1F}x_1)+\delta_F\\
    \frac{dx_1}{dt}=&x_1(r_1-H_1-\alpha_1 x_1+\gamma_{01}x_0-\gamma_{M1}x_M-\gamma_{F1}x_F)+\delta_1\\
    \alpha_M=&\frac{I_a\tilde{\alpha}_M}{N+I_b},\quad \alpha_F=\frac{I_a\tilde{\alpha}_F}{N+I_b} \\
    r_M=&\frac{2\tilde{S}}{\tilde{R}+1},\quad r_F=\frac{2\tilde{R}\tilde{S}}{\tilde{R}+1} 
    \end{aligned}
.]
]
From the definition we notice that the higher the total biomass is, the more active ecosystem will be.
]


lix 文件由一个个的block组成

最大的block为document
block可以嵌套

lix提供几个基础block为
text：一行文字，不包含换行，可以包含子块text(嵌套,主要用于单独设置子块的格式), emph, inline-math, inline-code

math: 整行公式

table：表格

code：代码或伪代码

figure：单张或多张图片

list：有序或无序列表







~`@#$^_{}|

!;":'<>?+=-()*,.&/ ---> 常用符号

文本中的插入记号：

\ ---> 转义字符, ex:, \*, \[, \%
* ~ ---> 强调符号
[] ---> block分隔
% ---> 注释
/ / ---> 数学符号
\\ ---> 换行符号
