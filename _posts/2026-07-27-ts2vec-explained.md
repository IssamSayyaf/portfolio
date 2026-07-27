---
title: TS2Vec, explained from scratch
date: 2026-07-27
tags: [time series, self-supervised, contrastive learning, representation learning]
excerpt: How TS2Vec learns one vector per timestamp with no labels at all — two overlapping crops, a mask, a dilated CNN, and a hierarchical contrastive loss. With every equation, worked numbers, and animations for the parts that need motion.
draft: false
---

Labels for time series are expensive and rare. Getting a clinician to annotate every
heartbeat, or a human to tag every second of accelerometer data, does not scale.
Unlabelled time series, meanwhile, are everywhere — sensors, logs, telemetry, finance.

**TS2Vec** turns that asymmetry into a method. It learns to map a raw time series to
useful vectors — one per timestamp — **without ever seeing a label**. Once trained,
the encoder is frozen, and classification, forecasting and anomaly detection each ride
on top of it with a tiny, cheap head: an SVM, a ridge regression, a threshold.

This post walks through the whole method: what each piece does, why it exists, and how
the maths works. Three short animations cover the parts that are much easier to see
moving than to read about.

![The big picture: raw series in, embeddings out](images/ts2vec/ts2vec_big_picture.svg "Input: a series with T timestamps and C channels. Output: a T × 320 matrix — one vector per timestamp.")

```{note} What you get at the end
An encoder $f_\theta$ such that a series $x \in \mathbb{R}^{T \times C}$ becomes
$r \in \mathbb{R}^{T \times 320}$. Nothing in training ever told it what "walking",
"anomalous" or "next value" means.
```

## The core idea: learn by comparison

The network is never told *this is walking* or *this value comes next*. It plays a
matching game instead:

> Take one true moment in time. Look at it through **two slightly different views**.
> Those two views should map to almost the same vector — they are a **positive pair**.
> Every *other* moment is an **impostor** and should map somewhere else.

Pull positives together, push impostors apart, repeat. To win this game the encoder has
to discover what actually characterises a moment — its local shape, trend and dynamics —
because that is the only thing two views of the same instant share.

![Master architecture diagram](images/ts2vec/ts2vec_master_architecture_diagram.svg "The full pipeline. The sections below walk through each stage.")

## Step 1 — Two overlapping crops

From one input series, TS2Vec cuts two random windows that are **required to overlap**.

![Two overlapping crops](images/ts2vec/ts2vec_overlapping_crops.svg "View A = [a₁, b₁), View B = [a₂, b₂). Only timestamps in the overlap can form positive pairs — they are the only ones present in both views.")

Because each crop starts and ends somewhere different, the encoder sees each shared
timestamp surrounded by **different context** each time. Forcing the two results to
agree teaches robustness: the vector for a moment should not flip just because the
window edges moved. The paper calls this **contextual consistency**.

## Step 2 — Linear projection

Each raw timestamp — a vector of $C$ channel readings — goes through a single linear
layer, shared across all timestamps:

$$
z_t = W x_t + b, \qquad W \in \mathbb{R}^{H \times C}, \qquad
z_t[d] = \sum_{c=1}^{C} W_{dc}\, x_t[c] + b_d
$$

Simple, but it does one subtle job that the next step depends on.

![Why the projection matters for masking](images/ts2vec/ts2vec_latent_geometry_mask_token.svg "In raw space, zero is a legitimate reading. After the projection, the bias b shifts real data off the origin, so an all-zero vector no longer looks like data — and can safely mean 'masked'.")

## Step 3 — Timestamp masking

In latent space, TS2Vec randomly erases timestamps:

$$
m_t = \beta_t \, z_t, \qquad \beta_t \sim \text{Bernoulli}(0.5) \ \ \text{i.i.d. per timestamp}
$$

![Masking mechanics](images/ts2vec/ts2vec_masking_mechanics.svg "Each timestamp is kept or zeroed by its own coin flip. The two views get independent masks, so the holes fall in different places.")

Masking is **training-only** — at inference you feed the full sequence. The zeroed
positions are gaps the encoder must fill from surrounding context, which pushes it to
understand a moment from its neighbourhood instead of memorising the raw value at that
instant. Same intuition as masked language modelling, applied to signals.

