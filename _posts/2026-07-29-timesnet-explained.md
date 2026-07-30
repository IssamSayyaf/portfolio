---
title: TimesNet, explained from scratch
date: 2026-07-29
tags: [time series, forecasting, cnn, representation learning]
excerpt: A time series is the wrong shape. TimesNet folds it into a grid on the period an FFT finds, so a 3x3 convolution can see both kinds of neighbour a time point has. Built up one step at a time on twelve numbers you can check by hand, with an animation per step — and two findings about the code that the paper does not mention.
draft: false
---

Most papers about time series argue over the right **token** — one step, or a patch of sixteen.
TimesNet (Wu et al., ICLR 2023) asks something else:

> Is a time series even the right **shape**?

Its answer is no. The whole paper is one move: **find the period, fold the line into a grid that
wide.** Then a small 2D convolution can see things a 1D convolution cannot, and the data is an
image, so any vision backbone can do the temporal modelling.

This is built up one step at a time. Sections 1 and 2 are the whole idea — if you read only
those, you have the paper. Everything after them is detail, and anything in a **collapsible box
is optional** on a first pass.

```{note} How to read the numbers here
Everything is computed from a NumPy implementation that follows the reference code, on synthetic
data with a **known** 24-step cycle, so you can check that the model finds the right answer.

`T = 96` steps per window, `C = 7` channels, `d = 16` features, `k = 5` periods kept — the
reference config for ETTh1.
```

## 1. Every point has two neighbours

Pick a point in a daily cycle. It has two quite different neighbours:

- the point **next to it**, in the same cycle — *intraperiod* variation
- the point at the **same hour yesterday** — *interperiod* variation

!video(images/timesnet/01_two_neighbours.mp4)

In 1D the first is one step away and the second is `p` steps away, where `p` is the period. A
`3×3` convolution reaches the first and has no way to reach the second. To get it you need a
kernel as wide as a whole day, or many stacked layers, or attention that has to rediscover the
relationship from nothing.

That is the problem. Now the fix.

## 2. So fold the line into a grid

Here are twelve numbers. The shape `2, 5, 8, 4` repeats three times, rising by 1 each round:

```
x  =  [ 2, 5, 8, 4,   3, 6, 9, 5,   4, 7, 10, 6 ]
```

The period is 4. So cut the line every 4 values and stack the pieces as rows:

!video(images/timesnet/02_fold_numbers.mp4)

```
        phase →   0   1   2   3
 cycle 0       [ 2   5   8   4 ]
 cycle 1       [ 3   6   9   5 ]
 cycle 2       [ 4   7  10   6 ]
```

Now read it two ways:

- **across a row** — `2, 5, 8, 4` — one cycle, the shape of a single day
- **down a column** — `5, 6, 7` — the same phase on three consecutive days

Look at what happened to `5, 6, 7`. In the original line those values sat at positions 1, 5 and
9 — **four steps apart**. In the grid they are **stacked on top of each other**. A slow drift
that was spread across the whole sequence is now a short vertical line, and a `3×3` kernel can
read it in one go.

That is TimesNet. Everything below is the machinery for doing it properly: how to find the
period, what to do when it does not divide evenly, and what to do with several periods at once.

## 3. The whole block, in five steps

!video(images/timesnet/03_steps.mp4)

| step | what it does | shape in | shape out |
| --- | --- | --- | --- |
| 1 | **FFT** picks the period | 12 values | `p = 4` |
| 2 | **fold** into a grid `p` wide | 12 values | 3 × 4 grid |
| 3 | **2D convolution** | 3 × 4 grid | 3 × 4 grid |
| 4 | **unfold** back to a line | 3 × 4 grid | 12 values |
| 5 | **combine, add the input back** | `k` lines | one line |

The shape goes **1D → 2D → 1D**, and the only reason for the trip is step 3.

Two things to notice, because they are easy to miss and both matter:

**Only step 3 is learned.** Finding the period, folding, unfolding and the weights in step 5 are
all computed straight from the data — no parameters, no gradients.

**Steps 1–4 run `k = 5` times in parallel**, once per candidate period, and step 5 merges them.

![TimesNet architecture and the shape of the data at every layer](images/timesnet/fig01_architecture.svg "Every block and every tensor shape. The glyph column on the left is the real array at that stage of a forward pass; the callouts record what is learned and what is not.")

