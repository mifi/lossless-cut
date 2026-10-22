# losslesscut.app

The website, built with [Astro](https://astro.build/) and [Starlight](https://starlight.astro.build/) into `dist/` (not committed): the homepage, plus a page for each markdown file in [`../docs`](../docs).

```bash
cd website
yarn install
yarn dev        # local server with live reload
yarn build      # writes dist/
yarn check      # typecheck
yarn wrangler dev  # serve dist/ with the same URL handling as production
```

## Docs

The docs in `../docs` are plain markdown written for reading on GitHub, and stay that way (no frontmatter or Starlight-specific syntax), so they work with any tool:

- `docs/cli.md` becomes `/docs/cli`, and `docs/index.md` becomes `/docs`. Relative `.md` links between docs are rewritten to those URLs, and the build fails if one points to a page or heading that doesn't exist (via [starlight-links-validator](https://github.com/HiDeoo/starlight-links-validator)).
- A page's title is its first `# heading` and its description is its first paragraph. See `src/lib/docs.ts`, which also has the description overrides.
- New docs are built automatically, but only appear in the navigation once added to `sidebar` in `astro.config.ts`.

## Links from the app

The app links to `https://losslesscut.app/go/<name>` (e.g. `/go/troubleshooting`), which redirects to the target for that name in [`src/common/websiteUrls.ts`](../src/common/websiteUrls.ts): a page on the site, or another site (e.g. GitHub). The build (`scripts/appLinks.ts`) writes those redirects into `dist/_redirects`, and fails if a target page or `#anchor` on the site doesn't exist, for example after renaming a docs heading. To move a target, change it there. Released app versions keep using the names, so never rename or remove one.

App versions from before that link to `https://mifi.no/losslesscut/<name>` (same names) instead, which the mifi.no infrastructure (not in this repo) redirects. For a change of target to also reach those versions, mifi.no must redirect that name to `https://losslesscut.app/go/<name>`. Only the names, not everything under `/losslesscut/`: old versions also fetch `https://mifi.no/losslesscut/config.json`, which must keep working.

## Homepage

`src/pages/index.astro` (the `<head>`) and `src/components/Home.tsx` (the content), styled by `src/styles/home.css`, with its images and the hero video on static.mifi.no (URLs in `src/images.ts`), plus the store badges and the app icon from the repo. The content is a React component, rendered to static HTML at build time (no client-side JavaScript, except a small script in `index.astro` for the hero video's pause button and the feature icon animation on touch screens), so it can move to another React framework if needed. It doesn't use Starlight's components, since those bring Starlight's global CSS along (see `src/components/socialIcons.ts`).

Official links (GitHub, stores, social media) are in `src/links.ts`.

## Deployment

Cloudflare Workers Builds builds the site from this repo: `master` deploys to production at https://losslesscut.app (a custom domain of the `losslesscut-app` Worker), and other branches (and pull requests) get a preview URL.

Build settings:

- Root directory: `website`
- Build command: `yarn install --immutable && yarn build`
- Deploy command: `npx wrangler deploy`
- Preview command (non-production branches): `npx wrangler preview`
- Branch control: production branch `master`, with builds for non-production branches enabled
- Build watch paths: include `website/*`, `docs/*`, `src/common/websiteUrls.ts`, `src/common/links.ts`, `src/renderer/src/icon.svg` and `*.svg` (the store badges in the repo root; `*` also matches subfolders, so this also covers other SVGs, which is harmless), so that app-only changes don't trigger a deploy
- Variables (build): `GITHUB_TOKEN`, a fine-grained personal access token with read-only access to public repositories, so the homepage's star count (`src/githubStars.ts`) and latest version (`src/latestRelease.ts`) aren't rate limited. Optional: without it, the last known star count may be shown, and the version left out

The Worker itself (name, static assets in `dist/`, URL handling) is configured in `wrangler.jsonc`, the Node.js version in `.node-version`, and the Wrangler version used for deploys and previews (4.135.0 or later for previews) by `wrangler` in `package.json`.
