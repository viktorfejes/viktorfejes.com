let isScrolling = false;
let observer = null;

function initParallax() {
    // Select all parallax elements
    const elements = document.querySelectorAll("[data-parallax]");
    
    // Set up observer
    observer = new IntersectionObserver(handleIntersection, { 
        threshold: [0, 0.2, 0.4, 0.6, 0.8, 1],
        rootMargin: "800px"
     });

    // Init each element
    elements.forEach(setupElement);

    // Add scroll listener
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Return cleanup function
    return () => cleanupParallax(elements);
}

function setupElement(element) {
    element.style.willChange = "transform";
    // Apply initial transform immediately
    updateElementPosition(element);
    observer.observe(element);
}

function handleIntersection(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("parallax-active");
        } else {
            entry.target.classList.remove("parallax-active");
        }
    });
}

function updateElementPosition(element) {
    if (!element.classList.contains("parallax-active")) return;

    const speed = parseFloat(element.dataset.parallax) || 0.5;
    const rect = element.getBoundingClientRect();
    const scrolled = window.scrollY;
    // const translateY = (scrolled - rect.top) * speed;
    const translateY = scrolled * (1 - speed);

    element.style.transform = `translate3d(0, ${translateY}px, 0)`;
}

function handleScroll() {
    if (isScrolling) return;

    isScrolling = true;
    window.requestAnimationFrame(() => {
        const elements = document.querySelectorAll("[data-parallax]");
        elements.forEach(updateElementPosition);
        isScrolling = false;
    });
}

function cleanupParallax(elements) {
    window.removeEventListener("scroll", handleScroll);

    elements.forEach(element => {
        element.style.transform = "";
        element.style.willChange = "";
        observer.unobserve(element);
    });

    observer.disconnect();
    observer = null;
}

let cleanup;
document.addEventListener("DOMContentLoaded", () => {
    cleanup = initParallax();
});
