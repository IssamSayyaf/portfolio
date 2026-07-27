# issamsayyaf.github.io — portfolio & blog

A static site: no build step for the pages, no framework, no database.
Deployed to GitHub Pages by `.github/workflows/static.yml` on every push to `main`.

The design follows two references:

- the **site pages** use the Minimal Mistakes / AcademicPages look —
  masthead nav, sticky author sidebar, `#b83a4b` accent
  (as on <https://yanndubs.github.io/>);
- the **blog post pages** use the Jupyter Book / sphinx-book-theme look —
  left navigation, right-hand *Contents* panel, prev/next footer, admonitions,
  copy buttons, MathJax
  (as on <https://yanndubs.github.io/Neural-Process-Family/text/Intro.html>).

---

## Adding a blog post

### 1. Create it

```bash
python3 tools/new_post.py "Building a Yocto BSP for the STM32MP157" --tags yocto,embedded-linux
```

This writes `_posts/2026-07-27-building-a-yocto-bsp-for-the-stm32mp157.md`
from a template and regenerates the index.

Options:

| Flag | Effect |
| --- | --- |
| `--tags a,b` | comma-separated tags, shown on the index and clickable as filters |
| `--date 2026-05-01` | backdate the post (default: today) |
| `--slug custom-url` | override the URL slug derived from the title |
| `--draft` | keep it out of the index, sidebar and feed until you are ready |

### 2. Write it

Open the new file in `_posts/`. The top block is the metadata:

```yaml
---
title: Building a Yocto BSP for the STM32MP157
date: 2026-07-27
tags: [yocto, embedded-linux]
excerpt: Optional. Generated from the body when omitted.
draft: false
---
```

Everything below it is Markdown. Supported syntax:

| Syntax | Result |
| --- | --- |
| `## Heading` | section heading, auto-added to the *Contents* panel |
| `**bold**` `*italic*` `` `code` `` `~~strike~~` | inline formatting |
| `[text](url)` | link (external links open in a new tab) |
| `![alt](images/x.png "Caption")` | figure with a caption |
| `!video(https://youtu.be/…)` | YouTube / Vimeo / `.mp4` embed |
| ` ```c … ``` ` | code block with a language label and a copy button |
| ` ```{note} Title … ``` ` | callout box — `note`, `tip`, `warning`, `important`, `seealso` |
| `:class: dropdown` | first line inside a callout, makes it collapsible |
| `$x$` and `$$…$$` | inline and display maths, rendered by MathJax |
| `- item` / `1. item` | lists, nestable with two-space indents |
| `> quote` | blockquote |
| `\| a \| b \|` | table |

Images go in `images/` and are referenced as `images/your-file.png`.

### 3. Preview it

```bash
python3 -m http.server
```

Then open <http://localhost:8000/blog.html>. Opening the HTML files directly
with `file://` will **not** work — the blog fetches `posts.json` and the
Markdown files over HTTP.

### 4. Publish it

```bash
git add -A
git commit -m "post: yocto bsp"
git push
```

GitHub Actions rebuilds `posts.json`, uploads the site and deploys it.

---

## Editing or deleting a post

Edit or delete the file in `_posts/`, then rebuild the index:

```bash
python3 tools/build_index.py
```

`posts.json` is what the blog index, the post sidebar and the RSS feed read.
The GitHub Actions workflow regenerates it on every push, so forgetting this
locally cannot break the live site — but your local preview will be stale until
you run it.

---

## Layout

```
index.html            home — bio, expertise, selected projects, recent posts
experience.html       experience, education, talks
projects.html         projects, grouped into embedded / PhD / AI
publications.html     peer-reviewed papers and datasets
blog.html             blog archive, grouped by year, filterable by tag
post.html             single-post reader (?p=slug) in the Jupyter Book style
CV.dc.html, cv.pdf    CV, online and PDF

_posts/*.md           the articles — the only files you edit to write
posts.json            generated index (do not edit by hand)
feed.xml              generated RSS feed (do not edit by hand)

assets/css/site.css   theme for the site pages
assets/css/book.css   theme for the post pages
assets/js/markdown.js Markdown renderer
assets/js/site.js     masthead behaviour
assets/js/blog.js     blog archive
assets/js/post.js     post reader: sidebar, contents panel, prev/next

tools/new_post.py     create a post + rebuild the index
tools/build_index.py  rebuild posts.json and feed.xml
images/               images used by the pages and the posts
```

## Editing the site pages

The site pages are plain HTML — edit them directly. The masthead, author
sidebar and footer are repeated in each page; if you change a nav link, change
it in `index.html`, `experience.html`, `projects.html`, `publications.html` and
`blog.html`. `post.html` has its own book-style sidebar instead.

Update `SITE_URL` at the top of `tools/build_index.py` if the site ever moves to
a different domain — it is used to build the RSS feed links.
