// eslint-disable-line unicorn/filename-case
const GitHub = require('github-api');
// eslint-disable-next-line import/no-extraneous-dependencies
const electron = require('electron');
const semver = require('semver');

const logger = require('./logger');


const { app } = electron;

const gh = new GitHub();
const repo = gh.getRepo('mifi', 'lossless-cut');

async function checkNewVersion() {
  try {
    // From API: https://developer.github.com/v3/repos/releases/#get-the-latest-release
    // View the latest published full release for the repository.
    // Draft releases and prereleases are not returned by this endpoint.
    const res = (await repo.getRelease('latest')).data;
    const newestVersion = res.tag_name.replace(/^v?/, '');

    const currentVersion = app.getVersion();
    // const currentVersion = '3.17.2';

    logger.info('Current version', currentVersion);
    logger.info('Newest version', newestVersion);

    if (semver.lt(currentVersion, newestVersion)) return newestVersion;
    return undefined;
  } catch (err) {
    logger.error('Failed to check github version', err.message);
    return undefined;
  }
}

module.exports = { checkNewVersion };
