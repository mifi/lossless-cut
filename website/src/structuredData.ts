// schema.org data for the homepage (https://schema.org/SoftwareApplication).
import { ogImage } from './images.ts';
import type { Release } from './latestRelease.ts';
import { authorUrl, githubUrl, socialLinks, storeUrls } from './links.ts';

export default (release: Release | undefined) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'LosslessCut',
      url: 'https://losslesscut.app/',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'LosslessCut',
      url: 'https://losslesscut.app/',
      description: 'The Swiss Army Knife of lossless video/audio editing. Cut, trim, merge and remux video and audio files without re-encoding.',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Windows, macOS, Linux',
      image: ogImage,
      ...(release && { softwareVersion: release.version }),
      // free from GitHub
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
      license: 'https://www.gnu.org/licenses/old-licenses/gpl-2.0.html',
      author: {
        '@type': 'Person',
        name: 'Mikael Finstad',
        url: authorUrl,
      },
      sameAs: [
        githubUrl,
        ...Object.values(storeUrls),
        ...socialLinks.filter((link) => link.isProfile).map((link) => link.href),
      ],
    },
  ],
});
