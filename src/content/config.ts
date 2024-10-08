import { z, defineCollection } from "astro:content";

const caseStudiesCollection = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
        hero: z.string(),
        client: z.string().optional(),
        tags: z.array(z.string()).optional(),
        description: z.string(),
    })
});

const blogCollection = defineCollection({
    type: "content",
    schema: z.object({
        title: z.string(),
        publishDate: z.date()
    })
});

export const collections = {
    "case-studies": caseStudiesCollection,
    "blog": blogCollection
};