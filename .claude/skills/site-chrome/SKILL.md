---
name: site-chrome
description: Edit the shared page shell — masthead nav, author sidebar, footer — or the visual theme (colours, fonts, spacing) without breaking the two reference designs. Use when adding or renaming a nav item, changing the bio or social links, restyling, or adding a new top-level page.
---

# Editing the site shell and theme

## The duplication is deliberate

The masthead, author sidebar and footer are **copied into all five site pages**:
`index.html`, `experience.html`, `projects.html`, `publications.html`,
`blog.html`. `post.html` is different — it has the Jupyter Book sidebar instead.

This buys a site with no build step and chrome that renders without JavaScript.
**Do not "fix" it by moving the chrome into JS.**

So: any shell edit is a five-file edit. Do it with a script rather than by hand,
and assert the match count so a silent miss is impossible:

```python
import pathlib
old, new = "...", "..."
for name in ["index.html","experience.html","projects.html","publications.html","blog.html"]:
    p = pathlib.Path(name); s = p.read_text()
    assert s.count(old) == 1, (name, s.count(old))
    p.write_text(s.replace(old, new))
```

Check whether `post.html` also needs the change (favicon and meta tags did; nav
links did not).

## Adding a nav item

1. Add `<li><a href="new.html" data-nav="new">New</a></li>` to `.visible-links`
   in all five pages.
2. Give the new page `<body data-page="new">` — `site.js` matches `data-page`
   against `data-nav` to set the active underline.
3. Copy an existing page as the starting point so the shell stays identical.

## Theme tokens

Site pages — `assets/css/site.css`, from Minimal Mistakes / AcademicPages:

| Token | Value |
| --- | --- |
| text / muted / faint | `#494e52` / `#7a8288` / `#9ba1a6` |
| accent / accent-dark | `#b83a4b` / `#8a2c38` |
| borders | `#f2f3f3`, `#dee0e1` |
| font | system sans (`-apple-system, …, Arial, sans-serif`) |
| page title | `2.441em`; `h2` has a bottom border |

Post pages — `assets/css/book.css`, from Jupyter Book / sphinx-book-theme:

| Token | Value |
| --- | --- |
| text / muted / faint | `#212529` / `#5a5a5a` / `#7d7d7d` |
| accent | `#0071bc` |
| body / heading font | Lato / Open Sans (Google Fonts) |
| sidebar / TOC width | `270px` / `210px` |

These were extracted from the real stylesheets of the reference sites. Changing
them means the site looks less like its reference — treat that as a regression
unless the user asked for it.

## Responsive rules that already hold

- Nothing scrolls horizontally at 390px. Wide things (code, tables) scroll
  inside their own container.
- The author sidebar stacks above the content below 900px.
- The book sidebar becomes a drawer with a backdrop below 900px; the right
  Contents panel is hidden below 1200px.
- `@media print` hides the sidebar, TOC, topbar and prev/next.

Re-check all four after any layout change — see the `verify-site` skill.

## Content voice

Plain, factual, first person. No marketing adjectives. Time-series deep learning
leads; embedded systems supports. The home intro stays short (~120 words) —
detail belongs in "What I do", the Toolbox, or the Experience page.
