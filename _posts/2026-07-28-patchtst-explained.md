---
title: PatchTST, explained from scratch
date: 2026-07-28
tags: [time series, transformers, forecasting, attention]
excerpt: A one-layer linear model was beating every Transformer at long-term forecasting. PatchTST shows the Transformer was never the problem — the tokenization was. Two changes, patching and channel-independence, every equation worked through, with animations and figures computed from a real forward pass.
draft: false
---

In 2022 a paper asked *[Are Transformers Effective for Time Series Forecasting?](https://arxiv.org/abs/2205.13504)*
and answered no. A **single linear layer** — DLinear, no attention, no depth — beat
Informer, Autoformer and FEDformer across the standard long-horizon benchmarks. For a
field that had spent three years porting Transformers to signals, this was awkward.

**PatchTST** is the rebuttal, and its argument is sharper than "our model is bigger".
The Transformer was never the problem. The **tokenization** was. Change two things and
keep the encoder completely vanilla:

1. **Patching** — a token is a *subseries* of $P$ steps, not a single time step.
2. **Channel-independence** — each variable is forecast separately by one *shared* backbone.

Nothing else changes: vanilla encoder, vanilla attention, no sparse trickery. MSE drops
**21% below the best Transformer baseline**, and the model beats DLinear too.

This post walks through the whole method — what each piece does, why it exists, and what
every equation is actually computing. Eight animations cover the parts that are easier to
watch than to read, and the figures are generated from a real forward pass: every number
plotted is computed, not drawn.

![PatchTST architecture and the shape of the data at every layer](images/patchtst/fig01_architecture.svg "The whole model. The left-hand glyph column is the real array at that stage of a forward pass, with M = 7, L = 336, P = 16, S = 8, N = 42, D = 128, T = 96.")

```{note} Notation, once
$M$ channels, $L$ look-back window, $T$ horizon, $P$ patch length, $S$ stride,
$N$ patch tokens, $D$ latent width, $H$ heads. Given $(x_1,\dots,x_L)$ with each
$x_t \in \mathbb{R}^M$, predict $(x_{L+1},\dots,x_{L+T})$. The $i$-th univariate series is
$x^{(i)}_{1:L} \in \mathbb{R}^{1\times L}$.
```

## Why the old design failed

### A time step is not a word

The Transformer came from NLP, where a token — "cat" — already carries meaning before the
model touches it. A single time step $x_t \in \mathbb{R}$ is **one number**. It has no
shape, no trend, no local context.

So when point-wise attention computes a similarity between two tokens, it is comparing two
*scalars*. That is very close to meaningless. What actually matters in a signal is what a
**neighbourhood** looks like: a rising edge, a peak, a flat noisy stretch. None of that is
visible from one sample.

!video(images/patchtst/01_why_patches.mp4)

This is not a hand-wave — it is measurable. Take 41,160 real patches and ask how much
structure each tokenization has:

![Why a patch is a token and a time step is not](images/patchtst/fig03_token_geometry.svg "A point-wise token lives in ℝ¹ — one height on a line, one direction, nothing for geometry to organise. A patch lives in ℝ¹⁶ and that cloud has real structure: PC1 is a ramp (trend), PC2 is a bow (curvature), and patches cluster by shape.")

Panel (d) is the whole argument in one bar chart. A scalar token has **exactly one**
direction of variation, so there is nothing for attention to compare. A patch has many.
*That* is what "local semantic information" means concretely.

### The quadratic wall

Vanilla attention costs $O(N^2)$ in time and memory, where $N$ is the token count.
Point-wise tokenization forces $N = L$, so the cost is $O(L^2)$.

This is why every prior Transformer — Informer, Autoformer, FEDformer, Pyraformer,
LogTrans — invented some *sparse* attention mechanism. They were paying for a bad
tokenization and then engineering their way around the bill.

The paper's counter-experiment (Table 1, Traffic, $T = 96$) is worth reading row by row:

| look-back $L$ | tokens $N$ | method | MSE |
| --- | --- | --- | --- |
| 96 | 96 | point-wise | 0.518 |
| 380 | 96 | down-sample every 4th step | 0.447 |
| 336 | 336 | point-wise | 0.397 |
| 336 | **42** | **patching** | **0.367** |
| 336 | 42 | patching + self-supervised | **0.349** |

Row 2 is the key one. With the *same* 96 tokens, covering a longer history (380 steps vs
96) is worth 0.07 MSE. History matters — and patching is a way to buy history without
buying tokens.

## Idea 1 — Patching

### The operator

Slide a window of length $P$ with stride $S$ over $x^{(i)} \in \mathbb{R}^{1\times L}$.
Each window becomes one column of a matrix:

$$
x^{(i)} \in \mathbb{R}^{1\times L}
\quad\xrightarrow{\ \text{patching}\ }\quad
x_p^{(i)} \in \mathbb{R}^{P\times N},
\qquad
\text{column } n = x^{(i)}_{nS+1\,:\,nS+P}
$$

That is the entire operation. No learned parameters, no convolution — a reshape with
overlap.

!video(images/patchtst/02_patching.mp4)

### Where the +2 in the patch count comes from

This is the one formula in the paper people misread. It comes from two facts:

- Windows of length $P$ at stride $S$ that fit in a sequence of length $\ell$:
  $\lfloor (\ell-P)/S \rfloor + 1$. (The classic fencepost $+1$.)
- **Before patching, the paper pads $S$ repetitions of the last value $x_L$ onto the end**,
  so $\ell = L + S$, not $L$.

Substituting:

$$
N = \left\lfloor \frac{L + S - P}{S} \right\rfloor + 1
  = \left\lfloor \frac{L - P}{S} \right\rfloor + 1 + 1
  = \left\lfloor \frac{L - P}{S} \right\rfloor + 2
$$

So the $+2$ is $+1$ for fenceposts and $+1$ for the padding. Two checks against the
paper's own model names:

```text
L = 336, P = 16, S = 8  →  ⌊320/8⌋ + 2 = 40 + 2 = 42   →  PatchTST/42  ✓
L = 512, P = 16, S = 8  →  ⌊496/8⌋ + 2 = 62 + 2 = 64   →  PatchTST/64  ✓
```

Sixty-four is the "64 words" of the title.

```{important} Overlapping or not is a deliberate choice
In the **supervised** model $P = 16 > S = 8$, so consecutive patches share half their
content — the token sequence is smoothed. In the **self-supervised** model $P = S = 12$,
i.e. non-overlapping, deliberately: if patches overlapped, a masked patch could be
reconstructed by copying from its neighbour, and the pretext task would be trivial.
```

### What patching buys — geometrically

Attention cost is an **area**: one score per ordered pair of tokens, an $N \times N$
square. Patching divides the *side* of that square by $S$, so it divides the *area* by
$S^2$:

$$
N \approx \frac{L}{S}
\quad\Longrightarrow\quad
O(N^2) \approx O\!\left(\frac{L^2}{S^2}\right)
$$

With $L = 336$ and $S = 8$: $336^2 = 112{,}896$ scores become $42^2 = 1{,}764$. A
**64× reduction**, from one reshape.

!video(images/patchtst/03_complexity.mp4)

![The cost of attention is an area](images/patchtst/fig07_complexity_geometry.svg "The two squares drawn to scale, the scaling curve, and the paper's measured training times: Traffic 10,040 s → 464 s (22×), Electricity 5,730 s → 300 s (19×), Weather 680 s → 156 s (4×).")

Three benefits, in the paper's own ordering:

1. **Local semantics** — a token now means something.
2. **Quadratic reduction** in attention memory and compute at the same $L$.
3. **Longer history at a fixed budget** — which, per the table above, is what lowers error.

And it is not a fragile hyper-parameter. Appendix A.4.1 sweeps
$P \in \{2,4,8,12,16,24,32,40\}$ and MSE varies only in the third decimal.
$P \in \{8, 16\}$ is a good default — patching is a *free* win, not a tuning burden.

## Idea 2 — Channel-independence

### Two ways to build a token from multivariate data

**Channel-mixing** (Informer, Autoformer, FEDformer, TST): the token at time $t$ is the
whole cross-section $x_t \in \mathbb{R}^M$, projected into $\mathbb{R}^D$. All $M$ series
are fused *before* the encoder sees them.

**Channel-independence** (PatchTST): split $x \in \mathbb{R}^{M\times L}$ into $M$
univariate series. Each passes through the **same** backbone with the **same** weights,
producing $\hat{x}^{(i)} \in \mathbb{R}^{1\times T}$; concatenate for
$\hat{x} \in \mathbb{R}^{M\times T}$.

### It is a reshape, not an architecture

Appendix A.1.5 — no special operator is needed at all:

```text
x                :  B × M × L
after patching   :  B × M × P × N
reshape          : (B·M) × P × N      ← channels folded into the batch dimension
```

A stock Transformer implementation consumes that directly and never learns that $M$
series exist. Channel-independence is, literally, a `view()` call.

!video(images/patchtst/04_channel_independence.mp4)

### Why removing cross-channel modelling *helps*

This is the counter-intuitive part: mixing has strictly more expressive power, and it
still loses. Three reasons, each backed by an experiment:

1. **Adaptability.** Each series produces its *own* attention map, so unrelated series can
   use different temporal patterns. A channel-mixing model forces one shared pattern on
   everything.
2. **Sample efficiency.** Learning cross-channel *and* cross-time interactions jointly
   needs far more data. Channel-independent test loss converges faster and lower as the
   training fraction grows — these benchmarks are simply not big enough for mixing to pay off.
3. **Overfitting.** Channel-mixing test loss bottoms out after ~3 epochs and then *climbs*.
   Channel-independent loss keeps falling for 20.

![One backbone, M different attention maps](images/patchtst/fig08_channel_independence.svg "Seven channels through one shared backbone give seven genuinely different attention maps. Similar series get similar maps (correlation 0.47 between series similarity and map similarity) — the same effect the paper reports on Electricity. Meanwhile the input-embedding parameter count grows with M for mixing and stays constant for independence, and each window yields M training samples instead of 1.")

Panel (c) deserves a second look. With $M = 7$ each window becomes **7** training samples
instead of 1. On Traffic, where $M = 862$, that factor is 862. A channel-independent model
sees three orders of magnitude more samples from the same data.

Three practical advantages follow too: noise in one channel can no longer leak into all
the others through a shared embedding; different losses can be assigned per series; and the
number of channels at fine-tuning time need not match pre-training time — which is exactly
what makes transfer and foundation-model use possible.

```{tip} It is not a PatchTST quirk
Table 15 shows channel-independence also improves *Informer, Autoformer and FEDformer*.
It is a general technique that happens to have been demonstrated here.
```

## The forward pass, with shapes

```text
stage                       tensor      shape       PatchTST/42
────────────────────────────────────────────────────────────────
input                       x           M × L         7 × 336
  split channels            x⁽ⁱ⁾        1 × L         1 × 336
  instance norm             x̃⁽ⁱ⁾        1 × L         1 × 336     (x − μ)/σ
  patching                  x_p⁽ⁱ⁾      P × N        16 × 42
  projection + position     x_d⁽ⁱ⁾      D × N       128 × 42      W_p x_p + W_pos
  Transformer encoder × 3   z⁽ⁱ⁾        D × N       128 × 42
  flatten + linear head     x̂⁽ⁱ⁾        1 × T         1 × 96
  denormalise + concat      x̂           M × T         7 × 96
```

Every one of those stages, on real data:

![One real forward pass, layer by layer](images/patchtst/fig02_layer_by_layer.svg "From a 7 × 336 input to the forecast. Panels (d)–(g) are the actual tensors. Note (f): the attention map is 42 × 42, not 336 × 336.")

!video(images/patchtst/08_overview.mp4)

## The encoder mathematics

### Embedding

$$
x_d^{(i)} = W_p\, x_p^{(i)} + W_{\text{pos}},
\qquad
W_p \in \mathbb{R}^{D\times P},
\qquad
W_{\text{pos}} \in \mathbb{R}^{D\times N}
$$

$W_p$ is a **single** trainable linear map, $\mathbb{R}^{16} \to \mathbb{R}^{128}$, applied
to every patch of every channel. $W_{\text{pos}}$ is a learnable additive position code.

Three symbols, and only two of them are the network:

| symbol | what it is | learned? | shape |
| --- | --- | --- | --- |
| $x_p$ | **the data** — your signal, patched | no | $P \times N$ = 16 × 42 |
| $W_p$ | **a layer** — one `nn.Linear(16, 128)` | yes | $D \times P$ = 128 × 16 |
| $W_{\text{pos}}$ | **a parameter** — a position lookup table | yes | $D \times N$ = 128 × 42 |

### The projection, on real numbers

The whole operation is smaller than it looks — one patch of 16 numbers in, one token of
128 out. Worth watching once end to end, through to the part where $W_{\text{pos}}$ pulls
two identical patches apart:

!video(images/patchtst/09_projection.mp4)

Now the same thing in numbers. Start from one channel of one look-back window, after
instance normalisation:

```text
x̃ = [-0.020  0.438  0.959  1.211  1.310  1.454  1.483  1.272
      0.865  0.588  0.479  0.401 -0.025  0.089 -0.195 -0.323  ... ]
```

Patching turns that into $x_p$, a 16 × 42 matrix — 42 columns, each one patch of 16
consecutive values:

```text
patch 0 (steps  0..15): [-0.020  0.438  0.959  1.211  1.310  1.454  1.483  1.272
                          0.865  0.588  0.479  0.401 -0.025  0.089 -0.195 -0.323]

patch 1 (steps  8..23): [ 0.865  0.588  0.479  0.401 -0.025  0.089 -0.195 -0.323
                         -0.513 -0.697 -0.781 -0.796 -0.908 -0.557 -0.493  0.051]
```

Stride 8 into length 16, so the last eight values of patch 0 **are** the first eight of
patch 1. That is the overlap, visible in the numbers.

Now $W_p$ — the whole patch embedder, 128 × 16 = **2048 numbers**:

```text
row  0: [ 0.086  0.205  0.083 -0.326  0.226  0.112 -0.134  0.145 ...]
row  1: [ 0.010 -0.073 -0.195 -0.064  0.002 -0.069  0.324  0.252 ...]
row  2: [-0.094  0.511  0.162  0.166 -0.129 -0.412  0.042  0.027 ...]
```

Each **row** is a learned template over the 16 positions inside a patch. Row 2 is strongly
positive at position 1 and strongly negative at position 5 — a rise-then-fall detector. A
patch with that shape scores high on latent dimension 2.

Projecting one patch is then a matrix–vector product, $(128\times16)(16\times1)$, and
each output dimension is a single dot product:

```text
dimension d = 0:

  W_p[0,:] · x_p[:,0]
    = 0.086×(-0.020) + 0.205×0.438 + 0.083×0.959 + (-0.326)×1.211 + …  (16 terms)
    = -0.0017        + 0.0900      + 0.0792      + (-0.3945)      + …
    = 0.3742

token 0 = [0.374  -0.533  -0.517  0.123  0.212  -0.016  0.101  -0.281  …]   (128 dims)
```

The sixteen raw readings are now gone, replaced by 128 scores — each answering *how much
does this patch resemble my template?* One matmul does all 42 patches at once,
$W_p x_p \to 128 \times 42$, and the same 2048 numbers serve every channel.

Then $W_{\text{pos}}$ is **added**, never multiplied. Column $n$ only ever meets patch $n$:

```text
token 0 before + W_pos : [ 0.374  -0.533  -0.517   0.123]
W_pos column 0         : [ 0.110   0.019  -0.105  -0.017]
                          ─────────────────────────────────
token 0 after  + W_pos : [ 0.484  -0.514  -0.622   0.106]
```

**Why the position code is required.** Attention is permutation-equivariant: permute the
patches and the outputs permute identically. Without $W_{\text{pos}}$ the model literally
cannot tell "10 hours ago" from "3 hours ago".

That is easy to demonstrate rather than assert. Force patch 30 to be an exact copy of
patch 5, then project both:

```text
without W_pos → tokens identical?  True    ← slot 5 and slot 30 are indistinguishable
with    W_pos → tokens identical?  False   ← distinguishable, distance = 1.631
```

$W_p$ alone maps equal shapes to equal tokens *no matter when they happened*. The position
stamp is the only thing breaking that tie.

It is worth seeing *why* that distance is what it is. Both slots receive the same patch, so
both get the same $W_p x_p$ — and when you subtract the two tokens, that shared part
cancels exactly:

$$
\big(W_p x_p + W_{\text{pos}}[:,5]\big) - \big(W_p x_p + W_{\text{pos}}[:,30]\big)
= W_{\text{pos}}[:,5] - W_{\text{pos}}[:,30]
$$

The signal has vanished from the answer. Whatever the patch contained, the gap between two
tokens holding *the same shape* is purely the gap between their position codes — and its
length is the number quoted above:

```text
difference       = [-0.259  -0.108   0.083   0.164   0.119  … ]   (128 entries)
sum of squares   = 2.660
√2.660           = 1.631
```

So $W_p$ decides **what shape** a token carries, and $W_{\text{pos}}$ decides **when** it
happened — two separable jobs, added rather than entangled.

In code, the whole stage is two parameters and one line:

```python
self.W_p   = nn.Linear(P, D)                    # 16 -> 128, shared everywhere
self.W_pos = nn.Parameter(torch.randn(N, D))    # 42 learned position vectors

x_d = self.W_p(x_p) + self.W_pos                # (B*M, N, P) -> (B*M, N, D)
```

```{warning} A layout gotcha when reading the code against the paper
The paper writes $x_p$ as $P \times N$ and $W_p$ as $D \times P$. Implementations carry
patches the other way round — as `(N, P)` — and use `Linear(P → D)`. It is the same
operation in a transposed layout, but it trips up almost everyone comparing the reference
code to the equations.
```

The entire embedding stage is $2048 + 5376 = 7424$ parameters. For contrast, a
channel-**mixing** embedder needs $D \times M$, which grows with the channel count — on
Traffic, where $M = 862$, that is 110,336 parameters. PatchTST's $W_p$ stays at 2048
whatever $M$ is, because it embeds a *patch* rather than a cross-section.

**The geometric reading.** Each patch is a point in $\mathbb{R}^P$ — a *shape*. A linear
map is a rotation, a scaling along axes, and another rotation, so it preserves
neighbourhood structure when it lifts those shapes to $\mathbb{R}^D$. Patches that looked
alike still look alike. Point-wise tokens live in $\mathbb{R}^1$, where there is no shape
to preserve.

![The projection, geometrically](images/patchtst/fig04_projection_geometry.svg "W_p as rotate → scale → rotate, why its rank is at most P, and what goes wrong without W_pos.")

!video(images/patchtst/05_embedding.mp4)

### Attention

For each head $h = 1,\dots,H$:

$$
Q_h^{(i)} = \big(x_d^{(i)}\big)^{\!\top} W_h^Q,
\qquad
K_h^{(i)} = \big(x_d^{(i)}\big)^{\!\top} W_h^K,
\qquad
V_h^{(i)} = \big(x_d^{(i)}\big)^{\!\top} W_h^V
$$

$$
\big(O_h^{(i)}\big)^{\!\top} = \text{Attention}(Q_h, K_h, V_h)
= \text{Softmax}\!\left(\frac{Q_h K_h^{\top}}{\sqrt{d_k}}\right) V_h
$$

with $W_h^Q, W_h^K \in \mathbb{R}^{D\times d_k}$ and $W_h^V \in \mathbb{R}^{D\times D}$,
giving $O_h^{(i)} \in \mathbb{R}^{D\times N}$. Read it in three steps.

**1. Score.** For patches $n$ and $m$:

$$
s_{nm} = \frac{q_n \cdot k_m}{\sqrt{d_k}}
       = \frac{\|q_n\|\,\|k_m\|\cos\theta}{\sqrt{d_k}}
$$

The dot product is an **alignment** measure: how much does patch $n$'s question match patch
$m$'s advertisement. With patch tokens this asks "does this rising-edge shape resemble that
one" — a meaningful question. With point tokens it was a comparison of two numbers.

**2. Softmax.**

$$
\alpha_{nm} = \frac{\exp(s_{nm})}{\sum_{m'} \exp(s_{nm'})},
\qquad \alpha_{nm} \ge 0, \qquad \sum_m \alpha_{nm} = 1
$$