~~~{tip} Optional — how many objects are alive at once
:class: dropdown
The word "parallel" hides a lot. One FFT produces five frequencies, which produce five periods,
which produce five differently-shaped grids, all existing at the same time:

!video(images/timesnet/04_structure.mp4)

```
1 FFT  →  k frequencies  →  k periods  →  k 2D tensors
                                              ↓   (the same CNN on each)
                                          k convolved tensors
                                              ↓   unfold + truncate
                                          k 1D series
                                              ↓   weighted sum + residual
                                            1 output
```

**There is one CNN, not five.** In the reference code `self.conv` is built once and called
inside the loop, so identical weights process all five grids. The paper says this is deliberate:
a shared block "improve[s] parameter efficiency, which can make the model invariant to the
selection of hyper-parameter `k`."

It does mean the same kernels read axes that mean different things in each branch — one step
down is a 24-step cycle in one grid and a 48-step cycle in another.

The reference config stacks **two** blocks, and each one recomputes its own periods from its own
features. Running three blocks here gives `[96, 48, 24, 19, 12]`, then `[96, 48, 24, 19, 6]`,
then `[96, 48, 24, 19, 6]` — the last slot moves as the representation changes.
~~~

~~~{tip} Optional — the layer that turns 7 channels into 16
:class: dropdown
Before any of this, the 7 recorded channels become 16 features. It is not the per-timestep
matrix you might assume:

!video(images/timesnet/05_embed.mp4)

```python
nn.Conv1d(in_channels=C, out_channels=d_model,
          kernel_size=3, padding=1, padding_mode='circular', bias=False)
```

A **1-D convolution along time**, width 3: `16 × 7 × 3 = 336` weights, no bias. So it already
mixes three adjacent time steps before the fold ever happens. A **fixed sinusoidal position
code** is added to it — `require_grad = False`, not learned.

Those 16 features become the **channels** of every 2D image later on. The outer model is just:
normalise, embed, two TimesBlocks, `Linear(16 → 7)`, put the mean and standard deviation back.
~~~

## 4. Step 1 — which period?

The model is not told the period; it finds it with an FFT.

!video(images/timesnet/06_fft_periods.mp4)

$$
\mathbf{A} = \text{Avg}\big(\text{Amp}(\text{FFT}(\mathbf{X}))\big), \qquad
\{f_1,\dots,f_k\} = \underset{f}{\arg\text{Topk}}(\mathbf{A}), \qquad
p_i = \left\lfloor \frac{T}{f_i} \right\rfloor
$$

In words: transform along time, take the amplitude, average over the channels so all 16 features
vote once, then keep the `k` strongest frequencies. Each frequency `f` becomes a period
`p = T/f`, because a window holding `f` whole cycles has cycles `T/f` long.

On our 96-step window it recovers the 24-step cycle the data was built with — `f = 4 → p = 24`,
amplitude **28.0**, the largest by a clear margin.

![Period discovery](images/timesnet/fig03_period_discovery.svg "The window, its amplitude spectrum with the k = 5 selected bins, the periods they imply, and the frequency → period map.")

```{warning} Two things the code does that the equation does not say
:class: dropdown
- **Bin 0 is forced to zero** before the top-k. Bin 0 is the mean, and it has the largest
  amplitude in almost every real window — leave it in and every "period" comes out as `T`.
- The code uses **integer division** `T // f`, not the paper's `⌈T/f⌉`. At high frequencies
  several different frequencies collapse onto the same tiny period, so branches get spent twice
  on the same grid.
```

## 5. Step 2 — what `p` means, and the grid it makes

This is the step most likely to confuse, so it is worth being slow. The window is always 96
values — so how do we get a 4 × 24 grid *and* a 2 × 48 grid out of it?

!video(images/timesnet/07_what_is_p.mp4)

`p` is **how many steps the pattern takes to repeat**, and the fold puts **one cycle per row**.
So `p` is the *width*, and the number of rows is however many cycles fit:

$$
\text{columns} = p, \qquad \text{rows} = \left\lceil \frac{T}{p} \right\rceil
$$

The 96 numbers never change — only the shape of the rectangle they are poured into:

| p | means (hourly data) | grid | check |
| --- | --- | --- | --- |
| 12 | half a day | 8 rows × 12 | 8 × 12 = 96 |
| 24 | one day | 4 rows × 24 | 4 × 24 = 96 |
| 48 | two days | 2 rows × 48 | 2 × 48 = 96 |
| 19 | — | 6 rows × 19 | 6 × 19 = **114**, so 18 zeros get padded on |

A **short** `p` gives a narrow, tall grid. A **long** `p` gives a wide, short one. When `p` does
not divide 96 the rectangle is too big, so zeros fill the gap and are cut off again after the
convolution.

**The row is a cycle; the column is a phase.** Hold on to that and the rest follows.

```{tip} Optional — the same thing at full scale
:class: dropdown
!video(images/timesnet/08_window_to_grid.mp4)

