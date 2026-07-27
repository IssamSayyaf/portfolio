---
name: verify-site
description: Verify the site actually works before reporting a change as done — serve it, sweep every page for 4xx responses, page errors and mobile overflow, drive the interactive blog features, and screenshot what changed. Use after editing any HTML, CSS, JS, post or tooling in this repo.
---

# Verifying the site

Never report a change as working without running this. A headless Chrome is at
`/usr/bin/google-chrome`.

## 1. Serve

```bash
python3 tools/build_index.py && (python3 -m http.server 8765 >/dev/null 2>&1 &) && sleep 1.5
```

Kill it afterwards with `pkill -f "http.server 8765"` (exits 144 — that is the
kill signal, not a failure).

## 2. Full sweep — the check that catches most regressions

Needs `puppeteer-core` (install once into the scratchpad, not the repo:
`npm i --no-save puppeteer-core`).

```js
const p = require('./node_modules/puppeteer-core');
(async () => {
  const b = await p.launch({executablePath:'/usr/bin/google-chrome', args:['--no-sandbox']});
  const bad = [];
  for (const u of ['index.html','experience.html','projects.html','publications.html',
                   'blog.html','blog.html?tag=meta','post.html?p=how-this-blog-works',
                   'post.html?p=nope','post.html']) {
    const pg = await b.newPage();
    pg.on('response', r => { if (r.status() >= 400) bad.push(u+' -> '+r.status()+' '+r.url()); });
    pg.on('pageerror', e => bad.push(u+' -> PAGEERROR '+e.message));
    await pg.goto('http://localhost:8765/'+u, {waitUntil:'networkidle2'});
    await pg.setViewport({width:390, height:800});
    const overflow = await pg.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) bad.push(u+' -> HORIZONTAL OVERFLOW at 390px');
    await pg.close();
  }
  console.log(bad.length ? bad.join('\n') : 'clean: no 4xx, no page errors, no overflow');
  await b.close();
})();
```

**Expected: completely clean.** Two 404s were fixed already (a missing favicon
and a placeholder image in the post template) — if either returns, it is a
regression.

## 3. Interactive checks (post page)

Drive these with puppeteer when touching `post.js` or `markdown.js`:

- **sidebar search** — type `unicode`; it must match a post titled `Ünïcode`
  (diacritic folding). Clearing restores all entries.
- **copy button** — click `.copybtn`; label goes `Copy` → `Copied`.
- **scroll-spy** — scroll down; exactly one `#bd-toc-nav a.active` should track
  the current section.
- **prev/next** — links to the *older* post as "Previous"; the strip hides
  itself entirely when there is only one post.

## 4. Renderer checks (markdown.js)

Run the parser in node and confirm nothing throws, hangs or leaks:

`markdown.js` attaches itself to `window`, so stub it before requiring:

```bash
node -e "
global.window = {};
require('./assets/js/markdown.js');
const MD = window.MD;
const r = MD.render('# Title\n\n\`\`\`{note} Hi\nbody\n\`\`\`');
console.log(r.html);
console.log('headings:', r.headings);
"
```

Adversarial inputs that must stay safe: unclosed fences, `#nospace`, unclosed
`!video(`, empty/whitespace-only input, nested blockquotes, tables with no body,
`<script>` injection, deep list nesting, prose containing `$5`, bare digits, and
Markdown inside code spans. Also confirm `[x](javascript:alert(1))` renders
`href="#"` and no `@@MDSTASH` sentinel leaks into the output.

## 5. Screenshots

For any visual change, look at it:

```bash
google-chrome --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=1440,2100 --virtual-time-budget=7000 \
  --screenshot=shot.png "http://localhost:8765/index.html"
```

Crop tall pages with PIL to inspect a region. Note that screenshot text shows
colour fringing from subpixel antialiasing — sample actual pixel values before
concluding a colour is wrong.

## 6. Tooling checks

```bash
python3 tools/build_index.py          # run twice: output must be identical bar `generated`
node --check assets/js/post.js        # syntax
```

Also confirm every `file` path in `posts.json` exists on disk, and that the
duplicate-slug guard still exits 1.
