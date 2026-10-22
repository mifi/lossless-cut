import { fileURLToPath } from 'node:url';

import { unified } from '@astrojs/markdown-remark';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLinksValidator from 'starlight-links-validator';

import { remarkDocSlug, remarkRemoveDocTitle, remarkRepoLinks } from './src/lib/remarkDocs.ts';
import { githubUrl, socialLinks } from './src/links.ts';

export default defineConfig({
  site: 'https://losslesscut.app',
  // URLs like /docs/cli, served from docs/cli/index.html (see html_handling in wrangler.jsonc)
  trailingSlash: 'never',
  markdown: {
    // the remark/rehype (unified) pipeline, which is also what other frameworks (e.g. Next.js) use
    processor: unified({
      remarkPlugins: [remarkDocSlug, remarkRemoveDocTitle, remarkRepoLinks],
    }),
  },
  // Only use this folder's tsconfig.json: otherwise Vite also looks at the app's tsconfig.json in
  // the repo root (for files that this one doesn't include, like Astro's generated and virtual
  // modules), which extends packages that aren't installed when only the website is built.
  vite: {
    resolve: { tsconfigPaths: false },
    build: { rolldownOptions: { tsconfig: fileURLToPath(new URL('tsconfig.json', import.meta.url)) } },
  },
  integrations: [
    starlight({
      title: 'LosslessCut',
      logo: { src: '../src/renderer/src/icon.svg' },
      favicon: '/favicon.ico',
      social: [
        { icon: 'github', label: 'GitHub', href: githubUrl },
        ...socialLinks.map(({ icon, label, href }) => ({ icon, label, href })),
      ],
      // Docs pages (the files in ../docs) by URL path. A new doc is built, but only listed here once added.
      sidebar: [
        'docs',
        'docs/getting-started',
        'docs/features',
        'docs/faq',
        'docs/installation',
        'docs/requirements',
        'docs/troubleshooting',
        'docs/recipes',
        'docs/batch',
        'docs/cli',
        'docs/api',
        'docs/file-name-template',
        'docs/expressions',
        'docs/translation',
      ],
      customCss: ['./src/styles/docs.css'],
      // adds a Download button to the header
      components: { SocialIcons: './src/components/DocsSocialIcons.astro' },
      plugins: [starlightLinksValidator({
        // the homepage isn't a Starlight page, so the validator can't check its anchors
        exclude: ['/#download'],
      })],
    }),
    react(),
  ],
});