![The k 2D maps](images/timesnet/fig04_the_2d_maps.svg "The same 96-step window folded five different ways, one per selected period. The chosen fold (p = 24) is outlined; p = 19 shows the zero padding as the grey band.")

Two things only visible here. The **window is a slice** of a much longer recording — the model
never sees the whole series, and the periods are re-estimated for every window.

And a **long period gives too few rows**: `p = 48` leaves 2 rows and `p = 96` leaves **one**, so
there is nothing to compare down a column. That is why the useful range of `p` stops well below
`T/2`.
```

## 6. Step 3 — the 2D convolution

Now the payoff. Put the simplest possible kernel — a `3×3` average — on the grid:

!video(images/timesnet/09_conv_numbers.mp4)

It covers

```
2   5   8
3   6   9
4   7  10
```

which sums to 54, so the output is `54/9 = 6.0`. The number is not the point. The point is
**which nine values produced it**: three phases across and three cycles down, in one
multiply-accumulate. A 1D kernel of width 3 on the original line would have seen `2, 5, 8` and
nothing else.

The real block uses six kernel sizes instead of one — `1×1` through `11×11`, run in parallel and
**averaged** — so small kernels catch the local wiggle and large ones span a whole cycle.

```{tip} Optional — the inception block, and why one CNN fits five grid sizes
:class: dropdown
!video(images/timesnet/10_inception.mp4)

Six square kernels, averaged (not concatenated), twice over with a GELU between:
`Conv2d(16 → 32)`, GELU, `Conv2d(32 → 16)`.

**Why identical weights work on five different grids.** A convolution's parameters are shaped

`(out_channels, in_channels, kernel_h, kernel_w)`  =  `(32, 16, 3, 3)`

The height and width of the *input* appear nowhere in it. A kernel is a small stencil that
slides over whatever canvas it is given; a bigger canvas changes how many positions it visits,
not how many numbers it holds. Same reason a CNN trained on 224 × 224 photos runs on 512 × 512.

Counting the `16 → 32` half, per kernel:

| kernel | 1×1 | 3×3 | 5×5 | 7×7 | 9×9 | 11×11 |
| --- | --- | --- | --- | --- | --- | --- |
| weights (`32 × 16 × k²`) | 512 | 4,608 | 12,800 | 25,088 | 41,472 | 61,952 |

That half is `32 × 16 × 286 = 146,432` weights; the `32 → 16` half is the same again; and
`nn.Conv2d` defaults to `bias=True`, adding `6 × 32 + 6 × 16 = 288`. So

`292,864 weights + 288 biases = ` **293,152 parameters**

