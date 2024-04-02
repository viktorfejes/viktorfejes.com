import { z, defineCollection } from "astro:content";

const caseStudiesCollection = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
        draft: z.boolean().default(false),
        featured: z.boolean().default(false),
        thumbnail: z.string(),
        tags: z.array(z.string()),
        software: z.array(z.string()),
        description: z.string().optional(),
    })
});

const journalCollection = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
        date: z.date(),
        thumbnail: z.string(),
    })
});

export const collections = {
    "case-studies": caseStudiesCollection,
    "journal": journalCollection,
};