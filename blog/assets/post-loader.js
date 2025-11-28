/**
 * Markdown Blog Post Loader
 * Loads and renders markdown content with full support for:
 * - Images, code blocks, tables, blockquotes
 * - Syntax highlighting
 * - Table of contents generation
 * - Reading time calculation
 */

class MarkdownPostLoader {
    constructor() {
        this.postData = null;
        this.markdownContent = '';
        this.init();
    }

    async init() {
        try {
            // Get post info from URL or data attribute
            const postPath = this.getPostPath();
            if (postPath) {
                await this.loadMarkdown(postPath);
                this.renderPost();
                this.setupTableOfContents();
                this.setupCodeHighlighting();
                this.updateReadingTime();
            }
        } catch (error) {
            console.error('Error loading post:', error);
            this.showError('Failed to load article content.');
        }
    }

    getPostPath() {
        // Get markdown file path from data attribute or default to index.md
        const container = document.getElementById('markdown-content');
        if (container) {
            return container.dataset.markdown || 'index.md';
        }
        return 'index.md';
    }

    async loadMarkdown(path) {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load markdown: ${response.status}`);
        }
        this.markdownContent = await response.text();
    }

    renderPost() {
        const container = document.getElementById('markdown-content');
        if (!container || !this.markdownContent) return;

        // Configure marked options
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: true,
            mangle: false,
            smartLists: true,
            smartypants: true,
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (e) {
                        console.error('Highlight error:', e);
                    }
                }
                return code;
            }
        });

        // Custom renderer for enhanced features
        const renderer = new marked.Renderer();

        // Enhanced image rendering with lazy loading and captions
        renderer.image = function(href, title, text) {
            // Handle relative paths for assets folder
            if (href.startsWith('./assets/') || href.startsWith('assets/')) {
                // Keep relative path as is
            } else if (!href.startsWith('http') && !href.startsWith('/')) {
                href = 'assets/' + href;
            }

            let html = `<figure class="post-figure">
                <img src="${href}" alt="${text || ''}" loading="lazy" class="post-img" onclick="openImageModal(this)">`;
            if (title || text) {
                html += `<figcaption>${title || text}</figcaption>`;
            }
            html += '</figure>';
            return html;
        };

        // Enhanced code blocks
        renderer.code = function(code, language) {
            const lang = language || 'plaintext';
            const langLabel = lang.charAt(0).toUpperCase() + lang.slice(1);
            let highlightedCode = code;

            if (typeof hljs !== 'undefined' && hljs.getLanguage(lang)) {
                try {
                    highlightedCode = hljs.highlight(code, { language: lang }).value;
                } catch (e) {
                    highlightedCode = code;
                }
            }

            return `<div class="code-block">
                <div class="code-header">
                    <span class="code-lang">${langLabel}</span>
                    <button class="copy-btn" onclick="copyCode(this)">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
                <pre><code class="hljs language-${lang}">${highlightedCode}</code></pre>
            </div>`;
        };

        // Enhanced blockquotes
        renderer.blockquote = function(quote) {
            return `<blockquote class="post-blockquote">
                <i class="fas fa-quote-left quote-icon"></i>
                ${quote}
            </blockquote>`;
        };

        // Enhanced tables
        renderer.table = function(header, body) {
            return `<div class="table-wrapper">
                <table class="post-table">
                    <thead>${header}</thead>
                    <tbody>${body}</tbody>
                </table>
            </div>`;
        };

        // Enhanced headings with anchor links
        renderer.heading = function(text, level) {
            const slug = text.toLowerCase()
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '-');
            return `<h${level} id="${slug}" class="post-heading">
                <a href="#${slug}" class="heading-anchor">#</a>
                ${text}
            </h${level}>`;
        };

        // Enhanced links (open external in new tab)
        renderer.link = function(href, title, text) {
            const isExternal = href.startsWith('http') || href.startsWith('//');
            const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
            const icon = isExternal ? ' <i class="fas fa-external-link-alt fa-xs"></i>' : '';
            return `<a href="${href}" title="${title || ''}"${attrs}>${text}${icon}</a>`;
        };

        marked.use({ renderer });

        // Render markdown to HTML
        container.innerHTML = marked.parse(this.markdownContent);

        // Post-processing
        this.processImages();
        this.wrapTables();
    }

    processImages() {
        // Add click handlers for image modal
        const images = document.querySelectorAll('.post-img');
        images.forEach(img => {
            img.style.cursor = 'pointer';
        });
    }

    wrapTables() {
        // Ensure all tables are wrapped for responsive scrolling
        const tables = document.querySelectorAll('table:not(.post-table)');
        tables.forEach(table => {
            if (!table.parentElement.classList.contains('table-wrapper')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'table-wrapper';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
                table.classList.add('post-table');
            }
        });
    }

    setupTableOfContents() {
        const tocContainer = document.getElementById('table-of-contents');
        if (!tocContainer) return;

        const headings = document.querySelectorAll('#markdown-content h2, #markdown-content h3');
        if (headings.length < 2) {
            tocContainer.style.display = 'none';
            return;
        }

        let tocHTML = '<h4><i class="fas fa-list"></i> Table of Contents</h4><ul>';
        headings.forEach(heading => {
            const level = heading.tagName === 'H2' ? '' : 'toc-sub';
            const id = heading.id;
            const text = heading.textContent.replace('#', '').trim();
            tocHTML += `<li class="${level}"><a href="#${id}">${text}</a></li>`;
        });
        tocHTML += '</ul>';
        tocContainer.innerHTML = tocHTML;
    }

    setupCodeHighlighting() {
        // Re-highlight any code blocks that might have been missed
        if (typeof hljs !== 'undefined') {
            document.querySelectorAll('pre code').forEach(block => {
                if (!block.classList.contains('hljs')) {
                    hljs.highlightElement(block);
                }
            });
        }
    }

    updateReadingTime() {
        const content = document.getElementById('markdown-content');
        if (!content) return;

        const text = content.textContent || content.innerText;
        const words = text.split(/\s+/).length;
        const readingTime = Math.ceil(words / 200); // 200 words per minute

        const readingTimeEl = document.getElementById('reading-time');
        if (readingTimeEl) {
            readingTimeEl.textContent = `${readingTime} min read`;
        }
    }

    showError(message) {
        const container = document.getElementById('markdown-content');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error Loading Content</h3>
                    <p>${message}</p>
                </div>
            `;
        }
    }
}

