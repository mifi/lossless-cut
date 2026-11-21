// LosslessCut's official links, used by the docs header (astro.config.ts), the docs, the homepage and its structured data.
// The app has its own copy of the shared ones (src/common/links.ts): the website build can't import from the app's
// src/, because Vite then reads the app's tsconfig, which needs the app's dependencies installed.

export const githubUrl = 'https://github.com/mifi/lossless-cut';

export const authorUrl = 'https://mifi.no/';

export const donateUrl = 'https://paypal.me/mifino';

export const supportEmail = 'losslesscut@mifi.no';

export const storeUrls = {
  mac: 'https://apps.apple.com/app/id1505323402',
  microsoft: 'https://apps.microsoft.com/detail/9p30lsr4705l',
  snap: 'https://snapcraft.io/losslesscut',
};

// `icon` is the Starlight icon name. `isProfile`: an account (listed as `sameAs` in the structured data), not e.g. a chat invite.
export const socialLinks = [
  { label: 'Discord', href: 'https://discord.gg/fhnEREfUJ3', icon: 'discord', isProfile: false },
  { label: 'X', href: 'https://x.com/losslesscut', icon: 'x.com', isProfile: true },
  { label: 'Bluesky', href: 'https://bsky.app/profile/losslesscut.app', icon: 'blueSky', isProfile: true },
  // the site links to it with rel="me", which is how Mastodon verifies that the site belongs to the account
  { label: 'Mastodon', href: 'https://mastodon.social/@losslesscut', icon: 'mastodon', isProfile: true },
  { label: 'Instagram', href: 'https://www.instagram.com/losslesscut.app/', icon: 'instagram', isProfile: true },
] as const;

export const mastodonUrl = socialLinks.find((link) => link.label === 'Mastodon')!.href;
