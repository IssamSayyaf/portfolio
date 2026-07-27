/* Blog archive: posts grouped by year, with tag filtering. */
(function () {
  'use strict';

  var host = document.getElementById('post-archive');

  function esc(s) { return window.MD.escapeHtml(s); }

  function tagList(tags, active) {
    if (!tags || !tags.length) return '';
    return tags.map(function (t) {
      var on = active && active.toLowerCase() === t.toLowerCase();
      return '<a class="page__taxonomy-item" href="?tag=' + encodeURIComponent(t) + '"' +
             (on ? ' style="background:var(--accent);border-color:var(--accent);color:#fff"' : '') +
             '>' + esc(t) + '</a>';
    }).join(' ');
  }

  function render(posts, activeTag) {
    if (!posts.length) {
      host.innerHTML = '<div class="notice"><p>No posts here yet.' +
        (activeTag ? ' <a href="blog.html">Show all posts</a>.' : '') + '</p></div>';
      return;
    }

    var html = '';
    if (activeTag) {
      html += '<p class="page__meta">Showing posts tagged <strong>' + esc(activeTag) +
              '</strong> &middot; <a href="blog.html">clear filter</a></p>';
    }

    var currentYear = null;
    posts.forEach(function (p) {
      if (p.year !== currentYear) {
        currentYear = p.year;
        html += '<h2 class="archive__subtitle">' + currentYear + '</h2>';
      }
      html += '<article class="archive__item">' +
        '<h3 class="archive__item-title">' +
          '<a href="post.html?p=' + encodeURIComponent(p.slug) + '">' + esc(p.title) + '</a>' +
          (p.draft ? ' <span class="page__taxonomy-item">Draft</span>' : '') +
        '</h3>' +
        '<p class="page__meta">' + esc(p.dateLabel) +
          '<span class="page__meta-sep"></span>' + p.readTime + ' min read' +
          (p.tags && p.tags.length ? '<span class="page__meta-sep"></span>' + tagList(p.tags, activeTag) : '') +
        '</p>' +
        '<p class="archive__item-excerpt">' + esc(p.excerpt) + '</p>' +
      '</article>';
    });

    host.innerHTML = html;
  }

  var activeTag = new URLSearchParams(window.location.search).get('tag');

  fetch('posts.json?' + Date.now())
    .then(function (r) {
      if (!r.ok) throw new Error('posts.json not found');
      return r.json();
    })
    .then(function (data) {
      var posts = (data.posts || []).filter(function (p) { return !p.draft; });
      if (activeTag) {
        posts = posts.filter(function (p) {
          return (p.tags || []).some(function (t) {
            return t.toLowerCase() === activeTag.toLowerCase();
          });
        });
      }
      render(posts, activeTag);
    })
    .catch(function () {
      host.innerHTML = '<div class="notice notice--danger"><p><strong>No posts index found.</strong> ' +
        'Run <code>python3 tools/build_index.py</code> to generate <code>posts.json</code> from the ' +
        '<code>_posts/</code> folder.</p></div>';
    });
})();
