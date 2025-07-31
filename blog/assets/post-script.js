// Post-specific JavaScript functionality

// Mobile Navigation Toggle
function toggleMobileNav() {
    const navLinks = document.querySelector('.nav-links');
    const navToggle = document.querySelector('.nav-toggle');
    
    navLinks.classList.toggle('active');
    navToggle.classList.toggle('active');
}

// Close mobile nav when clicking outside
document.addEventListener('click', function(event) {
    const navLinks = document.querySelector('.nav-links');
    const navToggle = document.querySelector('.nav-toggle');
    const header = document.querySelector('.header');
    
    if (!header.contains(event.target) && navLinks.classList.contains('active')) {
        navLinks.classList.remove('active');
        navToggle.classList.remove('active');
    }
});

// Share Functions
function shareOnTwitter() {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(document.title);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=600,height=400');
}

function shareOnLinkedIn() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'width=600,height=400');
}

function shareOnFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
}

function copyLink() {
    const url = window.location.href;
    
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(() => {
            showNotification('Link copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            fallbackCopyTextToClipboard(url);
        });
    } else {
        fallbackCopyTextToClipboard(url);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showNotification('Link copied to clipboard!', 'success');
        } else {
            showNotification('Failed to copy link', 'error');
        }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
        showNotification('Failed to copy link', 'error');
    }
    
    document.body.removeChild(textArea);
}

// Post Actions
function sharePost() {
    if (navigator.share) {
        navigator.share({
            title: document.title,
            text: document.querySelector('meta[name="description"]')?.content || '',
            url: window.location.href
        }).catch(err => console.log('Error sharing:', err));
    } else {
        // Fallback to showing share modal
        showShareModal();
    }
}

function bookmarkPost() {
    const postId = getPostIdFromUrl();
    const postTitle = document.title;
    
    let bookmarks = JSON.parse(localStorage.getItem('bookmarkedPosts') || '[]');
    
    const existingBookmark = bookmarks.find(bookmark => bookmark.id === postId);
    
    if (existingBookmark) {
        // Remove bookmark
        bookmarks = bookmarks.filter(bookmark => bookmark.id !== postId);
        showNotification('Bookmark removed!', 'info');
        updateBookmarkButton(false);
    } else {
        // Add bookmark
        bookmarks.push({
            id: postId,
            title: postTitle,
            url: window.location.href,
            date: new Date().toISOString()
        });
        showNotification('Post bookmarked!', 'success');
        updateBookmarkButton(true);
    }
    
    localStorage.setItem('bookmarkedPosts', JSON.stringify(bookmarks));
}

function updateBookmarkButton(isBookmarked) {
    const bookmarkBtn = document.querySelector('.action-btn:last-child');
    if (bookmarkBtn) {
        const icon = bookmarkBtn.querySelector('i');
        const text = bookmarkBtn.querySelector('span') || bookmarkBtn.childNodes[2];
        
        if (isBookmarked) {
            icon.className = 'fas fa-bookmark';
            if (text) text.textContent = ' Saved';
            bookmarkBtn.style.background = '#667eea';
            bookmarkBtn.style.color = 'white';
            bookmarkBtn.style.borderColor = '#667eea';
        } else {
            icon.className = 'far fa-bookmark';
            if (text) text.textContent = ' Save';
            bookmarkBtn.style.background = 'white';
            bookmarkBtn.style.color = '#666';
            bookmarkBtn.style.borderColor = '#e1e8ed';
        }
    }
}

function getPostIdFromUrl() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];
}

// Notification System
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add notification styles if not already present
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 15px 20px;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 1000;
                animation: slideInRight 0.3s ease-out;
                min-width: 250px;
                border-left: 4px solid #667eea;
            }
            
            .notification-success {
                border-left-color: #28a745;
                color: #155724;
            }
            
            .notification-error {
                border-left-color: #dc3545;
                color: #721c24;
            }
            
            .notification-info {
                border-left-color: #17a2b8;
                color: #0c5460;
            }
            
            .notification-close {
                background: none;
                border: none;
                color: #666;
                cursor: pointer;
                margin-left: auto;
                padding: 5px;
                border-radius: 3px;
                transition: background 0.2s ease;
            }
            
            .notification-close:hover {
                background: rgba(0, 0, 0, 0.1);
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-triangle';
        case 'info': return 'info-circle';
        default: return 'info-circle';
    }
}

