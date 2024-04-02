export function slugify(text) {
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace("3ds ", "") // remove 3ds from the beginning of the title TODO: this is a hack!
        .replace("c++", "cpp") // replace c++ with cpp
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '');
}

export function formatDate(dateString, options) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', options);
}

export function injectSpanLetters(text, className = "letter") {
    const result = [];
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === " ") {
            result.push({
                char: char,
                class: null,
            });
        } else {
            result.push({
                char: char,
                class: `${className} ${className}-${i}`,
            });
        }
    }
    return result;
}

export function calcReadTime(text) {
    const wordsPerMinute = 238;
    const cleanText = text.replace(/\s+/g, ' ');
    const words = text.trim().split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
}