The weight vector lives on the probability simplex.

**3. Output.**

$$
o_n = \sum_m \alpha_{nm}\, v_m
$$

Because the weights are non-negative and sum to one, this is a **convex combination** — so
the output can only land **inside the convex hull of the value vectors**. That is the entire
geometry of attention: it picks a point inside a polygon whose vertices are the $N$ patch
values. Uniform weights give the centroid. One dominant weight lands near a vertex. A
handful of relevant patches gives an interior point.

![Attention, geometrically](images/patchtst/fig05_attention_geometry.svg "42 value vectors, their convex hull, and all 42 attention outputs — 100% of which land inside, not by coincidence but by identity. Middle: the effective number of patches attended as the score scale changes. Right: one row of A under three scalings.")

!video(images/patchtst/06_attention.mp4)

**Why $\sqrt{d_k}$?** The score $q \cdot k$ is a sum of $d_k$ products. For roughly
independent, unit-variance entries, $\text{Var}(q\cdot k) = d_k$, so raw scores grow like
$\sqrt{d_k}$. Leave them unscaled and softmax saturates: the weights become one-hot, the
output snaps to a vertex of the hull, and the softmax gradient vanishes. Dividing by
$\sqrt{d_k}$ keeps scores $O(1)$ and the output in the polygon's **interior**, where
gradients still flow. The middle panel above measures exactly this — at the paper's
scaling, about 7 of 42 patches are effectively attended.