— the same number whichever branch is running.
```

## 7. Steps 4 and 5 — unfold, then combine

Each grid is unfolded back to a line and truncated to 96. Then the five lines are combined,
weighted by the amplitudes that chose them, and the input is added back:

$$
\widehat{\mathbf{A}} = \text{Softmax}(\mathbf{A}), \qquad
\mathbf{X}^{l} = \sum_{i=1}^{k} \widehat{\mathbf{A}}_{f_i} \times \widehat{\mathbf{X}}^{l,i}
$$

The clever part is that the weights are **free**: the amplitude that selected each period is
reused as its confidence score, so this step adds no parameters at all.

!video(images/timesnet/11_softmax_step.mp4)

`A` is unbounded and the weights must sum to 1, hence the softmax — in the numerically stable
form, which subtracts the largest amplitude first:

$$
\widehat{A}_i = \frac{\exp(A_i - A_{\max})}{\sum_j \exp(A_j - A_{\max})}
$$

Subtracting `A_max` cancels top and bottom, so the answer is identical. It matters because
`exp(88.8)` overflows float32, and raw FFT amplitudes get that big.

On our window, term by term:

| p | A | A − A_max | exp(A − A_max) | ÷ Z = Â |
| --- | --- | --- | --- | --- |
| 96 | 18.818 | −9.171 | 1.04 × 10⁻⁴ | 1.04 × 10⁻⁴ |
| 48 | 8.341 | −19.648 | 2.93 × 10⁻⁹ | 2.93 × 10⁻⁹ |
| **24** | **27.989** | **0.000** | **1.000000** | **0.999896** |
| 19 | 7.920 | −20.069 | 1.92 × 10⁻⁹ | 1.92 × 10⁻⁹ |
| 12 | 6.873 | −21.116 | 6.75 × 10⁻¹⁰ | 6.75 × 10⁻¹⁰ |

`Z = 1.000104` — barely above 1, because the four losers add almost nothing to it. So one branch
takes **99.99%** of the output and the other four are multiplied by roughly zero.

### Finding 1 — the "adaptive aggregation" is an argmax

The paper calls this adaptive aggregation, with the amplitudes reflecting "the relative
importance" of each period. Measured, it is not a blend — it is a selection.

!video(images/timesnet/12_softmax_saturates.mp4)

The mechanism is that softmax runs on **raw amplitudes** with **no temperature**, so what decides
the outcome is the *gap in absolute units*, not the ratio. With two branches the weight on the
larger is exactly `1/(1+e^−gap)`:

| gap `A₁ − A₂` | 0 | 1 | 3 | 5 | **9.17** | 12 |
| --- | --- | --- | --- | --- | --- | --- |
| weight on the larger | 0.500 | 0.731 | 0.953 | 0.993 | **0.999896** | 0.999994 |

A gap of about 5 already ends it, and our window's gap is **9.17**. Over **all 1101 windows** of
this series, **97.4%** put more than 0.99 on one branch, 2.6% land between 0.9 and 0.99, and
**none** falls below 0.9. Median 0.999894.

![Adaptive aggregation](images/timesnet/fig07_aggregation.svg "The amplitudes going in, the weights coming out, the exact two-branch saturation curve with our window marked, and the distribution over every window in the dataset.")

That is a cost, not a curiosity. All five branches are computed — **145.8M multiply-adds** on
this window — and **80.7% of that work is then multiplied by ~0**. Swapping the softmax output
for the winning branch alone changes the block output by **0.0052%**; swapping it for a plain
mean of the five changes it by **28.5%**.

How far it generalises needs care: this is synthetic data with one dominant period, and real
benchmarks have flatter spectra in places. But the mechanism is structural, not a quirk of my
data — softmax over unnormalised amplitudes saturates whenever one period leads by a few
absolute units, which is the common case. A temperature, or normalising `A` first, would be
cheap to try.

```{tip} Optional — the residual, measured
:class: dropdown
!video(images/timesnet/13_block_output.mp4)

In the 96 × 16 feature space the block actually works in:

| quantity | value |
| --- | --- |
| ‖ X_in ‖ | 41.84 |
| ‖ Σ Â X̂ ‖ — the correction | 22.09 |
| ‖ X_out ‖ | 62.98 |
| correction relative to the input | 0.53 × |
| cos( Σ Â X̂ , X_in ) | 0.934 |

