// Integrates the markdown docs in ../docs (written for reading on GitHub) with Starlight:
// they have no frontmatter, and link to each other with relative .md links.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Loader } from 'astro/loaders';
import { glob } from 'astro/loaders';
import type { Heading, Paragraph, Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString } from 'mdast-util-to-string';

import { githubUrl } from '../links.ts';

export const repoDir = fileURLToPath(new URL('../../../', import.meta.url));
export const docsDir = path.join(repoDir, 'docs');

// Meta descriptions for pages whose first paragraph doesn't describe the page well.
const descriptionOverrides: Record<string, string> = {
  'index.md': 'How to use LosslessCut: FAQ, typical workflow, segments, markers, tracks and importing/exporting projects in the lossless video and audio cutter.',
};

/** Site URL of a doc, by its path relative to docs/: `cli.md` -> `/docs/cli`, `index.md` -> `/docs` */
export function getDocUrl(docPath: string) {
  return `/docs/${docPath.replace(/\.md$/, '').replace(/(^|\/)index$/, '')}`.replace(/\/$/, '');
}

// Titles are shown without the emojis that some docs headings have (but keep symbols like ™).
const stripEmoji = (text: string) => text
  .replaceAll(/(\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)(\uFE0F|\u200D\p{Extended_Pictographic}\uFE0F?)*/gu, '')
  .replaceAll(/\s+/g, ' ')
  .trim();

function summarize(text: string, maxLength = 160) {
  const collapsed = text.replaceAll(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLength) return collapsed;
  const lastSpace = collapsed.lastIndexOf(' ', maxLength - 1);
  return `${collapsed.slice(0, lastSpace > 0 ? lastSpace : maxLength - 1)}…`;
}

/** Path of a doc file relative to docs/, e.g. `cli.md`. */
export const getDocPath = (filePath: string) => path.relative(docsDir, filePath).split(path.sep).join('/');

/** The heading that a doc's title is taken from: its first `# heading`. */
export const findTitleHeading = (tree: Root) => tree.children.find((node): node is Heading => node.type === 'heading' && node.depth === 1);

/** Frontmatter for a doc: title from its first heading, description from its first paragraph. */
function getFrontmatter(docPath: string, markdown: string) {
  // the frontmatter, if any, is parsed by the loader
  const tree = fromMarkdown(markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''));
  const titleHeading = findTitleHeading(tree);
  const firstParagraph = tree.children.find((node): node is Paragraph => node.type === 'paragraph' && toString(node).trim() !== '');
  return {
    title: titleHeading != null ? stripEmoji(toString(titleHeading)) : path.posix.basename(docPath, '.md'),
    description: descriptionOverrides[docPath] ?? (firstParagraph != null ? summarize(toString(firstParagraph)) : undefined),
    // generated docs (see script/generateDocs.ts) are overwritten, so can't be edited
    editUrl: docPath.startsWith('generated/') ? false : `${githubUrl}/edit/master/docs/${docPath}`,
  };
}

/** Like Starlight's docsLoader, but for ../docs, and generates the frontmatter that Starlight needs. */
export function repoDocsLoader(): Loader {
  const globLoader = glob({
    base: docsDir,
    pattern: '**/*.md',
    // the id is the page's URL path, e.g. docs/cli
    generateId: ({ entry }) => getDocUrl(entry).slice(1),
  });

  return {
    name: 'repo-docs-loader',
    load: async (context) => globLoader.load({
      ...context,
      parseData: async (props) => {
        const docPath = getDocPath(props.filePath!);
        const generated = getFrontmatter(docPath, fs.readFileSync(props.filePath!, 'utf8'));
        return context.parseData({ ...props, data: { ...generated, ...props.data } });
      },
    }),
  };
}