### BatchNorm, not LayerNorm

Each encoder block is Multi-Head Attention → Add & Norm → Feed-Forward → Add & Norm, with
**BatchNorm** rather than the usual LayerNorm. Zerveas et al. (2021) found BatchNorm wins
for time-series Transformers: outlier time steps are handled better when statistics are
pooled across the batch than across the features of a single token.

Defaults: 3 layers, $H = 16$, $D = 128$, feed-forward $128 \to 256 \to 128$ with GELU,
dropout 0.2. Small datasets (ILI, ETTh1, ETTh2) drop to $H=4$, $D=16$ to avoid overfitting.

### Head and loss

Flatten $z^{(i)} \in \mathbb{R}^{D\times N}$ to $\mathbb{R}^{D\cdot N}$ — that is 5376
numbers — and apply one linear layer of shape $(D\cdot N) \times T$:

$$
\mathcal{L} = \mathbb{E}_x \left[\frac{1}{M}\sum_{i=1}^{M}
\big\| \hat{x}^{(i)}_{L+1:L+T} - x^{(i)}_{L+1:L+T} \big\|_2^2 \right]
$$

Plain MSE, averaged over channels. Note this is a **direct multi-step** forecast — the
whole horizon in one shot. No autoregressive decoding, so no error accumulation, and no
decoder at all.

