// Blog JavaScript functionality
class BlogManager {
    constructor() {
        this.blogData = null;
        this.filteredPosts = [];
        this.currentPage = 1;
        this.postsPerPage = 6;
        this.currentCategory = '';
        this.init();
    }

    async init() {
        try {
            console.log('Initializing blog...');
            await this.loadBlogData();
            console.log('Blog data loaded successfully');
            this.checkURLParams();
            this.setupEventListeners();
            this.populateFilters();
            this.renderCategoryCards();
            this.renderFeaturedPosts();
            this.renderPosts();
            console.log('Blog initialization complete');
        } catch (error) {
            console.error('Error initializing blog:', error);
            // Don't show error if we have fallback content
            console.log('Using fallback content');
        }
    }

    async loadBlogData() {
        try {
            const response = await fetch('blog/blog-data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.blogData = await response.json();
            this.filteredPosts = [...this.blogData.posts];
            this.sortPosts('date-desc');
        } catch (error) {
            console.error('Error loading blog data:', error);
            throw error;
        }
    }

    checkURLParams() {
        // Check for category filter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const category = urlParams.get('category');
        if (category) {
            // Find the category name from slug
            const categoryObj = this.blogData.categories.find(c => c.slug === category);
            if (categoryObj) {
                this.currentCategory = categoryObj.name;
                this.handleCategoryFilter(categoryObj.name);

                // Update the category filter dropdown
                const categoryFilter = document.getElementById('categoryFilter');
                if (categoryFilter) {
                    categoryFilter.value = categoryObj.name;
                }
            }
        }
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // Category filter
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.handleCategoryFilter(e.target.value);
                // Update URL
                const category = this.blogData.categories.find(c => c.name === e.target.value);
                if (category) {
                    window.history.pushState({}, '', `?category=${category.slug}`);
                } else {
                    window.history.pushState({}, '', window.location.pathname);
                }
            });
        }

        // Sort functionality
        const sortBy = document.getElementById('sortBy');
        if (sortBy) {
            sortBy.addEventListener('change', (e) => {
                this.sortPosts(e.target.value);
                this.renderPosts();
            });
        }

        // Load more button
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMorePosts();
            });
        }
    }

    populateFilters() {
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter && this.blogData.categories) {
            // Clear existing options except the first one
            categoryFilter.innerHTML = '<option value="">All Categories</option>';

            this.blogData.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.name;
                option.textContent = category.name;
                categoryFilter.appendChild(option);
            });
        }
    }

    renderCategoryCards() {
        const categoryGrid = document.getElementById('categoryGrid');
        if (!categoryGrid || !this.blogData || !this.blogData.categories) return;

        categoryGrid.innerHTML = '';

        this.blogData.categories.forEach(category => {
            // Count posts in this category
            const postCount = this.blogData.posts.filter(p => p.category === category.name).length;

            const card = document.createElement('div');
            card.className = 'category-card';
            card.onclick = () => {
                window.location.href = `blog.html?category=${category.slug}`;
            };

            card.innerHTML = `
                <i class="${category.icon}"></i>
                <h3>${category.name}</h3>
                <p>${category.description}</p>
                <span class="post-count">${postCount} article${postCount !== 1 ? 's' : ''}</span>
            `;

            categoryGrid.appendChild(card);
        });
    }

    handleSearch(searchTerm) {
        const term = searchTerm.toLowerCase().trim();

        if (term === '') {
            this.filteredPosts = this.currentCategory
                ? this.blogData.posts.filter(post => post.category === this.currentCategory)
                : [...this.blogData.posts];
        } else {
            let basePosts = this.currentCategory
                ? this.blogData.posts.filter(post => post.category === this.currentCategory)
                : this.blogData.posts;

            this.filteredPosts = basePosts.filter(post =>
                post.title.toLowerCase().includes(term) ||
                post.excerpt.toLowerCase().includes(term) ||
                post.category.toLowerCase().includes(term) ||
                post.tags.some(tag => tag.toLowerCase().includes(term))
            );
        }

        this.currentPage = 1;
        this.renderPosts();
    }

    handleCategoryFilter(category) {
        this.currentCategory = category;

        if (category === '') {
            this.filteredPosts = [...this.blogData.posts];
        } else {
            this.filteredPosts = this.blogData.posts.filter(post =>
                post.category === category
            );
        }

        this.currentPage = 1;
        this.renderPosts();
    }

    sortPosts(sortBy) {
        switch (sortBy) {
            case 'date-desc':
                this.filteredPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
                break;
            case 'date-asc':
                this.filteredPosts.sort((a, b) => new Date(a.date) - new Date(b.date));
                break;
            case 'title':
                this.filteredPosts.sort((a, b) => a.title.localeCompare(b.title));
                break;
        }
    }

    renderFeaturedPosts() {
        const featuredGrid = document.getElementById('featuredGrid');
        const featuredSection = document.getElementById('featuredPosts');

        if (!featuredGrid || !this.blogData) return;

        const featuredPosts = this.blogData.posts.filter(post => post.featured);

        if (featuredPosts.length === 0) {
            if (featuredSection) featuredSection.style.display = 'none';
            return;
        }

        // Clear any existing content (including fallback)
        featuredGrid.innerHTML = '';

        featuredPosts.forEach((post, index) => {
            const postCard = this.createPostCard(post, true);
            postCard.style.animationDelay = `${index * 0.1}s`;
            featuredGrid.appendChild(postCard);
        });
    }

    renderPosts() {
        const postsGrid = document.getElementById('postsGrid');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        const noResults = document.getElementById('noResults');

        if (!postsGrid) return;

        // Show/hide no results message
        if (this.filteredPosts.length === 0) {
            postsGrid.innerHTML = '';
            if (noResults) noResults.style.display = 'block';
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        } else {
            if (noResults) noResults.style.display = 'none';
        }

        // Calculate posts to show
        const startIndex = 0;
        const endIndex = this.currentPage * this.postsPerPage;
        const postsToShow = this.filteredPosts.slice(startIndex, endIndex);

        // Clear and populate posts (including fallback content)
        postsGrid.innerHTML = '';

        postsToShow.forEach((post, index) => {
            const postCard = this.createPostCard(post, false);
            postCard.style.animationDelay = `${index * 0.1}s`;
            postsGrid.appendChild(postCard);
        });

        // Show/hide load more button
        if (loadMoreBtn) {
            if (endIndex < this.filteredPosts.length) {
                loadMoreBtn.style.display = 'block';
            } else {
                loadMoreBtn.style.display = 'none';
            }
        }
    }

    createPostCard(post, isFeatured = false) {
        const card = document.createElement('div');
        card.className = `post-card fade-in-up ${isFeatured ? 'featured' : ''}`;
        card.onclick = () => this.openPost(post);

        const formattedDate = this.formatDate(post.date);

        // Handle image path
        let imagePath = post.image;
        if (!imagePath.startsWith('http') && !imagePath.startsWith('/')) {
            imagePath = imagePath;
        }

        card.innerHTML = `
            <img src="${imagePath}" alt="${post.title}" class="post-image" onerror="this.src='assets/images/background.png'">
            <div class="post-content">
                <span class="post-category">${post.category}</span>
                <h3 class="post-title">${post.title}</h3>
                <p class="post-excerpt">${post.excerpt}</p>
                <div class="post-meta">
                    <span class="post-date">
                        <i class="fas fa-calendar"></i>
                        ${formattedDate}
                    </span>
                    <span class="post-read-time">
                        <i class="fas fa-clock"></i>
                        ${post.readTime}
                    </span>
                </div>
                <div class="post-tags">
                    ${post.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
        `;

        return card;
    }

    loadMorePosts() {
        this.currentPage++;
        this.renderPosts();
    }

    formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    openPost(post) {
        // Use the path from the post data
        const path = post.path || `blog/posts/${post.id}/`;
        window.location.href = path + 'index.html';
    }

    showError(message) {
        const postsGrid = document.getElementById('postsGrid');
        if (postsGrid) {
            postsGrid.innerHTML = `
                <div class="error-message" style="text-align: center; padding: 40px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 20px;"></i>
                    <h3>Error Loading Content</h3>
                    <p>${message}</p>
                </div>
            `;
        }
    }
}

// Utility function to create a new blog post
function createNewBlogPost(postData) {
    console.log('Creating new blog post:', postData);
    alert('This feature will be implemented in the admin panel. For now, manually add posts to blog-data.json and create the corresponding folder structure.');
}

// Initialize blog when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BlogManager();
});

// Add smooth scrolling for anchor links
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

// Add loading animation to images
document.addEventListener('DOMContentLoaded', () => {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.addEventListener('load', function() {
            this.style.opacity = '1';
        });

        img.addEventListener('error', function() {
            this.src = './assets/images/background.png';
        });
    });
});
