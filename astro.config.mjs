// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from "remark-math";
import rehypeKatex from 'rehype-katex';

import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
    site: 'https://viktorfejes.com',
    integrations: [mdx({
            remarkPlugins: [remarkMath],
            rehypePlugins: [rehypeKatex]
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