### Instance normalisation

Each instance is normalised to zero mean and unit variance **before** patching, and $\mu$,
$\sigma$ are **added back** to the output:

$$
\tilde{x}^{(i)} = \frac{x^{(i)} - \mu^{(i)}}{\sigma^{(i)}}
$$

This attacks distribution shift. A test window sitting at a different level or scale than
anything in training becomes, after normalisation, the same kind of object the encoder was
trained on.

![Instance normalisation is an affine map that collapses the drift](images/patchtst/fig06_instance_norm_geometry.svg "Every look-back window is a point in (μ, σ) space, and that cloud drifts — this is the distribution shift. The normalisation collapses all 142 windows onto (0, 1), so the encoder only ever sees shape. μ and σ are added back to the prediction, so nothing is lost.")

!video(images/patchtst/07_head_norm_mask.mp4)

```{note} An honest ablation
Table 11: instance norm helps, but only slightly — PatchTST beats the baselines on most
datasets **even without it**. The gains genuinely come from patching and
channel-independence, not from a normalisation trick.
```

## Self-supervised pre-training

Remove the forecasting head, attach a small $D \times P$ linear head, switch to
**non-overlapping** patches ($L = 512$, $P = 12 \Rightarrow N = 42$), select **40%** of
patch indices uniformly at random, set those patches to **zero**, and train with MSE to
reconstruct them.

