// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from "remark-math";
import rehypeKatex from 'rehype-katex';
import { remarkReadingTime } from "./src/assets/scripts/remark-reading-time.mjs";

import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
    site: 'https://viktorfejes.com',
    markdown: {
        remarkPlugins: [remarkReadingTime],
    },
    integrations: [
        mdx({
            remarkPlugins: [remarkMath, remarkReadingTime],
            rehypePlugins: [rehypeKatex],
            shikiConfig: {
                themes: {
                    light: "catppuccin-latte",
                    dark: "material-theme-darker",
                },
            },
        }),
        sitemap(),
        icon()
    ],
    vite: {
        plugins: [tailwindcss()],
    },
    prefetch: {
        prefetchAll: true
    }
});
