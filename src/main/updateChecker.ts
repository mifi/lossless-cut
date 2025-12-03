// eslint-disable-next-line import/no-extraneous-dependencies
import electron from 'electron';
import semver from 'semver';
import { Octokit } from '@octokit/core';

import logger from './logger.js';


const { app } = electron;

const octokit = new Octokit();


// eslint-disable-next-line import/prefer-default-export
export async function checkNewVersion() {
  try {
    // From API: https://developer.github.com/v3/repos/releases/#get-the-latest-release
    // View the latest published full release for the repository.
    // Draft releases and prereleases are not returned by this endpoint.

    const { data } = await octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
      owner: 'mifi',
      repo: 'lossless-cut',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    const newestVersion = data.tag_name.replace(/^v?/, '');

    const currentVersion = app.getVersion();
    // const currentVersion = '3.17.2';

    logger.info('Current version', currentVersion);
    logger.info('Newest version', newestVersion);

    if (semver.lt(currentVersion, newestVersion)) return newestVersion;
    return undefined;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to check github version', message);
    return undefined;
  }
}
