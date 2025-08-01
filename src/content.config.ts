import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
    // Load Markdown and MDX files in the `src/content/blog/` directory.
    loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
    // Type-check frontmatter using a schema
    schema: ({ image }) => z.object({
        title: z.string(),
        description: z.string(),
        // Transform string to Date object
        pubDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        heroImage: image().optional(),
        draft: z.boolean().optional(),
    }),
});

const projects = defineCollection({
    schema: z.object({
        name: z.string(),
        thumbnail: z.string(),
        tags: z.array(z.string()),
        featured: z.boolean().optional(),
        description: z.string().optional(),
    }),
});

export const collections = { blog, projects };
