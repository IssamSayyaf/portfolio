#!/usr/bin/env python3
"""Build posts.json (and feed.xml) from the Markdown files in _posts/.

Run this after adding, editing, renaming or deleting a post:

    python3 tools/build_index.py

Every post is a Markdown file named  _posts/YYYY-MM-DD-some-slug.md  with a
YAML front-matter block at the top:

    ---
    title: How I build a Yocto BSP
    date: 2026-07-27
    tags: [yocto, embedded linux]
    excerpt: Optional. Generated from the body when omitted.
    draft: false
    ---
"""

from __future__ import annotations

import datetime
import json
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / "_posts"
INDEX_FILE = ROOT / "posts.json"
FEED_FILE = ROOT / "feed.xml"

SITE_URL = "https://issamsayyaf.github.io/portfolio"
SITE_TITLE = "Issam Sayyaf — Blog"
SITE_DESC = "Notes on time-series deep learning, embedded ML, firmware and signal processing."

WORDS_PER_MINUTE = 200
EXCERPT_CHARS = 200

FILENAME_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})-(.+)$")


# --------------------------------------------------------------------------
# Front matter
# --------------------------------------------------------------------------

def parse_front_matter(text: str) -> tuple[dict, str]:
    """Split a post into its front-matter mapping and its Markdown body."""
    text = text.lstrip("﻿").replace("\r\n", "\n").replace("\r", "\n")
    match = re.match(r"^---\n(.*?)\n---\n?", text, re.DOTALL)
    if not match:
        return {}, text

    meta: dict = {}
    for line in match.group(1).split("\n"):
        kv = re.match(r"^([A-Za-z_][\w-]*)\s*:\s*(.*)$", line)
        if not kv:
            continue
        key, raw = kv.group(1).strip(), kv.group(2).strip()
        value: object = raw.strip("\"'")
        if raw.startswith("[") and raw.endswith("]"):
            value = [v.strip().strip("\"'") for v in raw[1:-1].split(",") if v.strip()]
        elif raw.lower() in ("true", "false"):
            value = raw.lower() == "true"
        meta[key] = value

    return meta, text[match.end():]


# --------------------------------------------------------------------------
# Text helpers — kept in step with assets/js/markdown.js
# --------------------------------------------------------------------------

def to_plain_text(md: str) -> str:
    md = re.sub(r"```.*?```", " ", md, flags=re.DOTALL)
    md = re.sub(r"~~~.*?~~~", " ", md, flags=re.DOTALL)
    md = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", md)
    md = re.sub(r"!video\([^)]*\)", " ", md)
    md = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", md)
    md = re.sub(r"^\s{0,3}#{1,6}\s+", "", md, flags=re.MULTILINE)
    md = re.sub(r"^\s*>\s?", "", md, flags=re.MULTILINE)
    md = re.sub(r"^\s*[-*+]\s+", "", md, flags=re.MULTILINE)
    md = re.sub(r"[*_`~#|]", "", md)
    return re.sub(r"\s+", " ", md).strip()


def read_time(md: str) -> int:
    words = len(to_plain_text(md).split())
    return max(1, round(words / WORDS_PER_MINUTE))


def make_excerpt(md: str, limit: int = EXCERPT_CHARS) -> str:
    text = to_plain_text(md)
    if len(text) <= limit:
        return text
    cut = text[:limit]
    space = cut.rfind(" ")
    return (cut[:space] if space > 60 else cut).rstrip() + "…"


def as_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(v) for v in value if str(v).strip()]
    if isinstance(value, str) and value.strip():
        return [v.strip() for v in value.split(",") if v.strip()]
    return []


# --------------------------------------------------------------------------
# Collect
# --------------------------------------------------------------------------

