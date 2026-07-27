/* ==========================================================================
   post.js — renders a single blog post in the Jupyter Book style:
   left navigation, article body, right-hand "Contents" TOC, prev/next.
   ========================================================================== */

(function () {
  'use strict';

  var article = document.getElementById('article');
  var tocNav = document.getElementById('bd-toc-nav');
  var docsNav = document.getElementById('bd-docs-nav');
  var prevNext = document.getElementById('prev-next');
  var crumb = document.getElementById('crumb-title');
  var searchInput = document.getElementById('search-input');

  var slug = new URLSearchParams(window.location.search).get('p');

  function esc(s) { return window.MD.escapeHtml(s); }

  // Lowercase and strip diacritics, so typing "unicode" matches "Ünïcode".
  function fold(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function fail(title, detail) {
    article.innerHTML = '<h1>' + esc(title) + '</h1><p class="error-state">' + detail + '</p>' +
      '<p><a href="blog.html">&larr; Back to all posts</a></p>';
    document.title = title + ' — Issam Sayyaf';
  }

  /* ------------------------------------------------------------------ nav */

  function buildSidebarNav(posts, currentSlug) {
    if (!posts.length) {
      docsNav.innerHTML = '<p class="caption">Posts</p><p class="nav-empty">No posts yet.</p>';
      return;
    }
    var byYear = {};
    var years = [];
    posts.forEach(function (p) {
      if (!byYear[p.year]) { byYear[p.year] = []; years.push(p.year); }
      byYear[p.year].push(p);
    });

    var html = '';
    years.forEach(function (year) {
      html += '<p class="caption">' + year + '</p><ul>';
      byYear[year].forEach(function (p) {
        html += '<li data-title="' + esc(fold(p.title)) +
                '" data-tags="' + esc(fold((p.tags || []).join(' '))) + '">' +
                '<a class="' + (p.slug === currentSlug ? 'current' : '') +
                '" href="post.html?p=' + encodeURIComponent(p.slug) + '">' + esc(p.title) + '</a></li>';
      });
      html += '</ul>';
    });
    html += '<p class="caption">Elsewhere</p><ul>' +
      '<li><a href="index.html">Home</a></li>' +
      '<li><a href="blog.html">All posts</a></li>' +
      '<li><a href="publications.html">Publications</a></li>' +
      '<li><a href="https://scholar.google.co.uk/citations?user=lFrypJ8AAAAJ" target="_blank" rel="noopener">Google Scholar</a></li>' +
      '</ul>';

    docsNav.innerHTML = html;
  }

  function wireSearch() {
    if (!searchInput) return;
    searchInput.addEventListener('input', function () {
      var q = fold(searchInput.value.trim());
      docsNav.querySelectorAll('li[data-title]').forEach(function (li) {
        var hit = !q || li.dataset.title.indexOf(q) !== -1 || li.dataset.tags.indexOf(q) !== -1;
        li.style.display = hit ? '' : 'none';
      });
      // Hide year captions whose posts are all filtered out.
      docsNav.querySelectorAll('p.caption').forEach(function (cap) {
        var list = cap.nextElementSibling;
        if (!list || list.tagName !== 'UL') return;
        var items = list.querySelectorAll('li[data-title]');
        if (!items.length) return;
        var anyVisible = Array.prototype.some.call(items, function (li) {
          return li.style.display !== 'none';
        });
        cap.style.display = anyVisible ? '' : 'none';
        list.style.display = anyVisible ? '' : 'none';
      });
    });
  }

  /* ------------------------------------------------------------------ toc */

  function buildToc(headings) {
    if (!headings.length) {
      tocNav.innerHTML = '<p style="padding:.5rem 0 0 1rem;color:var(--bk-faint);font-size:.8rem">' +
                         'No sections</p>';
      return;
    }
    tocNav.innerHTML = '<ul>' + headings.map(function (h) {
      return '<li class="toc-h' + h.level + '"><a href="#' + h.id + '">' + esc(h.text) + '</a></li>';
    }).join('') + '</ul>';

    var links = Array.prototype.slice.call(tocNav.querySelectorAll('a'));
    var targets = links.map(function (a) { return document.getElementById(a.hash.slice(1)); });

    function spy() {
      var index = 0;
      for (var i = 0; i < targets.length; i++) {
        if (targets[i] && targets[i].getBoundingClientRect().top <= 100) index = i;
      }
      links.forEach(function (a, i) { a.classList.toggle('active', i === index); });
    }
    window.addEventListener('scroll', spy, { passive: true });
    spy();
  }

  /* ------------------------------------------------------------- prev/next */

  function buildPrevNext(posts, i) {
    // posts are newest-first; "previous" reads as the older post.
    var older = posts[i + 1];
    var newer = posts[i - 1];
    var html = '';
    if (older) {
      html += '<a class="prev" href="post.html?p=' + encodeURIComponent(older.slug) + '">' +
        '<span class="arrow">&#8249;</span><span><span class="pn-label">Previous</span>' +
        '<span class="pn-title">' + esc(older.title) + '</span></span></a>';
    }
    if (newer) {
      html += '<a class="next" href="post.html?p=' + encodeURIComponent(newer.slug) + '">' +
        '<span><span class="pn-label">Next</span>' +
        '<span class="pn-title">' + esc(newer.title) + '</span></span><span class="arrow">&#8250;</span></a>';
    }
    prevNext.innerHTML = html;
    // A single post has neither neighbour — don't leave an empty bordered strip.
    prevNext.style.display = html ? '' : 'none';
  }

  /* --------------------------------------------------------- copy buttons */

  function wireCopyButtons() {
    article.querySelectorAll('.copybtn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var code = btn.parentNode.querySelector('code');
        if (!code) return;
        navigator.clipboard.writeText(code.textContent).then(function () {
          btn.textContent = 'Copied';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1600);
        }).catch(function () {
          btn.textContent = 'Press Ctrl+C';
          setTimeout(function () { btn.textContent = 'Copy'; }, 1600);
        });
      });
    });
  }

  /* ------------------------------------------------------------- rendering */

  function renderPost(post, markdown) {
    var parsed = window.MD.parseFrontMatter(markdown);
    var meta = parsed.meta;
    var title = meta.title || post.title;
    var tags = Array.isArray(meta.tags) ? meta.tags : (post.tags || []);

    var result = window.MD.render(parsed.body);

    var header = '<h1>' + esc(title) + '</h1>' +
      '<div class="article-meta">' + esc(post.dateLabel) + ' &middot; ' +
      post.readTime + ' min read' +
      (tags.length ? ' ' + tags.map(function (t) {
        return '<a class="tag" href="blog.html?tag=' + encodeURIComponent(t) + '">' + esc(t) + '</a>';
      }).join('') : '') +
      '</div>';

    article.innerHTML = header + result.html;
    document.title = title + ' — Issam Sayyaf';
    crumb.textContent = title;

    buildToc(result.headings);
    wireCopyButtons();

    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([article]).catch(function () {});
    }

    // Jump to the anchor once the article exists in the DOM.
    if (window.location.hash) {
      var target = document.getElementById(window.location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }

  /* ------------------------------------------------------------------ boot */

  if (!slug) {
    fail('No article selected', 'This page needs a post to show. Pick one from ' +
         '<a href="blog.html">the blog index</a>.');
    docsNav.innerHTML = '';
  } else {
    fetch('posts.json?' + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error('no-index');
        return r.json();
      })
      .then(function (data) {
        var all = data.posts || [];
        var visible = all.filter(function (p) { return !p.draft; });
        buildSidebarNav(visible, slug);
        wireSearch();

        var post = all.filter(function (p) { return p.slug === slug; })[0];
        if (!post) {
          fail('Article not found', 'No post matches <code>' + esc(slug) + '</code>. ' +
               'It may have been renamed — see <a href="blog.html">all posts</a>.');
          return;
        }

        var index = visible.map(function (p) { return p.slug; }).indexOf(slug);
        if (index !== -1) buildPrevNext(visible, index);

        return fetch(post.file + '?' + Date.now()).then(function (r) {
          if (!r.ok) throw new Error('no-file');
          return r.text();
        }).then(function (md) {
          renderPost(post, md);
        });
      })
      .catch(function (err) {
        if (err && err.message === 'no-index') {
          fail('Posts index missing',
               'Run <code>python3 tools/build_index.py</code> to regenerate <code>posts.json</code>.');
        } else {
          fail('Could not load this article',
               'The Markdown file could not be fetched. If you opened this page directly from disk, ' +
               'serve the folder instead: <code>python3 -m http.server</code>.');
        }
      });
  }

  /* --------------------------------------------------------- mobile sidebar */

  var toggle = document.getElementById('sidebar-toggle');
  var sidebar = document.getElementById('site-navigation');
  var backdrop = document.getElementById('sidebar-backdrop');

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-open');
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      sidebar.classList.toggle('is-open');
      backdrop.classList.toggle('is-open');
    });
  }
  if (backdrop) backdrop.addEventListener('click', closeSidebar);
})();
