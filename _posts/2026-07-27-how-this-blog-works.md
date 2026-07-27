---
title: How this blog works
date: 2026-07-27
tags: [meta, writing]
excerpt: Every post is one Markdown file in _posts/. This one doubles as a formatting reference — delete it once you have written your own.
draft: false
---

Every article on this site is a single Markdown file in the `_posts/` folder,
committed to the repository like any other source file. There is no database and
no admin panel: if the file is in git, the post is live; if it is not, it is not.

This post is also the formatting reference. Keep it while you get used to the
syntax, then delete the file and rebuild.

## Adding a post

Run the helper script, which creates the file and refreshes the index:

```bash
python3 tools/new_post.py "Building a Yocto BSP for the STM32MP157" --tags yocto,embedded-linux
```

Write the article, preview it locally, then push:

```bash
python3 -m http.server          # then open http://localhost:8000/blog.html
git add -A && git commit -m "post: yocto bsp" && git push
```

GitHub Pages rebuilds on push, and the post appears on the blog index within a
minute or so.

```{note} The one rule
After you add, rename or delete a post file, `posts.json` has to be regenerated —
that file is what the blog index reads. `new_post.py` does it for you, and the
GitHub Actions workflow does it again on every push, so a forgotten rebuild
cannot break the live site.
```

## Front matter

The block at the very top of the file sets the metadata:

```yaml
---
title: How this blog works
date: 2026-07-27
tags: [meta, writing]
excerpt: Optional — generated from the first lines of the body when omitted.
draft: false
---
```

Set `draft: true` to keep a post out of the index, the sidebar and the feed while
you work on it. The read time is counted automatically at 200 words per minute.

## Text formatting

The usual Markdown works: **bold**, *italic*, `inline code`, ~~strikethrough~~ and
[links](https://github.com/IssamSayyaf). Lists nest with two-space indents:

- Embedded Linux
  - Yocto and BitBake
  - Device tree
- Firmware
  1. Bring-up
  2. Drivers

> Blockquotes are useful for pulling out a specification sentence you are about
> to argue with.

## Code blocks

Fence code with three backticks and a language name. The language label sits in
the corner, and a copy button appears on hover:

```c
static int mpu6050_read_raw(struct iio_dev *indio_dev,
                            struct iio_chan_spec const *chan,
                            int *val, int *val2, long mask)
{
    struct mpu6050_data *data = iio_priv(indio_dev);

    switch (mask) {
    case IIO_CHAN_INFO_RAW:
        return mpu6050_read_channel(data, chan, val);
    default:
        return -EINVAL;
    }
}
```

## Admonitions

Five kinds of callout box are available — `note`, `tip`, `warning`, `important`
and `seealso`:

```{tip} Measure before you optimise
A perf trace on the target beats an afternoon of guessing about the host.
```

```{warning} Secure boot is one-way
Burning the OTP fuses on a development board cannot be undone. Keep one unfused
board on the bench.
```

Add `:class: dropdown` under the opening line to make a box collapsible, which is
handy for long derivations:

```{seealso} Where the maths comes from
:class: dropdown
The reconstruction error of an autoencoder over a window of IMU samples is

$$
\mathcal{L}(x) = \| x - g(f(x)) \|_2^2
$$

and a sample is flagged as anomalous when $\mathcal{L}(x)$ exceeds a threshold
fitted on clean data.
```

## Maths

Inline maths uses single dollars — $\sigma^2 = \frac{1}{N}\sum_i (x_i - \mu)^2$ —
and display maths uses a `$$` block on its own lines:

$$
\hat{y}_t = \sum_{k=0}^{N-1} h_k \, x_{t-k}
$$

Rendering is handled by MathJax, so standard LaTeX macros are available.

## Figures, tables and video

An image on a line by itself becomes a figure; the quoted string is its caption:

![Anomaly detection results on IMU data](images/anomaly_detection_results.png "Reconstruction error over a walking sequence, with the detection threshold in red.")

Tables use the usual pipe syntax:

| Model | Parameters | Inference on Cortex-M4 |
| --- | --- | --- |
| AE | 12 k | 3.1 ms |
| VAE | 18 k | 4.4 ms |
| USAD | 24 k | 5.9 ms |

A `!video(...)` line on its own embeds YouTube, Vimeo or an `.mp4` file:

```text
!video(https://www.youtube.com/watch?v=VIDEO_ID)
```

## Where things live

| Path | What it is |
| --- | --- |
| `_posts/*.md` | one file per article — the only thing you edit to write |
| `posts.json` | generated index the site reads |
| `tools/new_post.py` | creates a post and rebuilds the index |
| `tools/build_index.py` | rebuilds `posts.json` and `feed.xml` |
| `images/` | drop images here and reference them as `images/name.png` |

That is the whole system. Write the file, run the script, push.