## Step 4 — The encoder: a dilated CNN

Ten residual blocks of 1-D convolutions. Two design choices carry the weight:
**dilation** and **non-causal** kernels.

![Encoder architecture](images/ts2vec/ts2vec_encoder_architecture.svg "Projection → masking → dilated residual blocks → r.")

### Dilation: seeing far with few layers

A kernel-3 convolution normally sees a timestamp and its two neighbours. Dilated
convolutions skip over gaps that **double every block** — 1, 2, 4, 8, …, 512:

$$
y_{o,p} = b_o + \sum_{i=1}^{C_{\text{in}}} \sum_{k=-1}^{1} W_{o,i,k}\; x_{i,\,p+kd}
$$

The receptive field then grows exponentially in depth, with no coverage holes:

$$
RF(L) = 1 + 2\sum_{i=0}^{L-1} 2^{i} = 2^{L+1} - 1
$$

Ten blocks reach about **2047 timestamps** from ten cheap layers. That is much easier
to watch than to read:

!video(images/ts2vec/dilated_receptive_field.mp4)

![Dilated receptive field grows exponentially](images/ts2vec/dilated_conv_receptive_field_tree.svg "The same structure as a static tree.")

### Non-causal: looking both ways

Forecasting models like WaveNet and TCN are **causal** — an output may only look at the
past, so it cannot cheat by peeking at the future. TS2Vec is doing *representation*
learning, not next-step prediction, so it can look both ways.

![Causal vs non-causal convolutions](images/ts2vec/causal_vs_noncausal_dilated_conv.svg "Same-padding, non-causal convolutions let each timestamp's vector be informed by both its past and its future.")

### One residual block

Two convolutions with a GELU between them, plus a skip connection:

$$
\text{GELU}(x) = 0.5\,x\left(1 + \tanh\left(\sqrt{2/\pi}\,\left(x + 0.044715\,x^{3}\right)\right)\right)
$$

$$
r = \text{conv}_2\big(\text{GELU}(\text{conv}_1(m))\big) + m
$$

The skip is what lets ten blocks train without the gradient vanishing. The last block
widens the channels to the output size — 320 in the paper — giving $r$ of shape
$T \times 320$.

## Step 5 — One encoder, called twice

A point people often miss: there are **not two networks**. One encoder, one set of
weights, called first on View A and then on View B.

![Siamese: one encoder, shared weights](images/ts2vec/ts2vec_siamese_shared_weights.svg "r = f(A), r' = f(B). Shared weights mean both views are measured with the same ruler — which is what makes 'they should agree' a meaningful demand.")

During backpropagation, gradients flow back through **both** forward passes into that
single set of weights.

## Step 6 — The two contrastive losses