// Reading Progress Bar
function initReadingProgress() {
    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    progressBar.innerHTML = '<div class="reading-progress-fill"></div>';
    
    const progressStyles = document.createElement('style');
    progressStyles.textContent = `
        .reading-progress {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: rgba(102, 126, 234, 0.2);
            z-index: 1000;
        }
        
        .reading-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            width: 0%;
            transition: width 0.1s ease;
        }
    `;
    
    document.head.appendChild(progressStyles);
    document.body.appendChild(progressBar);
    
    const updateProgress = () => {
        const article = document.querySelector('.post-content');
        if (!article) return;
        
        const articleTop = article.offsetTop;
        const articleHeight = article.offsetHeight;
        const windowHeight = window.innerHeight;
        const scrollTop = window.pageYOffset;
        
        const articleBottom = articleTop + articleHeight;
        const windowBottom = scrollTop + windowHeight;
        
        let progress = 0;
        
        if (scrollTop >= articleTop) {
            if (windowBottom >= articleBottom) {
                progress = 100;
            } else {
                const visibleHeight = windowBottom - articleTop;
                progress = (visibleHeight / articleHeight) * 100;
            }
        }
        
        document.querySelector('.reading-progress-fill').style.width = `${Math.min(progress, 100)}%`;
    };
    
    window.addEventListener('scroll', updateProgress);
    window.addEventListener('resize', updateProgress);
    updateProgress();
}

// Table of Contents (if needed)
function generateTableOfContents() {
    const headings = document.querySelectorAll('.post-content h2, .post-content h3');
    if (headings.length < 3) return; // Only generate TOC if there are enough headings
    
    const toc = document.createElement('div');
    toc.className = 'table-of-contents';
    toc.innerHTML = '<h4><i class="fas fa-list"></i> Table of Contents</h4><ul></ul>';
    
    const tocList = toc.querySelector('ul');
    
    headings.forEach((heading, index) => {
        // Add ID to heading if it doesn't have one
        if (!heading.id) {
            heading.id = `heading-${index}`;
        }
        
        const li = document.createElement('li');
        li.className = heading.tagName.toLowerCase();
        li.innerHTML = `<a href="#${heading.id}">${heading.textContent}</a>`;
        tocList.appendChild(li);
    });
    
    // Add TOC styles
    const tocStyles = document.createElement('style');
    tocStyles.textContent = `
        .table-of-contents {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin: 30px 0;
            border-left: 4px solid #667eea;
        }
        
        .table-of-contents h4 {
            margin-bottom: 15px;
            color: #2c3e50;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .table-of-contents ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        
        .table-of-contents li {
            margin-bottom: 8px;
        }
        
        .table-of-contents li.h3 {
            margin-left: 20px;
            font-size: 14px;
        }
        
        .table-of-contents a {
            color: #667eea;
            text-decoration: none;
            transition: color 0.3s ease;
        }
        
        .table-of-contents a:hover {
            color: #5a6fd8;
            text-decoration: underline;
        }
    `;
    
    document.head.appendChild(tocStyles);
    
    // Insert TOC after the intro
    const intro = document.querySelector('.post-intro');
    if (intro) {
        intro.parentNode.insertBefore(toc, intro.nextSibling);
    } else {
        const firstH2 = document.querySelector('.post-content h2');
        if (firstH2) {
            firstH2.parentNode.insertBefore(toc, firstH2);
        }
    }
}

// Code Copy Functionality
function initCodeCopyButtons() {
    const codeBlocks = document.querySelectorAll('.code-example pre');
    
    codeBlocks.forEach(codeBlock => {
        const copyButton = document.createElement('button');
        copyButton.className = 'code-copy-btn';
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.title = 'Copy code';
        
        copyButton.addEventListener('click', () => {
            const code = codeBlock.textContent;
            copyToClipboard(code);
            
            copyButton.innerHTML = '<i class="fas fa-check"></i>';
            copyButton.style.background = '#28a745';
            
            setTimeout(() => {
                copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                copyButton.style.background = '';
            }, 2000);
        });
        
        codeBlock.parentElement.style.position = 'relative';
        codeBlock.parentElement.appendChild(copyButton);
    });
    
    // Add copy button styles
    const copyStyles = document.createElement('style');
    copyStyles.textContent = `
        .code-copy-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            padding: 8px;
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 14px;
        }
        
        .code-copy-btn:hover {
            background: rgba(255, 255, 255, 0.3);
        }
    `;
    
    document.head.appendChild(copyStyles);
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

// Initialize bookmark state on page load
function initBookmarkState() {
    const postId = getPostIdFromUrl();
    const bookmarks = JSON.parse(localStorage.getItem('bookmarkedPosts') || '[]');
    const isBookmarked = bookmarks.some(bookmark => bookmark.id === postId);
    updateBookmarkButton(isBookmarked);
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initReadingProgress();
    generateTableOfContents();
    initCodeCopyButtons();
    initBookmarkState();
});

// Smooth scrolling for anchor links
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

// Handle image loading errors
document.addEventListener('DOMContentLoaded', () => {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.addEventListener('error', function() {
            this.src = '../../../assets/images/background.png';
        });
    });
});