// Utility functions
function copyCode(button) {
    const codeBlock = button.closest('.code-block');
    const code = codeBlock.querySelector('code').textContent;

    navigator.clipboard.writeText(code).then(() => {
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Copied!';
        button.classList.add('copied');
        setTimeout(() => {
            button.innerHTML = originalText;
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

function openImageModal(img) {
    const modal = document.getElementById('image-modal');
    if (modal) {
        const modalImg = modal.querySelector('.modal-image');
        const caption = modal.querySelector('.modal-caption');
        modalImg.src = img.src;
        caption.textContent = img.alt || '';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeImageModal() {
    const modal = document.getElementById('image-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Share functions
function shareOnTwitter() {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(document.title);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${title}`, '_blank');
}

function shareOnLinkedIn() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
}

function shareOnFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
}

function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        alert('Link copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy link:', err);
    });
}

function sharePost() {
    if (navigator.share) {
        navigator.share({
            title: document.title,
            url: window.location.href
        }).catch(console.error);
    } else {
        copyLink();
    }
}

function bookmarkPost() {
    alert('Press Ctrl+D (Cmd+D on Mac) to bookmark this page!');
}

// Mobile navigation toggle
function toggleMobileNav() {
    const navLinks = document.querySelector('.nav-links');
    const navToggle = document.querySelector('.nav-toggle');

    if (navLinks && navToggle) {
        navLinks.classList.toggle('active');
        navToggle.classList.toggle('active');
    }
}

// Close modal on escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeImageModal();
    }
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MarkdownPostLoader();
});