Two design points, both arguing against the prior art (Zerveas et al. 2021, which masked
individual time steps):

1. **Masking a time step is too easy.** A missing value is recoverable by interpolating its
   immediate neighbours, so the model learns local smoothing rather than structure. A
   missing *patch* of $P$ steps cannot be interpolated — recovering it requires
   understanding the signal's global behaviour.
2. **The output head stays small.** Reconstructing per-time-step representations needs a
   matrix of size $(L\cdot D) \times (M\cdot T)$, which is enormous and overfits when
   downstream data is scarce. The patch head is just $D \times P$.

Because weights are shared across channels, the number of series during pre-training need
not match the number during fine-tuning — this is what makes transfer possible.

The results: on the large datasets, pre-train + fine-tune beats supervised-from-scratch.
Even **linear probing** — freeze everything, train only the head for 20 epochs — is
competitive with full supervised training and beats DLinear. Pre-training on Electricity
and fine-tuning on Weather or Traffic is slightly worse than same-dataset pre-training,
still better than all baselines, at a fraction of the cost.

And against contrastive representation methods on ETTh1 — BTSF, [TS2Vec](post.html?p=ts2vec-explained),
TNC, TS-TCC — PatchTST improves by **34.5% to 48.8%** depending on the prediction length.

## Results at a glance

