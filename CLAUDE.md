# CLAUDE.md

Personal portfolio and blog for Issam Sayyaf — a **static site on GitHub Pages**.
No framework, no build step for the pages, no database.

Live at `https://issamsayyaf.github.io/portfolio`. Deployed by
`.github/workflows/static.yml` on every push to `main`.

---

## Who this site is for

Issam is a **Senior Algorithm Engineer, Edge AI at TDK InvenSense** (Grenoble).
His main job is **deep learning on time series** — noisy, multi-modal sensor data
(inertial, acoustic, ultrasonic, pressure, magnetometer, GNSS, RF). PhD in signal
processing and embedded AI (Université Gustave Eiffel, defended June 2026).

**The site leads with time-series deep learning.** Embedded systems is the strong
second — real, deep, but supporting. Keep that ordering when adding content.

His actual TDK scope, in his own words, is: model development (CNNs, RNNs/LSTMs,
Transformers) for forecasting, anomaly detection, gesture recognition and spatial
tracking; time-series Transformers, behavioural embeddings and tokenized sensor
streams; DSP and feature engineering (filtering, windowing, FFT); edge
optimisation (quantization, pruning, ONNX/TensorRT/TensorFlow Lite); streaming
telemetry pipelines; sensor characterisation and experiment design.

---

## Design: two deliberate references

The look is copied — intentionally and closely — from two sites:

