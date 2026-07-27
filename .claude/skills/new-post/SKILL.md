---
name: new-post
description: Write, preview and publish a blog post on this site. Use whenever the user wants to add, draft, edit, rename or delete a post, asks "how do I blog", or wants the writing workflow. Covers the Markdown syntax the renderer supports and the posts.json rebuild that must follow any change to _posts/.
---

# Adding a blog post

One post = one Markdown file in `_posts/YYYY-MM-DD-slug.md`, committed to git.
`posts.json` is generated from that folder and is what the site actually reads.

## 1. Create

```bash
python3 tools/new_post.py "Building a Yocto BSP for the STM32MP157" --tags yocto,embedded-linux
```

| Flag | Effect |
| --- | --- |
| `--tags a,b` | comma-separated tags; clickable filters on the archive |
| `--date 2026-05-01` | backdate (default: today) |
| `--slug custom-url` | override the slug derived from the title |
| `--draft` | hidden from index, sidebar and feed |

The script writes the file **and** rebuilds the index. It refuses to overwrite an
existing file.

## 2. Write

Front matter:

```yaml
---
title: Building a Yocto BSP for the STM32MP157
date: 2026-07-27
tags: [yocto, embedded-linux]
excerpt: Optional — generated from the body when omitted.
draft: false
---
```

Body syntax (all handled by `assets/js/markdown.js`, no library):

| Syntax | Result |
| --- | --- |
| `## Heading` | section heading, auto-anchored, appears in the Contents panel |
| `**b**` `*i*` `` `code` `` `~~del~~` | inline formatting |
| `[text](url)` | link — external ones open in a new tab |
| `![alt](images/x.png "Caption")` | figure with caption |
| `!video(https://youtu.be/…)` | YouTube / Vimeo / `.mp4` embed |
| ` ```c … ``` ` | code block with language label + copy button |
| ` ```{note} Title … ``` ` | callout: `note` `tip` `warning` `important` `seealso` |
| `:class: dropdown` | first line inside a callout → collapsible |
| `$x$`, `$$…$$` | maths via MathJax |
| `- item` / `1. item` | lists, nest with two-space indents |
| `> quote`, `\| a \| b \|`, `---` | blockquote, table, rule |

Images live in `images/` and are referenced as `images/name.png`.

Only H2 and deeper appear in the Contents panel — the H1 is the post title,
rendered from front matter, so **do not put an `# H1` in the body**.

## 3. Preview

```bash
python3 -m http.server
```

Open `http://localhost:8000/blog.html`. `file://` will not work — the page
fetches `posts.json` and the Markdown over HTTP.

## 4. Publish

```bash
git add -A && git commit -m "post: yocto bsp" && git push
```

Only push when the user asks — it publishes to the live site.

## Editing, renaming or deleting

Change the file, then **always**:

```bash
python3 tools/build_index.py
```

Forgetting this leaves the local preview stale. CI reruns it on push, so the
live site self-heals, but a duplicate slug will **fail the build** (exit 1) —
that guard is intentional.
