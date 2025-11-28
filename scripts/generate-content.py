#!/usr/bin/env python3
"""
Content Generator for Portfolio
Scans markdown files and generates JSON data for blog posts and projects.

Usage:
    python3 scripts/generate-content.py

This script:
1. Scans blog/posts/**/index.md for blog posts
2. Scans projects/**/README.md for projects
3. Extracts frontmatter (YAML header) from each markdown file
4. Generates blog/blog-data.json and projects/projects-data.json
"""

import os
import json
import re
from datetime import datetime
from pathlib import Path

# Configuration
PORTFOLIO_ROOT = Path(__file__).parent.parent
BLOG_POSTS_DIR = PORTFOLIO_ROOT / "blog" / "posts"
PROJECTS_DIR = PORTFOLIO_ROOT / "projects"
BLOG_DATA_FILE = PORTFOLIO_ROOT / "blog" / "blog-data.json"
PROJECTS_DATA_FILE = PORTFOLIO_ROOT / "projects" / "projects-data.json"


def parse_frontmatter(content):
    """Extract YAML frontmatter from markdown content."""
    pattern = r'^---\s*\n(.*?)\n---\s*\n'
    match = re.match(pattern, content, re.DOTALL)

    if not match:
        return {}

    frontmatter = {}
    yaml_content = match.group(1)

    for line in yaml_content.split('\n'):
        line = line.strip()
        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip()

            # Handle arrays
            if value.startswith('[') and value.endswith(']'):
                value = [v.strip().strip('"\'') for v in value[1:-1].split(',')]
            # Handle booleans
            elif value.lower() == 'true':
                value = True
            elif value.lower() == 'false':
                value = False
            # Handle quoted strings
            elif value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]

            frontmatter[key] = value

    return frontmatter


def scan_blog_posts():
    """Scan blog posts directory and extract metadata."""
    posts = []

    if not BLOG_POSTS_DIR.exists():
        print(f"Blog posts directory not found: {BLOG_POSTS_DIR}")
        return posts

    # Scan category directories
    for category_dir in BLOG_POSTS_DIR.iterdir():
        if not category_dir.is_dir():
            continue

        # Scan post directories within category
        for post_dir in category_dir.iterdir():
            if not post_dir.is_dir():
                continue

            md_file = post_dir / "index.md"
            if not md_file.exists():
                continue

            try:
                content = md_file.read_text(encoding='utf-8')
                frontmatter = parse_frontmatter(content)

                if not frontmatter:
                    print(f"Warning: No frontmatter in {md_file}")
                    continue

                # Build post data
                post = {
                    "id": frontmatter.get("id", post_dir.name),
                    "title": frontmatter.get("title", post_dir.name.replace("-", " ").title()),
                    "excerpt": frontmatter.get("excerpt", ""),
                    "author": frontmatter.get("author", "Issam Sayyaf"),
                    "authorTitle": frontmatter.get("authorTitle", "Author"),
                    "date": frontmatter.get("date", datetime.now().strftime("%Y-%m-%d")),
                    "category": frontmatter.get("category", category_dir.name.replace("-", " ").title()),
                    "categorySlug": frontmatter.get("categorySlug", category_dir.name),
                    "tags": frontmatter.get("tags", []),
                    "featured": frontmatter.get("featured", False),
                    "readTime": frontmatter.get("readTime", "5 min read"),
                    "image": frontmatter.get("image", "assets/images/background.png"),
                    "imageCaption": frontmatter.get("imageCaption", ""),
                    "type": "markdown",
                    "path": f"blog/posts/{category_dir.name}/{post_dir.name}/"
                }

                posts.append(post)
                print(f"  Found blog post: {post['title']}")

            except Exception as e:
                print(f"Error processing {md_file}: {e}")

    # Sort by date (newest first)
    posts.sort(key=lambda x: x['date'], reverse=True)
    return posts


