/* ==========================================================================
   markdown.js — the Markdown renderer used by the blog.
   Zero dependencies. Returns HTML plus the heading list used to build the
   right-hand "Contents" table of contents.

   Supported syntax
   ----------------
     # H1 … #### H4          headings (auto anchors)
     **bold**  *italic*  `code`  ~~strike~~
     [text](url)             links
     ![alt](src)             image  ->  <figure>
     ![alt](src "caption")   image with caption
     !video(url)             YouTube / Vimeo / mp4 embed
     - item / 1. item        lists (nestable with 2-space indents)
     > quote                 blockquote
     ```lang … ```           code block (copy button + language label)
     ```{note} Title … ```   admonition: note tip warning important seealso
     | a | b |               tables
     $x$ and $$x$$           maths, passed through to MathJax
     ---                     horizontal rule
   ========================================================================== */

(function (global) {
  'use strict';

  var ADMONITIONS = ['note', 'tip', 'hint', 'warning', 'caution', 'danger',
                     'important', 'seealso', 'attention'];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Inverse of escapeHtml, after dropping tags. Consumers re-escape, so this
     must hand back genuinely plain text. `&amp;` is unescaped last. */
  function stripTags(s) {
    return String(s)
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  // Blocks javascript:/vbscript:/non-image data: URLs from links and images.
  function safeUrl(url) {
    var trimmed = String(url).trim();
    var scheme = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
    if (!scheme) return trimmed;                      // relative URL or anchor
    var name = scheme[1].toLowerCase();
    if (name === 'data') {
      return /^data:image\//i.test(trimmed) ? trimmed : '#';
    }
    return ['http', 'https', 'mailto', 'tel'].indexOf(name) === -1 ? '#' : trimmed;
  }

  function slugify(s) {
    return String(s)
      .toLowerCase()
      .replace(/[`*_~$]/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[^a-z0-9À-ɏ]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section';
  }

  /* ---------------------------------------------------------------------- *
   * Inline formatting
   * ---------------------------------------------------------------------- */

  function renderInline(src) {
    var stash = [];

    function keep(html) {
      stash.push(html);
      return '@@MDSTASH' + (stash.length - 1) + '@@';
    }

    var text = String(src);

    // Protect maths first so * and _ inside formulae survive untouched.
    text = text.replace(/\$\$([\s\S]+?)\$\$/g, function (m) { return keep(m); });
    text = text.replace(/(^|[^\\$])\$([^$\n]+?)\$/g, function (m, pre, body) {
      return pre + keep('$' + body + '$');
    });

    // Protect inline code.
    text = text.replace(/`([^`]+)`/g, function (m, code) {
      return keep('<code>' + escapeHtml(code) + '</code>');
    });

    text = escapeHtml(text);

    // Images before links — the syntaxes overlap.
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
      function (m, alt, src2, title) {
        return '<img src="' + escapeAttr(safeUrl(src2)) + '" alt="' + escapeAttr(alt) + '"' +
               (title ? ' title="' + escapeAttr(title) + '"' : '') + '>';
      });

    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, href) {
      var external = /^https?:\/\//.test(href);
      return '<a href="' + escapeAttr(safeUrl(href)) + '"' +
             (external ? ' target="_blank" rel="noopener"' : '') + '>' + label + '</a>';
    });

    // Bare URLs that were not already turned into links.
    text = text.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (m, pre, url) {
      return pre + '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener">' + url + '</a>';
    });

    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    return text.replace(/@@MDSTASH(\d+)@@/g, function (m, i) { return stash[+i]; });
  }

  /* ---------------------------------------------------------------------- *
   * Block-level helpers
   * ---------------------------------------------------------------------- */

  function videoEmbed(url) {
    var yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    if (yt) {
      return '<iframe class="video-embed" src="https://www.youtube.com/embed/' +
             escapeAttr(yt[1]) + '" allowfullscreen frameborder="0"></iframe>';
    }
    var vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) {
      return '<iframe class="video-embed" src="https://player.vimeo.com/video/' +
             escapeAttr(vm[1]) + '" allowfullscreen frameborder="0"></iframe>';
    }
    return '<video class="video-embed" src="' + escapeAttr(url) + '" controls></video>';
  }

  function figure(alt, src, caption) {
    var html = '<figure><img src="' + escapeAttr(safeUrl(src)) + '" alt="' + escapeAttr(alt) + '" loading="lazy">';
    var text = caption || alt;
    if (text) html += '<figcaption>' + renderInline(text) + '</figcaption>';
    return html + '</figure>';
  }

  function codeBlock(lang, code) {
    return '<div class="highlight-wrapper">' +
           (lang ? '<span class="lang-label">' + escapeHtml(lang) + '</span>' : '') +
           '<button class="copybtn" type="button">Copy</button>' +
           '<pre><code>' + escapeHtml(code) + '</code></pre></div>';
  }

  function tableBlock(rows) {
    var header = rows[0];
    var body = rows.slice(2);
    var html = '<div class="table-wrapper"><table><thead><tr>';
    header.forEach(function (cell) { html += '<th>' + renderInline(cell) + '</th>'; });
    html += '</tr></thead><tbody>';
    body.forEach(function (row) {
      html += '<tr>';
      row.forEach(function (cell) { html += '<td>' + renderInline(cell) + '</td>'; });
      html += '</tr>';
    });
    return html + '</tbody></table></div>';
  }

  function splitRow(line) {
    return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '')
               .split('|').map(function (c) { return c.trim(); });
  }

  function isTableDivider(line) {
    return /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.indexOf('-') !== -1;
  }

  /* ---------------------------------------------------------------------- *
   * Lists — handled recursively so nesting works
   * ---------------------------------------------------------------------- */

  function listItemMatch(line) {
    var m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (!m) return null;
    return { indent: m[1].length, ordered: /\d/.test(m[2]), text: m[3] };
  }

  function renderList(lines, start, baseIndent, ctx) {
    var first = listItemMatch(lines[start]);
    var tag = first.ordered ? 'ol' : 'ul';
    var html = '<' + tag + '>';
    var i = start;

    while (i < lines.length) {
      var item = listItemMatch(lines[i]);
      if (!item || item.indent < baseIndent) break;

      if (item.indent > baseIndent) {
        var nested = renderList(lines, i, item.indent, ctx);
        html = html.replace(/<\/li>$/, nested.html + '</li>');
        i = nested.next;
        continue;
      }

      var buf = [item.text];
      i++;
      // Continuation lines belonging to the same bullet.
      while (i < lines.length && !listItemMatch(lines[i]) && lines[i].trim() !== '' &&
             !/^(#{1,6}\s|```|~~~|>|\||---)/.test(lines[i].trim())) {
        buf.push(lines[i].trim());
        i++;
      }
      html += '<li>' + renderInline(buf.join(' ')) + '</li>';
    }

    return { html: html + '</' + tag + '>', next: i };
  }

  /* ---------------------------------------------------------------------- *
   * Main block parser
   * ---------------------------------------------------------------------- */

  function render(src, options) {
    var opts = options || {};
    var anchors = opts.anchors !== false;
    var lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var headings = [];
    var seenIds = {};
    var i = 0;

    function makeId(text) {
      var base = slugify(text);
      var id = base;
      var n = 2;
      while (seenIds[id]) { id = base + '-' + n; n++; }
      seenIds[id] = true;
      return id;
    }

    while (i < lines.length) {
      var line = lines[i];
      var trimmed = line.trim();

      if (trimmed === '') { i++; continue; }

      /* ---- fenced blocks: code + admonitions ---------------------------- */
      var fence = trimmed.match(/^(```+|~~~+)\s*(.*)$/);
      if (fence) {
        var marker = fence[1][0].repeat(3);
        var info = fence[2].trim();
        var buf = [];
        i++;
        while (i < lines.length && !new RegExp('^\\s*' + marker).test(lines[i])) {
          buf.push(lines[i]);
          i++;
        }
        i++; // closing fence

        var adm = info.match(/^\{([a-z-]+)\}\s*(.*)$/i);
        if (adm && ADMONITIONS.indexOf(adm[1].toLowerCase()) !== -1) {
          var kind = adm[1].toLowerCase();
          var title = adm[2].trim();
          var dropdown = false;
          // Strip MyST option lines such as ":class: dropdown".
          while (buf.length && /^\s*:[a-z-]+:/i.test(buf[0])) {
            if (/dropdown/i.test(buf[0])) dropdown = true;
            buf.shift();
          }
          var inner = render(buf.join('\n'), { anchors: false });
          var label = title || (kind.charAt(0).toUpperCase() + kind.slice(1));
          var cls = 'admonition ' + kind;
          if (dropdown) {
            out.push('<details class="' + cls + '"><summary class="admonition-title">' +
                     renderInline(label) + '</summary><div class="admonition-body">' +
                     inner.html + '</div></details>');
          } else {
            out.push('<div class="' + cls + '"><p class="admonition-title">' +
                     renderInline(label) + '</p><div class="admonition-body">' +
                     inner.html + '</div></div>');
          }
        } else {
          out.push(codeBlock(info.split(/\s+/)[0], buf.join('\n')));
        }
        continue;
      }

      /* ---- display maths ------------------------------------------------ */
      if (trimmed === '$$') {
        var math = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '$$') { math.push(lines[i]); i++; }
        i++;
        out.push('<div class="math-block">$$' + escapeHtml(math.join('\n')) + '$$</div>');
        continue;
      }
      if (/^\$\$.*\$\$$/.test(trimmed)) {
        out.push('<div class="math-block">' + escapeHtml(trimmed) + '</div>');
        i++;
        continue;
      }

      /* ---- headings ------------------------------------------------------ */
      var head = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (head) {
        var level = Math.min(head[1].length, 4);
        var raw = head[2].replace(/\s*#+\s*$/, '');
        var id = makeId(raw);
        var inner2 = renderInline(raw);
        /* The contents panel wants plain text, so take the *rendered* heading and
           strip it back down — otherwise `*helps*` reaches the TOC with its
           asterisks still attached. */
        if (level > 1) headings.push({ level: level, id: id, text: stripTags(inner2) });
        var anchor = anchors
          ? '<a class="headerlink" href="#' + id + '" title="Link to this heading">¶</a>'
          : '';
        out.push('<h' + level + ' id="' + id + '">' + inner2 + anchor + '</h' + level + '>');
        i++;
        continue;
      }

      /* ---- horizontal rule ----------------------------------------------- */
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        out.push('<hr>');
        i++;
        continue;
      }

      /* ---- video ---------------------------------------------------------- */
      var vid = trimmed.match(/^!video\(([^)]+)\)$/);
      if (vid) {
        out.push(videoEmbed(vid[1].trim()));
        i++;
        continue;
      }

      /* ---- standalone image -> figure -------------------------------------- */
      var img = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
      if (img) {
        out.push(figure(img[1], img[2], img[3]));
        i++;
        continue;
      }

      /* ---- blockquote ------------------------------------------------------ */
      if (/^>\s?/.test(trimmed)) {
        var quote = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        var q = render(quote.join('\n'), { anchors: false });
        out.push('<blockquote>' + q.html + '</blockquote>');
        continue;
      }

      /* ---- table ------------------------------------------------------------ */
      if (trimmed.indexOf('|') !== -1 && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
        var rows = [];
        while (i < lines.length && lines[i].indexOf('|') !== -1 && lines[i].trim() !== '') {
          rows.push(isTableDivider(lines[i]) ? [] : splitRow(lines[i]));
          i++;
        }
        out.push(tableBlock(rows));
        continue;
      }

      /* ---- list -------------------------------------------------------------- */
      var li = listItemMatch(line);
      if (li) {
        var result = renderList(lines, i, li.indent, {});
        out.push(result.html);
        i = result.next;
        continue;
      }

      /* ---- paragraph ---------------------------------------------------------- */
      var para = [];
      while (i < lines.length && lines[i].trim() !== '' &&
             !/^(#{1,6}\s|```|~~~|>\s?|\s*[-*+]\s|\s*\d+[.)]\s|!video\(|\$\$)/.test(lines[i].trim()) &&
             !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
             !/^!\[[^\]]*\]\([^)\s]+(\s+"[^"]*")?\)$/.test(lines[i].trim())) {
        para.push(lines[i].trim());
        i++;
      }
      if (para.length === 0) { // safety: never stall
        para.push(lines[i].trim());
        i++;
      }
      out.push('<p>' + renderInline(para.join(' ')) + '</p>');
    }

    return { html: out.join('\n'), headings: headings };
  }

  /* ---------------------------------------------------------------------- *
   * Front matter + plain-text helpers
   * ---------------------------------------------------------------------- */

  // Parses the leading `---` YAML block of a post file.
  function parseFrontMatter(raw) {
    var text = String(raw).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    var meta = {};
    var m = text.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!m) return { meta: meta, body: text };

    m[1].split('\n').forEach(function (line) {
      var kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
      if (!kv) return;
      var key = kv[1].trim();
      var value = kv[2].trim().replace(/^["'](.*)["']$/, '$1');
      if (/^\[.*\]$/.test(value)) {
        value = value.slice(1, -1).split(',')
          .map(function (v) { return v.trim().replace(/^["'](.*)["']$/, '$1'); })
          .filter(Boolean);
      }
      meta[key] = value;
    });

    return { meta: meta, body: text.slice(m[0].length) };
  }

  // Markdown -> plain text, for excerpts and read-time estimates.
  function toPlainText(md) {
    return String(md)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/~~~[\s\S]*?~~~/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/!video\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/[*_`~#|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readTime(md) {
    var words = toPlainText(md).split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }

  function excerpt(md, limit) {
    var max = limit || 200;
    var text = toPlainText(md);
    if (text.length <= max) return text;
    var cut = text.slice(0, max);
    var lastSpace = cut.lastIndexOf(' ');
    return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trim() + '…';
  }

  global.MD = {
    render: render,
    renderInline: renderInline,
    parseFrontMatter: parseFrontMatter,
    toPlainText: toPlainText,
    readTime: readTime,
    excerpt: excerpt,
    slugify: slugify,
    escapeHtml: escapeHtml
  };
})(window);
