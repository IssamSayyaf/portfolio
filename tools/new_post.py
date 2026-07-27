#!/usr/bin/env python3
"""Create a new blog post and refresh the index.

    python3 tools/new_post.py "Building a Yocto BSP for the STM32MP157"
    python3 tools/new_post.py "Fixed-point maths on Cortex-M" --tags dsp,firmware
    python3 tools/new_post.py "Half-finished idea" --draft
    python3 tools/new_post.py "Backdated note" --date 2026-05-01

Writes _posts/YYYY-MM-DD-slug.md, then regenerates posts.json and feed.xml.
"""

from __future__ import annotations

import argparse
import datetime
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / "_posts"

TEMPLATE = """---
title: {title}
date: {date}
tags: [{tags}]
draft: {draft}
---

Open with a paragraph that says what the reader will get out of this post — it
doubles as the excerpt shown on the blog index.

## Background

Write the setup here. Inline formatting works as usual: **bold**, *italic*,
`inline code`, [links](https://example.com) and maths such as $y = Wx + b$.

```{{note}} Why this matters
Admonitions render as the coloured boxes from the reference site. Available
kinds: note, tip, warning, important, seealso. Add `:class: dropdown` on the
first line to make the box collapsible.
```

## How it works

```c
// Code blocks get a language label and a copy button.
int main(void) {{
    return 0;
}}
```

Drop an image in `images/` and reference it on a line of its own — the quoted
string becomes the caption:

```text
![Alt text for screen readers](images/your-image.png "Figure 1. The caption.")
```

## Results

| Setting | Before | After |
| --- | --- | --- |
| Boot time | 4.2 s | 1.8 s |

## Takeaway

Close with what you would tell a colleague in one paragraph.
"""


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", text) or "post"


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a new blog post.")
    parser.add_argument("title", help="post title, in quotes")
    parser.add_argument("--tags", default="", help="comma-separated tags")
    parser.add_argument("--date", default="", help="YYYY-MM-DD (default: today)")
    parser.add_argument("--slug", default="", help="override the URL slug")
    parser.add_argument("--draft", action="store_true", help="hide from the blog index")
    args = parser.parse_args()

    if args.date:
        try:
            date = datetime.date.fromisoformat(args.date)
        except ValueError:
            sys.exit(f"error: --date must be YYYY-MM-DD, got {args.date!r}")
    else:
        date = datetime.date.today()

    slug = slugify(args.slug or args.title)
    POSTS_DIR.mkdir(exist_ok=True)
    path = POSTS_DIR / f"{date.isoformat()}-{slug}.md"

    if path.exists():
        sys.exit(f"error: {path.relative_to(ROOT)} already exists — pick another title or --slug")

    tags = ", ".join(t.strip() for t in args.tags.split(",") if t.strip())
    path.write_text(
        TEMPLATE.format(
            title=args.title,
            date=date.isoformat(),
            tags=tags,
            draft="true" if args.draft else "false",
        ),
        encoding="utf-8",
    )

    print(f"created {path.relative_to(ROOT)}")
    subprocess.run([sys.executable, str(ROOT / "tools" / "build_index.py")], check=True)
    print(f"\npreview it:  python3 -m http.server  ->  http://localhost:8000/post.html?p={slug}")
    print("publish it:  git add -A && git commit -m 'post: " + args.title + "' && git push")


if __name__ == "__main__":
    main()