def scan_projects():
    """Scan projects directory and extract metadata."""
    projects = []

    if not PROJECTS_DIR.exists():
        print(f"Projects directory not found: {PROJECTS_DIR}")
        return projects

    # Scan category directories
    for category_dir in PROJECTS_DIR.iterdir():
        if not category_dir.is_dir():
            continue
        if category_dir.name in ['assets', 'project.html']:
            continue

        # Scan project directories within category
        for project_dir in category_dir.iterdir():
            if not project_dir.is_dir():
                continue

            md_file = project_dir / "README.md"
            if not md_file.exists():
                continue

            try:
                content = md_file.read_text(encoding='utf-8')
                frontmatter = parse_frontmatter(content)

                if not frontmatter:
                    print(f"Warning: No frontmatter in {md_file}")
                    continue

                # Build project data
                project = {
                    "id": frontmatter.get("id", project_dir.name),
                    "title": frontmatter.get("title", project_dir.name.replace("-", " ").title()),
                    "excerpt": frontmatter.get("excerpt", ""),
                    "description": frontmatter.get("description", ""),
                    "category": frontmatter.get("category", category_dir.name.replace("-", " ").title()),
                    "categorySlug": frontmatter.get("categorySlug", category_dir.name),
                    "tags": frontmatter.get("tags", []),
                    "featured": frontmatter.get("featured", False),
                    "image": frontmatter.get("image", "assets/images/background.png"),
                    "imageCaption": frontmatter.get("imageCaption", ""),
                    "status": frontmatter.get("status", "completed"),
                    "date": frontmatter.get("date", datetime.now().strftime("%Y-%m-%d")),
                    "github": frontmatter.get("github", ""),
                    "demo": frontmatter.get("demo", ""),
                    "technologies": frontmatter.get("technologies", []),
                    "path": f"projects/{category_dir.name}/{project_dir.name}/"
                }

                projects.append(project)
                print(f"  Found project: {project['title']}")

            except Exception as e:
                print(f"Error processing {md_file}: {e}")

    # Sort by date (newest first)
    projects.sort(key=lambda x: x['date'], reverse=True)
    return projects


def generate_blog_json(posts):
    """Generate blog-data.json."""
    # Get unique categories
    categories = {}
    for post in posts:
        cat_slug = post['categorySlug']
        if cat_slug not in categories:
            categories[cat_slug] = {
                "name": post['category'],
                "slug": cat_slug,
                "description": f"Articles about {post['category']}",
                "icon": get_category_icon(cat_slug)
            }

    # Get unique tags
    tags = set()
    for post in posts:
        tags.update(post.get('tags', []))

    data = {
        "posts": posts,
        "categories": list(categories.values()),
        "tags": sorted(list(tags))
    }

    BLOG_DATA_FILE.write_text(json.dumps(data, indent=2), encoding='utf-8')
    print(f"\nGenerated: {BLOG_DATA_FILE}")


def generate_projects_json(projects):
    """Generate projects-data.json."""
    # Get unique categories
    categories = {}
    for project in projects:
        cat_slug = project['categorySlug']
        if cat_slug not in categories:
            categories[cat_slug] = {
                "name": project['category'],
                "slug": cat_slug,
                "description": f"Projects in {project['category']}",
                "icon": get_category_icon(cat_slug)
            }

    data = {
        "projects": projects,
        "categories": list(categories.values()),
        "statuses": {
            "completed": {"label": "Completed", "color": "#27ae60"},
            "in-progress": {"label": "In Progress", "color": "#f39c12"},
            "planned": {"label": "Planned", "color": "#3498db"}
        }
    }

    PROJECTS_DATA_FILE.write_text(json.dumps(data, indent=2), encoding='utf-8')
    print(f"Generated: {PROJECTS_DATA_FILE}")


def get_category_icon(slug):
    """Get Font Awesome icon for category."""
    icons = {
        "zephyr-os": "fas fa-microchip",
        "embedded-systems": "fas fa-microchip",
        "deep-learning": "fas fa-brain",
        "iot": "fas fa-wifi",
        "networking": "fas fa-network-wired",
        "research": "fas fa-flask",
        "machine-learning": "fas fa-brain",
    }
    return icons.get(slug, "fas fa-folder")


def main():
    print("=" * 50)
    print("Portfolio Content Generator")
    print("=" * 50)

    # Ensure scripts directory exists
    os.makedirs(PORTFOLIO_ROOT / "scripts", exist_ok=True)

    print("\nScanning blog posts...")
    posts = scan_blog_posts()
    print(f"Found {len(posts)} blog posts")

    print("\nScanning projects...")
    projects = scan_projects()
    print(f"Found {len(projects)} projects")

    if posts:
        generate_blog_json(posts)

    if projects:
        generate_projects_json(projects)

    print("\n" + "=" * 50)
    print("Done!")
    print("=" * 50)


if __name__ == "__main__":
    main()
