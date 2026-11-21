import { docsSchema } from '@astrojs/starlight/schema';
import { defineCollection } from 'astro:content';

import { repoDocsLoader } from './lib/docs.ts';

// Astro requires this named export
export const collections = {
  docs: defineCollection({ loader: repoDocsLoader(), schema: docsSchema() }),
};