Now compare $r$ and $r'$ on the overlapping timestamps. TS2Vec uses two complementary
losses. Both share the *same* positive pair $(r_{i,t},\, r'_{i,t})$ — same series $i$,
same timestamp $t$, two views. They differ only in **who counts as an impostor**.

### Instance contrast — "which *series* is this?"

Impostors are the other series in the batch, at the same timestamp:

$$
\ell^{(i,t)}_{\text{inst}} = -\log
\frac{\exp\!\big(r_{i,t} \cdot r'_{i,t}\big)}
{\sum_{j=1}^{B}\Big(\exp\!\big(r_{i,t} \cdot r'_{j,t}\big) + \mathbf{1}[j \neq i]\,\exp\!\big(r_{i,t} \cdot r_{j,t}\big)\Big)}
$$

![Instance contrast, signal view](images/ts2vec/instance_contrast_signal_view.svg "Four recordings share one frozen instant t. For series 1 both crops contain t, so its two views form the positive pair. The same instant in the other three recordings are impostors.")

```{important} A positive is bookkeeping, not content
Nothing about the *signal* decides what counts as positive — only the indices do:
same series, same timestamp, the other view. The model never gets a hint about
similarity of content.
```

### Temporal contrast — "which *moment* is this?"

Impostors are the other timestamps of the same series, over the overlap $\Omega$:

$$
\ell^{(i,t)}_{\text{temp}} = -\log
\frac{\exp\!\big(r_{i,t} \cdot r'_{i,t}\big)}
{\sum_{t' \in \Omega}\Big(\exp\!\big(r_{i,t} \cdot r'_{i,t'}\big) + \mathbf{1}[t' \neq t]\,\exp\!\big(r_{i,t} \cdot r_{i,t'}\big)\Big)}
$$

This is the harder game of the two: neighbouring timestamps genuinely resemble the
anchor, so the impostor scores sit much closer to the positive.

### What a batch actually is

Worth being concrete, because it decides who the impostors are:

![One stream sliced into windows](images/ts2vec/one_series_windowing_strategy.png "With one long recording, the batch is windows of that same stream — so 'other series' means 'other time periods of the same sensor'.")

### The loss, by hand

Both losses are a softmax over dot-product similarities, then $-\log$ of the positive's
probability. On toy 2-D vectors you can trace every number:

![Loss computation: signals to vectors](images/ts2vec/loss_computation_signals_to_vectors.svg "Two views of the same series point in nearly the same direction; different series diverge.")

![Full similarity-matrix computation](images/ts2vec/instance_similarity_matrix_full_computation.svg "All pairwise dot products at one timestamp, and the loss read off for anchor a₁.")

```text
exp(0.96)  = 2.61     ← the positive pair
exp(−0.70) = 0.50     ← impostor
exp(−0.58) = 0.56     ← impostor
Z = 2.61 + 0.50 + 0.56 = 3.67
p(positive) = 2.61 / 3.67 = 0.71
loss(a₁) = −ln(0.71)  = 0.34
```

Repeat per anchor and average. The diagonal — a vector's similarity with itself — is
removed with the usual masking trick, so nothing is ever its own impostor.

The temporal matrix for the same toy example shows why it is the harder objective:

![Temporal similarity matrix](images/ts2vec/temporal_similarity_matrix_and_total.png "Impostor scores of 0.40–0.54 against a positive of 0.96: p drops to 0.46 and the loss rises to 0.78.")

### Combining them

At one scale the two are simply averaged, with $\alpha = 0.5$:

$$
\mathcal{L}_{\text{dual}} = \alpha\,\mathcal{L}_{\text{inst}} + (1-\alpha)\,\mathcal{L}_{\text{temp}}
$$

## Step 7 — Hierarchical contrasting

A single timestamp captures fine detail, but plenty of structure lives at coarser
scales — a whole gait cycle, a daily rhythm. TS2Vec captures all of them with a pyramid:
compute $\mathcal{L}_{\text{dual}}$, max-pool over time, compute it again, repeat.

$$
z^{(l+1)}_{d,u} = \max\!\big(z^{(l)}_{d,2u},\; z^{(l)}_{d,2u+1}\big)
$$

$$
\mathcal{L}_{\text{total}} = \frac{1}{D}\sum_{l=0}^{D-1} \mathcal{L}^{(l)}_{\text{dual}}
$$

Each pooling step roughly doubles the real-world span each vector summarises:

!video(images/ts2vec/hierarchical_pooling.mp4)

Contrasting at every level is what makes the representation good for split-second detail
**and** long-range structure at once. It is the hierarchy that gives the method much of
its accuracy — and its name.

## How it actually learns

Learning is nudging weights to lower the loss. For one anchor,
$\ell = -\log p^{+} = -s^{+} + \log Z$, where $s^{+}$ is the positive pair's score and
$Z$ sums $e^{s}$ over all candidates:

$$
p_j = \frac{e^{s_j}}{\sum_k e^{s_k}}, \qquad \ell = -\log p^{+} = -s^{+} + \log Z
$$

Differentiating gives the whole instinct of contrastive learning in two lines:

$$
\frac{\partial \ell}{\partial s^{+}} = p^{+} - 1 \;\; (<0), \qquad
\frac{\partial \ell}{\partial s_j} = p_j \;\; (>0) \ \text{ for each impostor}
$$

The positive's score is pushed **up**, every impostor's score is pushed **down**, and the
size of each nudge is exactly how wrong the model currently is. Since each score is a dot
product $s_x = a \cdot x$, the gradient at the anchor is a weighted sum of the candidates:

$$
\nabla_a \ell = (p^{+} - 1)\,b + p_c\,c + p_d\,d
$$

That is the animation below — one gradient step, with the numbers from the worked
example above:

!video(images/ts2vec/contrastive_pull_push.mp4)

You can confirm the analytic gradient with a finite difference before taking the usual
descent step:

$$
\frac{\partial \ell}{\partial a_1} \approx \frac{\ell(a_1 + \varepsilon) - \ell(a_1)}{\varepsilon},
\qquad a \leftarrow a - \eta\,\nabla_a \ell
$$

From there the gradient flows back through each forward operation, one rule per layer:

| Forward operation | Backward rule |
| --- | --- |
| residual $r = y_2 + m$ | $\partial\ell/\partial y_2 = \partial\ell/\partial r$, and it **adds** into $\partial\ell/\partial m$ |
| conv weights | $\partial\ell/\partial W_{o,i,k} = \sum_p \delta_{o,p}\, x_{i,\,p+kd}$ |
| GELU | $\partial\ell/\partial y_1 = \partial\ell/\partial g \odot \text{GELU}'(y_1)$ |
| mask $m_t = \beta_t z_t$ | $\partial\ell/\partial z_t = \beta_t\, \partial\ell/\partial m_t$ — masked slots get **zero** gradient |
| projection | $\partial\ell/\partial W = \sum_{t,\text{views}} \delta_t x_t^{\top}$, $\;\partial\ell/\partial b = \sum_{t,\text{views}} \delta_t$ |

Two of those rows explain design choices made earlier. The residual giving the gradient a
direct path back is why ten stacked blocks train stably. And because the mask multiplies
by $\beta_t$, a zeroed timestamp contributes no gradient at all — the network only learns
from slots it was allowed to see.

## What the representation looks like afterwards

The encoder is never told a class name, yet the geometry organises itself by behaviour:

![Emergent clustering after training](images/ts2vec/emergent_clustering_walking_windows.png "Early in training the activities are mixed. After training, windows of the same activity land near each other — purely from the contrastive game.")

Notice the clusters are tight but **not collapsed**. Mapping everything to a single point
would trivially satisfy "pull positives together"; the instance loss forbids it by
demanding every recording stay tellable-apart. Same dynamics land nearby, but distinct.

## Using the frozen encoder

This is where the method pays off. Pretrain once — the expensive part — then freeze.

![Two-phase training](images/ts2vec/training_phases_per_task.png "One shared pretraining, then a cheap head per task.")

- **Classification** — embed labelled windows once, fit an SVM or one linear layer.
- **Forecasting** — build pairs (representation, future values) and solve a **ridge
  regression** in closed form. No batches, no gradient descent.
- **Anomaly detection** — nothing to train at all. Score a point by how much the
  representation disagrees when the last value is masked versus visible, then calibrate a
  threshold on known-normal data.

That last one deserves a picture, because the trick is subtle — the score compares two
encodings of windows that differ **only** in the newest sample:

![Masked-last vs all-true encoding](images/ts2vec/spike_last_vs_past_visual.png "When the spike is the newest sample the two encodings disagree sharply. Five steps later the spike sits in both windows' shared past, cancels out, and the score returns to normal.")

```{tip} Why the score does not keep firing
Anything both windows contain — including an old spike — appears in both embeddings and
vanishes when you subtract them. That is what stops one anomaly from smearing across
every subsequent timestamp.
```

The encoder never sees a label, a forecast target or an anomaly example. All task
knowledge enters in the cheap second phase, and the **same frozen encoder serves all
three heads at once**.

## In one sentence

TS2Vec learns, with no labels, to turn each timestamp of a time series into a vector — by
cropping two overlapping views, masking them, encoding both with **one** dilated CNN, and
using a **hierarchical instance-and-temporal contrastive loss** to pull matching moments
together and push everything else apart — after which a frozen encoder powers
classification, forecasting and anomaly detection with tiny, cheap heads.

```{seealso} Reference
Yue et al., *TS2Vec: Towards Universal Representation of Time Series*, AAAI 2022 —
[arXiv:2106.10466](https://arxiv.org/abs/2106.10466).
The animations here were made with [Manim](https://www.manim.community/).
```
