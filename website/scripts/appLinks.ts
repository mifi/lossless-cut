// Writes the redirects for the app's links to the website (https://losslesscut.app/go/<name>, see
// src/common/websiteUrls.ts) into the built site (dist/_redirects), and checks that each target page (and #anchor) exists.
import fs from 'node:fs/promises';

// the app's list, shared through the repo rather than as a package
// eslint-disable-next-line import-js/no-relative-packages
import { appLinkPrefix, appLinkTargets, websiteUrl } from '../../src/common/websiteUrls.ts';

const distDir = new URL('../dist/', import.meta.url);

// with trailingSlash: 'never', /docs/cli is served from docs/cli/index.html (see astro.config.ts)
const getHtmlFile = (pathname: string) => new URL(`.${pathname.replace(/\/$/, '')}/index.html`, distDir);

const escapeRegExp = (text: string) => text.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);
// an element with this id, e.g. <h2 id="faq">, not just the text id="faq" somewhere (e.g. in data-id="faq")
const hasElementWithId = (html: string, id: string) => new RegExp(`<[a-z][^>]*\\sid="${escapeRegExp(id)}"`, 'i').test(html);

const problems: string[] = [];
await Promise.all(Object.entries(appLinkTargets).map(async ([name, target]) => {
  const { origin, pathname, hash } = new URL(target, websiteUrl);
  // targets on other sites (like a GitHub release asset) can't be checked here
  if (origin !== websiteUrl) return;
  let html: string;
  try {
    html = await fs.readFile(getHtmlFile(pathname), 'utf8');
  } catch {
    problems.push(`${name}: ${target}: page not found`);
    return;
  }
  if (hash !== '' && !hasElementWithId(html, decodeURIComponent(hash.slice(1)))) {
    problems.push(`${name}: ${target}: no element with this id on the page`);
  }
}));

if (problems.length > 0) {
  // eslint-disable-next-line unicorn-js/require-array-sort-compare -- TODO fix (new rule in @mifi/lint-config)
  console.error(`The app links to website pages that don't exist (see src/common/websiteUrls.ts):\n${problems.toSorted().join('\n')}`);
  process.exitCode = 1;
} else {
  // https://developers.cloudflare.com/workers/static-assets/redirects/
  // 302, because the targets may change, and browsers would remember a 301
  const redirects = Object.entries(appLinkTargets).map(([name, target]) => `${appLinkPrefix}${name} ${target} 302`);
  await fs.appendFile(new URL('_redirects', distDir), `# Links from the app, see src/common/websiteUrls.ts\n${redirects.join('\n')}\n`);
  console.log(`Wrote redirects for the ${redirects.length} links from the app, and checked that their pages exist.`);
}
