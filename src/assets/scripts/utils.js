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