The correction is about half the length of the input and points **almost the same way**. So the
block nudges the features along a direction they already have rather than rewriting them — which
is the point of a residual: the convolution never has to reproduce the signal, only correct it.
```

## 8. Why folding on an FFT bin works at all

So far this is bookkeeping. Why should folding on a number that fell out of an FFT produce a
grid with *any* structure? There is an exact answer, and it is the best reason to trust the
design.

Fold a pure cosine at exactly `p = T/f` and every row comes out **identical**, so the variance
down each column is zero:

| folded component | variance down a column |
| --- | --- |
| `k = f` — the frequency we folded on | **0.00000** |
| `k = 2f` — its second harmonic | **0.00000** |
| `k = 3f` — its third harmonic | **0.00000** |
| `k = 5` — not a multiple of `f` | 0.50000 |

Exact, not approximate. Writing `n = i·p + j`, the component at frequency `k` picks up a phase
factor of $e^{2\pi i k i / f}$ in row `i`; when `k` is a multiple of `f` that is 1 in every row,
so the component is frozen down the column. Any other `k` rotates as you move down.

So the fold **separates** the signal onto the two axes:

- **across a row** — the frequency you folded on *and all its harmonics*: the full repeating
  waveform, which is why the row axis carries the shape of a cycle
- **down a column** — everything harmonically unrelated: trend, drift, noise, other periods —
  which is how the cycle *changes* from one repetition to the next

!video(images/timesnet/14_two_axes.mp4)

Measured on four signals, all folded at the same period:

| signal | shared cycle shape (rows) | cycle-to-cycle change (columns) |
| --- | --- | --- |
| perfectly periodic | **100%** | 0% |
| periodic + a trend | 63% | 37% |
| periodic + growing amplitude | 97% | 3% |
| pure noise | 28% | 72% |

A perfect cycle puts everything in the rows; noise puts almost everything in the columns. Real
data sits in between, and the 2D kernel works on both at once.

```{tip} Optional — the fold only works if the period is right
:class: dropdown
Measure the lag-1 correlation *down a column* against the assumed period. Along a row the
correlation is always high — that is just time passing. Down a column it peaks sharply at the
true period:

| assumed p | 12 | 23 | **24** | 25 | 48 |
| --- | --- | --- | --- | --- | --- |
| column correlation | −0.68 | +0.52 | **+0.93** | +0.78 | +0.90 |

One step off and the phase drifts across rows, the vertical bands smear, and the column axis
carries nothing. (48 scores well because it is a multiple of 24 — two cycles per row still
align.) The FFT step is not a nicety.

![Why the period has to be right](images/timesnet/fig05_why_the_period_matters.svg "Column structure against the assumed period, and three folds: half the period, the true period, and one step off.")
```

```{tip} Optional — this is also how the FFT gets fast, and what astronomers call phase folding
:class: dropdown
Writing `T = f × p` and reshaping into an `f × p` array is exactly the step at the heart of the
**Cooley–Tukey** FFT: transform the columns, apply twiddle factors, transform the rows, and you
have the full DFT. I checked it — running that procedure through TimesNet's own reshape
reproduces `np.fft.fft` to a maximum absolute difference of **7.6 × 10⁻¹⁵**.

So the reshape TimesNet uses to make a picture is the reshape the FFT uses to save arithmetic.
`T = f × p` is the one factorisation the signal itself hands you.