| Where | Reference | What it means |
| --- | --- | --- |
| Site pages | [yanndubs.github.io](https://yanndubs.github.io/) — Minimal Mistakes / AcademicPages | Masthead nav with sliding underline, sticky author sidebar, `#b83a4b` accent on `#494e52` text, system sans, year-grouped archive |
| Blog posts | [Neural-Process-Family](https://yanndubs.github.io/Neural-Process-Family/text/Intro.html) — Jupyter Book / sphinx-book-theme | Left nav + search, right "Contents" panel with scroll-spy, ¶ heading anchors, admonition boxes, copy buttons, prev/next, Lato body + Open Sans headings, `#0071bc` accent |

Design tokens were extracted from the real stylesheets of those sites. **Do not
drift from them casually** — if a change makes the site look less like its
reference, that is a regression, not a refresh.

---

## Layout

```
index.html            home — short intro, What I do, selected projects, recent posts, toolbox
experience.html       experience, education, talks
projects.html         time-series → GNSS security → other ML → embedded
publications.html     every paper, with DOIs (see "Publications" below)
blog.html             archive grouped by year, filterable by ?tag=
post.html             single-post reader (?p=slug), Jupyter Book style
CV.dc.html, cv.pdf    CV online + PDF (CV.dc.html needs support.js and _ds/ — leave them)

_posts/*.md           the articles — the only files edited to write
posts.json            GENERATED index the site reads
feed.xml              GENERATED RSS feed

assets/css/site.css   AcademicPages theme (site pages)
assets/css/book.css   Jupyter Book theme (post pages)
assets/js/markdown.js Markdown renderer — zero dependencies
assets/js/site.js     masthead behaviour
assets/js/blog.js     blog archive
assets/js/post.js     post reader: sidebar, contents panel, prev/next, search
assets/favicon.svg    time-series trace with a flagged anomaly

tools/new_post.py     create a post + rebuild the index
tools/build_index.py  rebuild posts.json and feed.xml
images/               images for pages and posts
```

---

## The blog contract

**One post = one Markdown file in `_posts/YYYY-MM-DD-slug.md`, committed to git.**
Front matter: `title`, `date`, `tags: [a, b]`, optional `excerpt`, `draft: true|false`.

`posts.json` is **generated — never hand-edit it**. Regenerate after any add,
rename, edit or delete:

```bash
python3 tools/build_index.py      # or tools/new_post.py, which calls it
```

The GitHub Actions workflow runs `build_index.py` before uploading, so a
forgotten local rebuild cannot break the live site — but the local preview
will be stale until it is run.

Markdown supported by `assets/js/markdown.js`: headings with auto-anchors,
bold/italic/code/strikethrough, links, `![alt](src "caption")` figures,
`!video(url)` embeds, fenced code with language label + copy button,
` ```{note} ``` ` admonitions (`note` `tip` `warning` `important` `seealso`,
plus `:class: dropdown` for collapsible), lists nested with two-space indents,
blockquotes, tables, `$x$` and `$$…$$` maths via MathJax, `---` rules.

### Animations (Manim)

Explainer posts can carry short clips. Rendered `.mp4`s live in
`images/<topic>/` and are embedded with `!video(path)`.

**Scene source is not kept in this repo** — Issam asked for it to be removed.
The clips in `images/ts2vec/` are therefore final artifacts: they cannot be
re-rendered from anything here. If a clip needs changing, the scene has to be
written again from scratch. Write it somewhere scratch, render, copy the mp4 in.

```bash
manim -qm --format=mp4 scene.py SceneName
```

- **There is no LaTeX on this machine.** Use `Text()`, never `MathTex()`/`Tex()`
  — the latter fails to render.
- `-qm` (720p30) keeps clips at 300–500 KB, small enough to commit. Aim for
  6–10 seconds: one concept per clip.
- Set `config.background_color = "#ffffff"` and use the `book.css` palette
  (`#0071bc` accent, `#212529` ink) so clips match the article.
- The frame is 14.22 × 8 units. **Check a rendered frame** — labels near
  `x = ±7` clip silently, and Manim will not warn you.
- Headless Chrome screenshots of a `<video>` often come out blank. That is a
  compositing artifact, not a broken file: verify with `canPlayType` and by
  checking `currentTime` advances after `play()`.

### Non-obvious things in the renderer

- Inline formatting stashes maths and code spans behind an `@@MDSTASHn@@`
  sentinel before escaping. It is ASCII on purpose — an earlier version used
  private-use characters that were written to disk as **NUL bytes**.
- `safeUrl()` rejects `javascript:`, `vbscript:` and non-image `data:` URLs in
  links, images and figures. Keep it wired into all three call sites.
- The sidebar search folds diacritics (`fold()` in `post.js`), so typing
  `unicode` matches a post titled `Ünïcode`.
- The block loop has a deliberate "never stall" fallback in the paragraph
  branch. Do not remove it — unclosed fences and odd lines hit it.

---

## Publications: accuracy rules

**Never invent or approximate a citation.** Every entry on `publications.html`
was verified against three independent sources before being written:

- OpenAlex — `https://api.openalex.org/works?filter=author.id:A5073995173`
- Semantic Scholar — author id `2213316182`
- Crossref — `https://api.crossref.org/works/<DOI>` for the exact container title

Google Scholar (`user=lFrypJ8AAAAJ`) serves a captcha to automated fetches; use
the APIs instead.

Currently **8 papers are indexed**. Issam's CV says "10+" and names
**IEEE I2MTC 2026** and **IPIN 2026**, which are too recent to be indexed —
those are not on the page because their titles are unknown. Ask him rather than
guess. The site deliberately does not print a publication count that its own
list would contradict.

His name appears as **Mohamad Issam Sayyaf** in bibliographic records, rendered
`M. I. Sayyaf` and bolded in author lists.

---

## Content rules

- **Do not fabricate.** Claims come from his CV, his stated job description, or
  a verifiable record. If a detail would be a guess, ask.
- The site says the PhD was **defended June 2026** and the MSc was **110/110 cum
  laude, ranked first in class** — both from the CV.
- The intro on `index.html` is deliberately **short (~120 words)**. He asked for
  it shortened once already. Detail belongs in "What I do", the Toolbox, and the
  Experience page — not the intro.
- There is **no ORCID id on file**. Do not link a placeholder.

---

## Editing the site pages

Plain HTML, edited directly. The masthead, author sidebar and footer are
**duplicated across the five site pages** (`index`, `experience`, `projects`,
`publications`, `blog`). Change a nav link in one, change it in all five.
`post.html` has its own book-style sidebar instead.

That duplication is a deliberate trade: no build step, no JS dependency for the
chrome. Do not "fix" it by moving the chrome into JavaScript.

---

## Commands

```bash
python3 tools/new_post.py "Title" --tags a,b   # new post (+ --draft --date --slug)
python3 tools/build_index.py                   # rebuild posts.json + feed.xml
python3 -m http.server                         # preview at localhost:8000
```

**The site must be served over HTTP.** Opening `file://` fails — the blog fetches
`posts.json` and the Markdown files.

`.nojekyll` exists so GitHub Pages does not strip the underscore-prefixed
`_posts/` directory. Do not delete it.

---

## Before saying a change works

Run the `verify-site` skill. At minimum: serve the site, then check every page
for 4xx responses, page errors and horizontal overflow at 390px. A headless
Chrome is available at `/usr/bin/google-chrome`; `puppeteer-core` drives it for
interactive checks (search, copy buttons, scroll-spy).

Do not report a visual change as done without looking at a screenshot.

---

## Deploying

Never `git push` without being asked — it publishes to the live site.
Commit when asked, and say plainly what is left uncommitted.
