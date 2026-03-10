/* ============================================
   ISSAM SAYYAF - PORTFOLIO JS
   ============================================ */

// Header scroll effect
const siteHeader = document.querySelector('.site-header');
if (siteHeader) {
    window.addEventListener('scroll', () => {
        siteHeader.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
}

// Mobile nav toggle
const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('.site-nav');
if (navToggle && siteNav) {
    navToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        siteNav.classList.toggle('open');
        const icon = navToggle.querySelector('i');
        icon.className = siteNav.classList.contains('open') ? 'fas fa-times' : 'fas fa-bars';
    });
    document.addEventListener('click', (e) => {
        if (!navToggle.contains(e.target) && !siteNav.contains(e.target)) {
            siteNav.classList.remove('open');
            const icon = navToggle.querySelector('i');
            if (icon) icon.className = 'fas fa-bars';
        }
    });
}

// Scroll reveal
const revealElements = () => {
    document.querySelectorAll('.reveal').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.88) {
            el.classList.add('visible');
        }
    });
};
window.addEventListener('scroll', revealElements, { passive: true });
window.addEventListener('load', revealElements);
document.addEventListener('DOMContentLoaded', revealElements);

// News carousel
function initCarousel() {
    const slides = document.querySelectorAll('.news-slide');
    const dots = document.querySelectorAll('.news-dot');
    if (!slides.length) return;

    let current = 0;
    let timer;

    const show = (i) => {
        slides.forEach(s => s.classList.remove('active'));
        dots.forEach(d => d.classList.remove('active'));
        slides[i].classList.add('active');
        if (dots[i]) dots[i].classList.add('active');
        current = i;
    };

    const next = () => show((current + 1) % slides.length);
    const start = () => { timer = setInterval(next, 5000); };

    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => {
            clearInterval(timer);
            show(i);
            start();
        });
    });

    start();
}

document.addEventListener('DOMContentLoaded', initCarousel);