The physical picture is older still. Stacking repetitions at a trial period is **phase folding** —
what radio astronomers do to pull a pulsar out of noise, and what an oscilloscope does when you
trigger it on the signal's own period. Whatever is genuinely periodic reinforces; whatever is
not smears out.
```

## 9. Can you swap the inception block?

The paper's bigger claim is that once the data is a well-formed image, the inception block is
just one choice — put in a better vision backbone and results follow. It is the most appealing
claim in the paper and the least worked out, so: what would a replacement actually have to do?

!video(images/timesnet/15_backbone_rules.mp4)

Four constraints, none of them about accuracy:

1. **Shape in must equal shape out.** `rows × p × 16` has to come back as `rows × p × 16` —
   stride 1, `same` padding, 16 output channels — because the result is unfolded and *added* to
   the input.
2. **One set of weights, five geometries.** The same module runs on `1×96`, `2×48`, `4×24`,
   `6×19`, `8×12`. So: no flatten, no fixed-size head, no learned positional table.
3. **Never downsample.** The `p = 96` branch is a **1 × 96 image — one row.** A standard ResNet
   stem (`7×7` stride 2, then max-pool stride 2) divides both axes by 4, which maps `1 × 96` to
   `0 × 24`. Two of the five branches disappear.
4. **Mind the padding.** The `p = 19` branch is `6 × 19 = 114` cells holding 96 real values, so
   **15.8% is structural zeros**. BatchNorm folds those into its running statistics; LayerNorm
   and GroupNorm do not.

Rule 3 has a consequence worth seeing even for the block as shipped — on tall branches the
widest inception kernel is mostly reading padding:

| p | the image | after a ResNet stem | `11×11` footprint that is padding |
| --- | --- | --- | --- |
| 96 | 1 × 96 | **0 × 24 — gone** | 91% |
| 48 | 2 × 48 | **0 × 12 — gone** | 82% |
| 24 | 4 × 24 | 1 × 6 | 64% |
| 19 | 6 × 19 | 1 × 4 | 45% |
| 12 | 8 × 12 | 2 × 3 | 27% |

### The candidates, and what each costs

!video(images/timesnet/16_backbone_variants.mp4)

| block, 16 → 16, shape preserving | params | × inception | reach | what it gives up |
| --- | --- | --- | --- | --- |
| **Inception_V1 × 2 (shipped)** | **293,152** | **1.000** | 11×11 | the baseline |
| Inception_V2 × 2 (also in the repo) | 32,080 | 0.109 | 7×7 | square kernels, for strips |
| ResNet BasicBlock | 9,312 | 0.032 | 5×5 | scale diversity; BN needs swapping |
| ResNet Bottleneck | 896 | 0.003 | 3×3 | half the features, and the reach |
| ResNeXt (C=8, w=32) | 2,336 | 0.008 | 3×3 | scale diversity, for path diversity |
| ConvNeXt (depthwise 7×7) | 2,976 | 0.010 | 7×7 | dense feature × space mixing |
| ConvNeXt (depthwise 11×11) | 4,128 | 0.014 | 11×11 | same, at inception's full reach |
| depthwise inception, 1…11 | 5,648 | 0.019 | 11×11 | nothing structural — just density |

The short version: **ConvNeXt is the closest structural match.** Inception's `11×11` weight is a
single `16 × 32 × 11 × 11 = 61,952`-number tensor mixing space and features together; ConvNeXt
splits exactly that into a space-only depthwise `7×7` and a feature-only `1×1`, for about a
hundredth of the parameters. It uses LayerNorm, which sidesteps rule 4 for free. And its
inverted bottleneck `16 → 64 → 16` *is* the `d_model → d_ff → d_model` sandwich TimesBlock
already builds by hand.

```{warning} These are budgets, not results
Every number in that table is an exact parameter count or an exact shape constraint — computable
without training anything, which is why they are here. **None of these variants was trained.**
Nothing here is a claim about accuracy; the paper's own backbone experiment is the evidence for
that, not this table.
```

~~~{tip} Optional — the per-variant detail
:class: dropdown
**ResNet BasicBlock** — two `3×3` convolutions, BatchNorm, identity skip. 9,312 parameters,
4.6M multiply-adds, reach `5×5`. Drop the stem and every stride (rule 3), swap BatchNorm for
GroupNorm (rule 4).

The **Bottleneck** variant is the wrong tool: 896 parameters, but a bottleneck exists to make a
256-channel ImageNet stage affordable and `d_model` is 16. Squeezing 16 → 8 throws away half the
features to save 8,416 weights, and its reach is only `3×3` — one cycle, three phases.

**ResNeXt** — a bottleneck whose `3×3` is split into 8 groups of 4 features, each with its own
filter. 2,336 parameters. The interesting part is the swap of ideas: inception gets diversity
from kernel **size** (1, 3, 5, 7, 9, 11, each reading every feature); ResNeXt gets it from
**paths** (eight `3×3` filters, each reading a quarter of the features). It buys feature
diversity and gives up *scale* diversity — which is the thing the fold was built to exploit.

**ConvNeXt**, in full:

```
Conv2d(16 → 16, 7×7, groups=16)   depthwise, space only     16·49 + 16 =   800
LayerNorm(16)                                                    2·16 =    32
Conv2d(16 → 64, 1×1)              inverted bottleneck, 4×    64·16 + 64 = 1,088
GELU
Conv2d(64 → 16, 1×1)              project back              16·64 + 16 = 1,040
× γ, then + identity               layer scale                            16
                                                            total     = 2,976
```

Large kernels are its whole point — it exists because a `7×7` depthwise beat stacks of `3×3`,
the same bet inception makes with its `9×9` and `11×11`. An `11×11` depthwise costs 4,128 and
matches inception's reach exactly. What it does not fix: a `7×7` on the `p = 96` branch is still
86% zero padding, because the fold hands you a `1 × 96` strip whatever backbone you pick.

**The obvious compromise** needs no guessing: keep inception's six kernel sizes but make them
depthwise, then mix features with the `1×1` pair TimesBlock already has.
`16 · (1+9+25+49+81+121) = 4,576` plus 1,072 for the pointwise pair = **5,648 parameters**.
Multi-scale kept, dense cross-feature cost dropped.
~~~

```{warning} Finding 2 — a backbone's own skip double-counts the residual
:class: dropdown
Most modern blocks carry an identity skip inside them. Adding one here quietly adds a second
copy of the input.