- 8 datasets (Weather, Traffic, Electricity, ILI, ETTh1/h2, ETTm1/m2), horizons
  $T \in \{96, 192, 336, 720\}$.
- **PatchTST/64** ($L = 512$): **−21.0% MSE, −16.7% MAE** vs the best Transformer baseline.
- **PatchTST/42** ($L = 336$, matched to DLinear's window): **−20.2% MSE, −16.4% MAE**.
- Beats DLinear broadly, especially on the large datasets and ILI.
- **Figure 2 of the paper is the most important plot in it**: as $L$ grows from 24 to 720,
  baseline Transformers get *worse* — they cannot use the extra history — while PatchTST
  monotonically improves. That is the direct rebuttal to "are Transformers effective?".
- Ablation: patching alone helps, channel-independence alone helps, both together are best.
  Some non-patching variants **run out of memory on a 48 GB A40 at batch size 1**.

## Honest limitations

- **Cross-channel dependence is thrown away.** The paper admits this and calls it future
  work. Crossformer, iTransformer and TSMixer attack exactly this. PatchTST's message is
  "mixing *as previously done* was worse than nothing", not "cross-series information is
  useless".
- **The head is $(D\cdot N) \times T$.** For $D=128, N=42, T=720$ that is ~3.9 M parameters
  in one flat layer — the bulk of the model.
- **Fixed-length input.** $W_{\text{pos}}$ and the flattened head both hard-code $N$, so
  $L$ and $T$ are baked in; a separate model is trained per horizon.
- **Padding with the repeated last value** injects a small artificial flat segment into the
  final patch.
- **Exchange-rate was excluded** from the benchmark, on the grounds that a random walk makes
  $\hat{x}_t = x_{t-1}$ unbeatable. Defensible — but it is a dataset where the method would
  not shine.

## In one sentence

PatchTST wins by fixing the *input*, not the architecture: group time steps into patches so
a token carries a shape instead of a scalar, which simultaneously gives attention something
meaningful to compare and cuts its cost by $S^2$; then run every channel through one shared
backbone as a separate sample, which multiplies the training data by $M$ and stops one
series' noise from contaminating the rest — leaving a completely vanilla Transformer encoder
that beats both the sparse-attention Transformers and the linear model that had embarrassed
them.

```{seealso} Reference and reproducibility
Nie, Nguyen, Sinthong, Kalagnanam, *A Time Series is Worth 64 Words: Long-term Forecasting
with Transformers*, ICLR 2023 — [arXiv:2211.14730](https://arxiv.org/abs/2211.14730).

The animations were made with [Manim](https://www.manim.community/). The figures come from
a NumPy implementation of the model — every number plotted is computed, not drawn. Three
honesty notes that are also printed on the figures themselves: the data is synthetic;
$W_p$ and $W_{\text{pos}}$ are at random initialisation, and appear only where the point is
what a *linear map* does, which is weight-independent; and attention is computed with
$W^Q = W^K = I$, so a score is exactly patch-shape similarity rather than a random map that
could be mistaken for learned structure. The prediction head **is** fitted — ridge
regression on the flattened representation, the paper's linear-probing protocol — scoring a
held-out MSE of 0.072 against 1.188 for a last-value baseline.
```
