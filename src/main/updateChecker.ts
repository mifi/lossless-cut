// eslint-disable-next-line import/no-extraneous-dependencies
import electron from 'electron';
import semver from 'semver';

import { getAppLinkUrl } from '../common/websiteUrls.js';
import logger from './logger.js';


const { app } = electron;


// eslint-disable-next-line import/prefer-default-export
export async function checkNewVersion() {
  try {
    // Redirects to GitHub's "latest release" API (see websiteUrls.ts), which returns the latest published full release
    // (not drafts or prereleases): https://docs.github.com/en/rest/releases/releases#get-the-latest-release
    // Only `tag_name` is used, so if it's ever moved off GitHub, the new endpoint only needs to return that.
    const response = await fetch(getAppLinkUrl('latest-release'), {
      headers: {
        accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { tag_name: tagName } = await response.json() as { tag_name: string };

    const newestVersion = tagName.replace(/^v?/, '');

    const currentVersion = app.getVersion();
    // const currentVersion = '3.17.2';

    logger.info('Current version', currentVersion);
    logger.info('Newest version', newestVersion);

    if (semver.lt(currentVersion, newestVersion)) return newestVersion;
    return undefined;
  } catch (err) {
    logger.error('Failed to check github version', err instanceof Error ? err.message : String(err));
    return undefined;
  }
}