Fold-then-unfold is **exactly** the identity — I measured the round trip at all five periods and
the maximum absolute difference is `0.00e+00` — and the aggregation weights sum to 1. So if each
branch returns `f(X) + X`, aggregation gives `Σ Â f(X) + X`, and TimesNet's own residual then
makes it `Σ Â f(X) + 2X`.

Measured on this window, `‖X_out‖` goes from **62.98** to **104.62**, a factor of **1.66**. Keep
one skip, not two.
```

## 10. What it buys, and what it costs

Because the folded tensor is just an image, one architecture handles five tasks that normally
need five designs:

| task | benchmark | TimesNet result |
| --- | --- | --- |
| long-term forecasting | ETT, Electricity, Traffic, Weather, ILI | best in >80% of settings |
| short-term forecasting | M4 | SMAPE 11.829 — best |
| imputation | ETT, Electricity, Weather | best at every mask ratio |
| classification | UEA (10 subsets) | 73.6% average — best |
| anomaly detection | SMD, MSL, SMAP, SWaT, PSM | 86.34 F1 — best |

The classification row is the one to pause on. DLinear, which does well at forecasting,
collapses to 67.5% here: a single linear layer over the time axis cannot build the hierarchical
representation classification needs. The 2D features can.

The costs:

- **Periodicity is assumed.** With no clear period the FFT returns whatever noise peaks,
  `T // f` collapses those onto tiny periods, and the columns mean nothing. The paper admits the
  variations are then "dominated by the intraperiod-variation" — a 1D CNN with extra steps.
- **Long periods barely work.** `p > T/2` leaves fewer than two rows, so the interperiod axis
  the design exists to expose stops existing.
- **`k` buys less than it looks.** Five branches computed, four multiplied by ~0 (§7).
- **It is expensive** — `k` reshapes and `k` inception passes per block. The paper's own
  efficiency plot puts it well behind the linear models on training time, and §9 suggests most
  of that cost is optional.
- **The fold is chosen per batch.** `abs(xf).mean(0)` averages over the batch, so the whole
  batch is folded on whichever periods dominate its average — while the aggregation weights,
  `abs(xf).mean(-1)[:, top_list]`, are per sample. Not mentioned in the paper, and it matters
  when a batch mixes windows with genuinely different periodicity.

## The whole paper in six lines

1. A time point has two kinds of neighbour; in 1D one of them is `p` steps away.
2. An FFT says what `p` is. It costs no parameters.
3. Fold the line into a grid `p` wide: rows are cycles, columns are phases. Both neighbours are
   now adjacent.
4. A 2D convolution reads both at once. This is the only learned part.
5. Unfold, and merge the `k` periods weighted by their amplitudes — which in practice picks one.
6. The data is now an image, so the backbone is replaceable. That is what makes one architecture
   work on five tasks.

```{tip} The whole forward pass as one animation — five minutes
:class: dropdown
Every step above, end to end, with the real numbers: the input, the embedding, the FFT, the five
reshapes, the inception block, the unfold, the softmax, the residual, and what it takes to
replace the 2D backbone.

!video(images/timesnet/17_full_walkthrough.mp4)
```

```{seealso} Reference and reproducibility
Wu, Hu, Liu, Zhou, Wang, Long, *TimesNet: Temporal 2D-Variation Modeling for General Time
Series Analysis*, ICLR 2023 — [arXiv:2210.02186](https://arxiv.org/abs/2210.02186).

Animations made with [Manim](https://www.manim.community/); figures from a NumPy implementation
that follows the reference code in Time-Series-Library rather than the paper's prose wherever
the two differ.

Period discovery, padding, the reshape, the aggregation weights and the residual are all
parameter-free, so those are exactly the real thing, and the harmonic and Cooley–Tukey results
in §8 are properties of the transform rather than of any model. The inception block runs with
**interpretable fixed kernels** rather than trained ones — the 2D maps show what a 2D kernel
can see, not what a trained TimesNet has learned, and no claim here depends on it being trained.
The parameter counts in §9 are counted from the layer definitions; no variant there was trained.
The data is synthetic with a 24-step and a 168-step cycle, which is why the discovered periods
come out so clean.
```