def collect_posts() -> list[dict]:
    if not POSTS_DIR.is_dir():
        print(f"error: {POSTS_DIR} does not exist", file=sys.stderr)
        return []

    posts: list[dict] = []
    seen_slugs: dict[str, str] = {}

    for path in sorted(POSTS_DIR.glob("*.md")):
        meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
        stem = path.stem
        name_match = FILENAME_RE.match(stem)

        # Date: front matter wins, then the filename prefix, then the mtime.
        date_str = str(meta.get("date", "")).strip()
        if not date_str and name_match:
            date_str = "-".join(name_match.groups()[:3])
        try:
            date = datetime.date.fromisoformat(date_str[:10])
        except ValueError:
            date = datetime.date.fromtimestamp(path.stat().st_mtime)
            print(f"warning: {path.name} has no usable date, using {date}", file=sys.stderr)

        slug = str(meta.get("slug") or (name_match.group(4) if name_match else stem))
        if slug in seen_slugs:
            print(f"error: duplicate slug '{slug}' in {path.name} and {seen_slugs[slug]}",
                  file=sys.stderr)
            sys.exit(1)
        seen_slugs[slug] = path.name

        title = str(meta.get("title") or slug.replace("-", " ").capitalize())
        excerpt = str(meta.get("excerpt") or "").strip() or make_excerpt(body)

        posts.append({
            "slug": slug,
            "file": f"_posts/{path.name}",
            "title": title,
            "date": date.isoformat(),
            "dateLabel": f"{date:%B} {date.day}, {date.year}",
            "year": date.year,
            "tags": as_list(meta.get("tags")),
            "excerpt": excerpt,
            "readTime": read_time(body),
            "draft": bool(meta.get("draft", False)),
            "image": str(meta.get("image", "")) or None,
        })

    posts.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
    return posts


# --------------------------------------------------------------------------
# Emit
# --------------------------------------------------------------------------

def write_index(posts: list[dict]) -> None:
    payload = {
        "generated": datetime.datetime.now(datetime.timezone.utc)
                       .replace(microsecond=0).isoformat(),
        "count": len(posts),
        "posts": posts,
    }
    INDEX_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
                          encoding="utf-8")


def write_feed(posts: list[dict]) -> None:
    published = [p for p in posts if not p["draft"]]
    items = []
    for post in published[:20]:
        date = datetime.date.fromisoformat(post["date"])
        pub_date = datetime.datetime(date.year, date.month, date.day,
                                     tzinfo=datetime.timezone.utc)
        link = f"{SITE_URL}/post.html?p={post['slug']}"
        items.append(
            "    <item>\n"
            f"      <title>{xml_escape(post['title'])}</title>\n"
            f"      <link>{xml_escape(link)}</link>\n"
            f"      <guid isPermaLink=\"true\">{xml_escape(link)}</guid>\n"
            f"      <pubDate>{pub_date.strftime('%a, %d %b %Y %H:%M:%S +0000')}</pubDate>\n"
            f"      <description>{xml_escape(post['excerpt'])}</description>\n"
            + "".join(f"      <category>{xml_escape(t)}</category>\n" for t in post["tags"])
            + "    </item>"
        )

    FEED_FILE.write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0">\n'
        "  <channel>\n"
        f"    <title>{xml_escape(SITE_TITLE)}</title>\n"
        f"    <link>{xml_escape(SITE_URL)}/blog.html</link>\n"
        f"    <description>{xml_escape(SITE_DESC)}</description>\n"
        "    <language>en</language>\n"
        + ("\n".join(items) + "\n" if items else "")
        + "  </channel>\n</rss>\n",
        encoding="utf-8",
    )


def main() -> None:
    posts = collect_posts()
    write_index(posts)
    write_feed(posts)

    drafts = sum(1 for p in posts if p["draft"])
    print(f"posts.json: {len(posts)} post(s), {drafts} draft(s)")
    for post in posts:
        flag = " [draft]" if post["draft"] else ""
        print(f"  {post['date']}  {post['slug']}{flag}  ({post['readTime']} min)")


if __name__ == "__main__":
    main()
