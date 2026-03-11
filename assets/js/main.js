function handleScroll() {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        const offset = window.innerHeight * 0.8;
        
        if (rect.top < offset) {
            section.classList.add('visible');
        }
    });
}

window.addEventListener('scroll', handleScroll);
window.addEventListener('load', () => {
    handleScroll();
});