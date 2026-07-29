---
title: DLinear, explained from scratch
date: 2026-07-29
tags: [time series, forecasting, transformers, baselines]
excerpt: One linear layer beat every published Transformer at long-horizon forecasting. This is how it works, step by step through a forward pass — every matrix built by hand on a worked example, twelve animations, and a look inside the 32,256 weights at what it actually learned.
draft: false
---

Last time I worked through [PatchTST](post.html?p=patchtst-explained), the paper that
rehabilitated the Transformer for long-horizon forecasting. This is the paper it was written
to answer.

In May 2022 Zeng, Chen, Zhang and Xu asked
*[Are Transformers Effective for Time Series Forecasting?](https://arxiv.org/abs/2205.13504)*
and answered **no**. Their evidence was a model so small it is almost rude: **one linear
layer** along the time axis, 139,680 parameters, no attention, no embedding, no decoder, no
non-linearity. It beat Informer, Autoformer, FEDformer, Pyraformer and LogTrans on nine
benchmarks — often by 20–50% MSE.

The polemic is famous. What gets skipped is that the model is small enough to understand
*completely* — so this post is mostly about how it works. We will walk one window through it
step by step, build every matrix by hand on numbers you can check, then open up the trained
weights and read what it learned. The argument against Transformers comes after, once the
model is on the table.

Because DLinear is linear I could fit it to its **true optimum** and re-run every experiment,
so every number here is measured rather than quoted. Three results turned up that the paper
does not state; each is flagged where it appears.

```{note} Notation, once
$L$ is the look-back window (how many past steps go in), $T$ the horizon (how many steps come
out), $M$ the number of channels, $k = 25$ the moving-average kernel. Throughout, $L = 336$,
$T = 96$. Weights are shared across all channels, and one model is trained per horizon.
```

## 1. The model, in one picture

Start at the destination. The entire model is this:

$$\hat{x} \;=\; \underbrace{W_s \,(x - Mx)}_{\text{seasonal branch}} \;+\;
\underbrace{W_t \,(Mx)}_{\text{trend branch}}$$

Three matrices and an addition. $M$ is fixed — a moving average, not learned. $W_s$ and $W_t$
are the only trained parameters. There is nothing else: no attention, no embedding, no
decoder, no activation function anywhere.

Watch one window go through it:

!video(images/dlinear/01_data_flow.mp4)

![DLinear architecture and the shape of the data at every layer](images/dlinear/fig01_architecture.svg "Every block and every tensor shape. The glyph column on the left is the real array at that stage of a forward pass; the two weight matrices are the ones actually learned.")

The rest of this section takes those four steps one at a time.

## 2. Step by step through one forward pass

### Step 1 — take one channel

The input is $M$ parallel series, $x \in \mathbb{R}^{M \times L}$. DLinear does **not** model
them jointly. It splits them apart and pushes each through the *same* weights, as if each were
a separate training example.

So from here on there is only one series, $x \in \mathbb{R}^{L}$ — a single row of 336
numbers. Whatever we do to it, we do to all $M$ of them with the same $W_s$ and $W_t$. That is
the entire treatment of the multivariate problem.

### Step 2 — split the window into trend and seasonal

$$\text{trend} = M x \qquad\text{and}\qquad \text{seasonal} = x - M x$$

$M$ is worth building by hand, because everything about the decomposition follows from it.
Take a signal short enough to write out in full — eight values, $k = 3$ instead of 25 — and
construct its matrix:

!video(images/dlinear/02_worked_m.mp4)

Row $i$ averages the three inputs centred on position $i$, so $M$ comes out as a band of
$1/3$ down the diagonal. The interesting part is the ends. Row 0 wants $x_{-1}, x_0, x_1$ and
$x_{-1}$ does not exist. The reference implementation **replicate-pads** — it repeats the
first value — so $x_0$ is counted twice:

$$M_{\text{row }0} = \begin{bmatrix} 2/3 & 1/3 & 0 & \cdots \end{bmatrix},
\qquad
M_{\text{row }3} = \begin{bmatrix} 0 & 0 & 1/3 & 1/3 & 1/3 & 0 & \cdots \end{bmatrix}$$

Every row still sums to 1, so $M$ is a genuine average everywhere — including at the boundary.
Now multiply it out and subtract:

!video(images/dlinear/03_worked_split.mp4)

With $x = [2, 4, 5, 3, 1, 2, 6, 7]$, in full:

| i | x | trend = M x | seasonal = x − M x |
| --- | --- | --- | --- |
| 0 | 2 | (**2** + 2 + 4)/3 = 2.67 | −0.67 |
| 1 | 4 | (2 + 4 + 5)/3 = 3.67 | +0.33 |
| 2 | 5 | (4 + 5 + 3)/3 = 4.00 | +1.00 |
| 3 | 3 | (5 + 3 + 1)/3 = 3.00 | 0.00 |
| 4 | 1 | (3 + 1 + 2)/3 = 2.00 | −1.00 |
| 5 | 2 | (1 + 2 + 6)/3 = 3.00 | −1.00 |
| 6 | 6 | (2 + 6 + 7)/3 = 5.00 | +1.00 |
| 7 | 7 | (6 + 7 + **7**)/3 = 6.67 | +0.33 |

The bolded values are the padded repeats. Add the last two columns and you get `x` back
exactly — the split loses nothing, by construction.

Two things follow immediately. The seasonal branch is **free**: it is $I - M$, and since every
row of $M$ sums to 1, every row of $I - M$ sums to 0 — keep yourself, subtract your
neighbours. And the padding is not a detail: zero-padding instead would leave row 0 summing to
0.52 rather than 1, so it would not be an average at all, dragging the trend about 12% toward
zero across the first and last 12 steps — the steps nearest the forecast.

At the real scale ($L = 336$, $k = 25$) the band is 25 wide and the padded corner stacks 13
weights onto column 0, giving `M[0,0] = 13/25 = 0.52` against `0.04` for an interior weight:

![How M is built](images/dlinear/fig09_building_m.svg "M is a band of 1/25 with a padded corner. An interior row is 25 flat weights; row 0 stacks 13 of them onto j = 0. I − M is the seasonal extractor and comes for free.")

On a longer signal you can watch the trend curve emerge from the sliding average:

!video(images/dlinear/04_moving_average.mp4)

Because both branches are matrices, the split is also a **filter** — and the kernel size is
the only knob, deciding where the signal is cut:

![The decomposition as a filter](images/dlinear/fig03_decomposition_geometry.svg "M as a low-pass filter: components slower than about 25 steps go to the trend layer, faster ones to the seasonal layer. Too small a kernel and the trend chases the season; too large and it flattens into a line.")

### Step 3 — push each part through a linear layer

Now the only trained part. Each branch gets its own matrix $W \in \mathbb{R}^{T \times L}$ —
**one row per future step, one column per past step**. Row $j$ produces future step $j$:

$$\hat{x}_j \;=\; \sum_{i=1}^{L} W_{ji}\, x_i$$

That is a weighted sum of the entire window. 336 numbers in, one number out, and the weights
never change from window to window:

!video(images/dlinear/05_dot_product.mp4)

Geometrically a weighted sum is a **projection**: $w \cdot x$ measures how much of the window
points along $w$. Each row of $W$ is a template, and the forecast is $T$ template-match
scores. With $T = 96$ and $L = 336$ that is $96 \times 336 = 32{,}256$ weights per branch.

### Step 4 — add the two branches

!video(images/dlinear/06_two_branches.mp4)

The two forecasts are summed and that is the output — the whole horizon at once, from one
matrix multiply per branch. No step feeds the next.

![The input, layer by layer](images/dlinear/fig02_layer_by_layer.svg "One real forward pass. Panels (e) and (f) are the two learned weight matrices; (g) shows each branch forecasting its own component, (h) the sum against the truth — held-out MSE 0.068 against 1.211 for a last-value baseline.")

## 3. What the model learns

Everything the model knows is in those two tables of numbers, which means you can just read
them. Watch a single row scan down $W$ and trace out the forecast:

!video(images/dlinear/07_inside_the_weights.mp4)

![Anatomy of the weight matrix](images/dlinear/fig06_weight_anatomy.svg "A row is one forecast step, a column is one lag. Row j turns out to be row 0 slid along by exactly j steps.")

**Finding 1 — the 96 rows are one rule, not 96.** Row $j$ is row 0 slid along by exactly $j$
steps, at a correlation of 0.97–0.98. The model learned a single periodic template and reuses
it at 96 offsets. The branches also read the window very differently: the seasonal layer draws
almost evenly across all 336 lags (max/min ratio 2.3), while the trend layer is far pickier
(13.2), massing around lag 110 and largely ignoring the far end.

What does that template actually say? Plot the row that makes the first forecast step:

!video(images/dlinear/08_learned_lags.mp4)

It peaks at lags **24, 48, 72, 96** — exact multiples of the daily period. In words: *"to
predict the next hour, look one day back, and two days back, and three."* A seasonal-naive
rule, fitted. The trend layer comes out smooth instead, with its mass at the recent end: level
and slope.

![The weights are the explanation](images/dlinear/fig04_learned_weights.svg "The seasonal layer is striped, the trend layer smooth. Panel (d) is the same layer fitted to its exact least-squares optimum — no structure at all.")

**Finding 2 — that readability comes from the training path, not the optimum.** The paper
initialises the layers at $1/L$ rather than randomly, "to obtain a smooth weight with a clear
pattern in visualization". Fit the *same* layer to its exact least-squares optimum instead and
the stripes dissolve into noise — at essentially the same test error. That is panel (d).
Gradient descent from a smooth start fits the strong periodic directions first and stops
before it can chase the noise; early stopping is doing the regularising. Worth knowing before
presenting a weight visualisation as evidence of what a model "understands".

Zoom in further and you can watch one output number being assembled from its 336 pieces:

![How one forecast number is produced](images/dlinear/fig07_how_a_forecast_is_built.svg "One forecast step is the sum of 336 contributions. The positive and negative terms nearly cancel; what survives is a small residue.")

**Finding 3 — it is not sparse.** I expected a handful of lags to carry the prediction. They
do not: it takes **82 lags for half** the contribution and **211 for 90%**. The model averages
over many periods rather than copying the most recent one — which is why it is robust to
noise, and why shuffling the window is so catastrophic.

And what comes out:

![What comes out](images/dlinear/fig08_what_comes_out.svg "Held-out forecasts, the error by horizon step, and the residual distribution.")

The error at step 96 is only **23% higher** than at step 1 — no step feeds the next, so nothing
compounds. And on a noise-dominated channel the model correctly **gives up**, predicting near
the mean rather than inventing structure.

## 4. Why it is built this way

Three design choices are worth separating out, because each is doing real work.

**Direct, not iterated.** Every prior non-Transformer baseline was *iterated* — predict one
step, feed it back, repeat — which accumulates error over the horizon. LTSF-Linear is
**direct**: the whole horizon comes out at once. That is why the error curve above is nearly
flat, and a good part of the Transformers' claimed advantage over classical baselines was
really this, not attention.

**NLinear, for distribution shift.** The paper takes this seriously enough to give it a
variant of its own and a dedicated appendix (D.1, plus the histograms in its Figure 5). The
problem: the mean of the test data is not the mean of the training data, so "if the model made
a prediction that is out of the distribution of true value, a large error would occur." Their
fix is one subtraction:

$$\hat{x} = W\,(x - x_L) + x_L$$

Subtract the last value of the window, forecast the remainder, add it back.

!video(images/dlinear/09_nlinear.mp4)

Why that works is worth spelling out, because it is exact rather than approximate. Shift a
whole window by a constant, $x \to x + c$. A plain linear layer gives

$$\hat{x} \;\to\; \hat{x} + c \cdot \textstyle\sum_i W_{ji}$$

so the forecast only tracks the shift if each row of $W$ sums to exactly 1 — and nothing in
the training makes that happen. On the model fitted here the row sums come out at **0.991**:
close, but every level shift loses 0.9% of itself.

NLinear removes the question. Because $x - x_L$ is unchanged by a constant shift and $x_L$
carries it, the identity $f(x + c) = f(x) + c$ holds **whatever $W$ is** — it is a property of
the architecture, not of the fit.

![Why NLinear works](images/dlinear/fig10_nlinear_shift.svg "Shift the held-out inputs and targets by a constant c. Linear degrades as c grows because its row sums are 0.991, not 1; NLinear does not move at all.")

Measured on held-out data, adding a constant $c$ to inputs and targets alike:

| shift c | Linear MSE | NLinear MSE |
| --- | --- | --- |
| 0 | 0.0707 | 0.0698 |
| 5 | 0.0742 | 0.0698 |
| 10 | 0.0821 | 0.0698 |
| 20 | **0.1114** | **0.0698** |

Linear loses 58% to a shift of 20; NLinear does not move in the fourth decimal. Checking the
identity directly, $\max |f(x+c) - c - f(x)|$ is $0.093$ for Linear and
$7 \times 10^{-15}$ for NLinear — floating-point zero.

This is also why the paper reports NLinear winning on exactly ETTh1, ETTh2 and ILI, the three
datasets whose train/test histograms visibly disagree, and tying elsewhere: "for the datasets
without obvious distribution shifts, like Electricity, using the vanilla Linear can be enough."
It is PatchTST's instance normalisation in its cheapest possible form.

**And the decomposition itself — which turns out to buy nothing in expressiveness.** Substitute
it into the model and collect terms:

$$\hat{x} \;=\; W_s (I - M)\,x + W_t M\,x \;=\; \big[\, W_s(I-M) + W_t M \,\big]\, x$$

The bracket is just a matrix. So DLinear computes one matrix times $x$ — exactly what plain
Linear does — and setting $W_s = W_t = W$ reproduces any Linear you like. **They span the same
set of functions.** Fitted by least squares with vanishing regularisation the two agree to
$1.3 \times 10^{-11}$:

| ridge $\lambda$ | max difference | Linear MSE | DLinear MSE |
| --- | --- | --- | --- |
| $10^{-8}$ | $1.3\times10^{-11}$ | 0.1177 | 0.1177 |
| $10^{-2}$ | $1.3\times10^{-5}$ | 0.1177 | 0.1177 |
| $10^{2}$ | $9.4\times10^{-2}$ | 0.1163 | 0.1166 |
| $10^{4}$ | $3.2\times10^{-1}$ | 0.1708 | 0.1816 |

So the "D" is not extra capacity — it is an **inductive bias**, acting through the regulariser
(which now penalises $\|W_s\|^2 + \|W_t\|^2$ instead of $\|W\|^2$) and through the path
gradient descent takes. Which is exactly why the paper's own tables show DLinear ≈ Linear on
most datasets, and better only where there is a clear trend.

## 5. Why this beats a Transformer

Only now is the paper's argument worth stating, because you can see what it is comparing
against. It is one sentence:

> Self-attention is **permutation-invariant**. In a time series the ordering *is* the signal.
> A Transformer that turns each time step into a token throws away the only thing that
> matters.

Shuffle *the cat sat on the mat* and most of the meaning survives — the words carry it.
Shuffle a time series and nothing is left: same values, same mean, same variance, no signal.

!video(images/dlinear/10_order.mp4)

That is falsifiable, and the test is the paper's sharpest experiment. Train normally, then
shuffle the look-back window **at test time** (Table 5, ETTh1):

| model | MSE increase when the input is shuffled |
| --- | --- |
| LTSF-Linear | **+81.1%** |
| FEDformer | +73.3% |
| Autoformer | +56.9% |
| Informer | **+2.0%** |

Read it the right way round: a *large* degradation is **good news about the model**, because it
means the model was genuinely using the ordering. Informer's +2% says the opposite.

Re-run here, on the model we just built:

| test-time scramble | held-out MSE | ratio |
| --- | --- | --- |
| none | 0.068 | 1× |
| first/second half swapped | 1.013 | 15× |
| reversed | 1.971 | 29× |
| fully shuffled | 0.842 | 12× |

Reversing is the most damaging of all — exactly what you would expect from a model whose
weights peak at multiples of the period.

### How much history is useful

!video(images/dlinear/11_how_much_history.mp4)

Across $L \in \{24, \dots, 720\}$ the linear model improves while the Transformers "fluctuate
or get worse" — and a model that gets worse with more information is overfitting noise. My
sweep refines that: error falls steeply, 0.510 at $L = 24$ down to 0.073 at $L = 192$, then
goes **flat** once the window covers the longest period in the data (168). More history is not
free information; it helps up to the longest cycle the data actually has.

### Close vs Far

Predict the *same* future twice: once from the 96 steps immediately before it, once from the
96 steps before *those*.

| model | Close | Far | change |
| --- | --- | --- | --- |
| FEDformer, Electricity | 0.251 | 0.265 | +6% |
| Autoformer, Traffic | 0.677 | 0.675 | −0.3% |
| **DLinear (fitted here)** | **0.148** | **0.309** | **+109%** |

The Transformers barely care which window they are handed.

### Dismantle an Informer, one piece at a time

| model | MSE (ETTh1, $T=96$) |
| --- | --- |
| Informer | 0.865 |
| → each attention layer replaced by a linear layer | 0.613 |
| → drop the FFN, keep embedding + linear | 0.454 |
| → one linear layer, nothing else | **0.400** |

Every deletion makes it better. And it is not a data-size problem either: train FEDformer on
all of Traffic (17,544 hours) versus one year (8,760 hours) and MSE goes **0.587 → 0.568**.
*Less* data is better.

### Efficiency was never the real issue

| model | MACs | parameters | inference | memory |
| --- | --- | --- | --- | --- |
| **DLinear** | **0.04 G** | **139.7 K** | **0.4 ms** | **687 MiB** |
| Transformer | 4.03 G | 13.61 M | 26.8 ms | 6,091 MiB |
| Informer | 3.93 G | 14.39 M | 49.3 ms | 3,869 MiB |
| Autoformer | 4.41 G | 14.91 M | 164.1 ms | 7,607 MiB |
| FEDformer | 4.41 G | 20.68 M | 40.5 ms | 4,143 MiB |

The efficient-attention variants are mostly *slower in practice* than the vanilla Transformer
they were meant to improve on. And $139{,}680 = 2 \times (96 \cdot 720 + 720)$ — two layers
with bias, at $L=96, T=720$. That is the whole model.

## 6. What it cannot do

!video(images/dlinear/12_change_point.mp4)

The weights are fixed, so nothing in the look-back window can tell the model that the level is
about to jump. It carries the old level straight through. The authors say so: "the one-layer
linear network is hard to capture the temporal dynamics caused by change points."

![One matrix: what it can and cannot do](images/dlinear/fig05_linear_map_geometry.svg "The SVD of the effective W: the few shapes it can output, the periodic probes it reads from the window, and the change-point failure.")

```{warning} What the paper does not prove
The title invites overreach, so it is worth being precise about scope.

This is a claim about **these nine benchmarks and these five models** — it shows the published
LTSF-Transformers were not effective, not that none can be. PatchTST demonstrated the
difference six months later, with the same diagnosis of the cause.

It also throws away **all** cross-channel structure, needs **one model per horizon** since
$W \in \mathbb{R}^{T \times L}$ hard-codes both ends, and cannot express a change point. The
authors are candid about the benchmarks too: "there is a great potential for new model
designs, data processing, and benchmarks."
```

## What actually survived

The lasting contribution is not the model. It is the methodological correction:

> Run the embarrassingly simple baseline first, and report it.

Every long-term forecasting paper since 2022 reports a linear baseline, and that is because of
this one. The specific claim — "Transformers don't work here" — was answered within six months
by PatchTST, which agreed about the *cause* (point-wise tokenisation) and fixed it rather than
abandoning the architecture.

Read the two together and the story is clean: DLinear proved the tokenisation was wrong;
PatchTST changed the tokenisation.

```{seealso} Reference and reproducibility
Zeng, Chen, Zhang, Xu, *Are Transformers Effective for Time Series Forecasting?*, AAAI 2023 —
[arXiv:2205.13504](https://arxiv.org/abs/2205.13504).

Animations made with [Manim](https://www.manim.community/); figures from a NumPy implementation
of the model. Because DLinear is linear it is fitted to its **global optimum** by least squares,
and to the paper's own protocol by gradient descent from a $1/L$ initialisation — so there are
no untrained weights anywhere here. The data is synthetic with a daily period of 24 and a
weekly period of 168, which is why the learned lags come out so clean; the shuffle, look-back
and Close/Far numbers are measured on a held-out 30%.
```
