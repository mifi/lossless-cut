// remark plugins for rendering the docs (see docs.ts) on the site.

// remark plugins work by mutating the syntax tree and the file's data
/* eslint-disable no-param-reassign */
import path from 'node:path';

import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import type { VFile } from 'vfile';

import { githubUrl } from '../links.ts';
import { docsDir, findTitleHeading, getDocPath, getDocUrl, repoDir } from './docs.ts';

// markdown can also be rendered without a file
const isDoc = (file: VFile) => file.path?.startsWith(docsDir + path.sep) ?? false;

/**
 * Removes the doc's `# title` heading, because Starlight shows the title (taken from it) itself.
 * Images in it (e.g. badges) are kept, as a paragraph in its place.
 */
export function remarkRemoveDocTitle() {
  return (tree: Root, file: VFile) => {
    if (!isDoc(file)) return;
    const heading = findTitleHeading(tree);
    if (heading == null) return;
    const images = heading.children.filter((node) => node.type === 'image' || node.type === 'imageReference');
    tree.children.splice(tree.children.indexOf(heading), 1, ...(images.length > 0 ? [{ type: 'paragraph' as const, children: images }] : []));
  };
}

/**
 * Rewrites relative links, which are written for browsing the docs on GitHub, to the site's URLs:
 * other docs to their page, other files in the repo to GitHub. Relative images are left to Astro, which bundles them.
 */
export function remarkRepoLinks() {
  return (tree: Root, file: VFile) => {
    if (!isDoc(file)) return;

    visit(tree, ['link', 'definition'], (node) => {
      if (!('url' in node)) return;
      const { url } = node;
      // skip absolute URLs (anything with a scheme, or protocol-relative) and links within the page
      if (/^([a-z][\d+.a-z-]*:|\/\/|#)/i.test(url)) return;

      const hashIndex = url.indexOf('#');
      const rawTarget = hashIndex === -1 ? url : url.slice(0, hashIndex);
      let target = rawTarget;
      try {
        target = decodeURI(rawTarget);
      } catch {
        // malformed percent-encoding: use as is, the links validator reports it if it's broken
      }
      const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
      // like on GitHub, a leading / is the repo root
      const filePath = target.startsWith('/') ? path.join(repoDir, target) : path.resolve(path.dirname(file.path), target);
      const repoPath = path.relative(repoDir, filePath).split(path.sep).join('/');

      if (repoPath.startsWith('docs/') && repoPath.endsWith('.md')) {
        node.url = getDocUrl(repoPath.slice('docs/'.length)) + hash;
      } else if (repoPath === 'README.md' && hash === '#download') {
        node.url = '/#download';
      } else {
        node.url = `${githubUrl}/blob/master/${encodeURI(repoPath)}${hash}`;
      }
    });
  };
}

/**
 * Sets the page's id as `slug` in the frontmatter that remark/rehype plugins see. starlight-links-validator
 * uses it to know which page a file is, which it otherwise derives from the file's path in src/content/docs.
 */
export function remarkDocSlug() {
  return (_tree: Root, file: VFile) => {
    if (!isDoc(file)) return;
    const docPath = getDocPath(file.path);
    const astroData = (file.data['astro'] ??= {}) as { frontmatter?: Record<string, unknown> };
    (astroData.frontmatter ??= {})['slug'] = getDocUrl(docPath).slice(1);
  };
}
