const GitHub = require('github-api');
const electron = require('electron');

const { app } = electron;

const gh = new GitHub();
const repo = gh.getRepo('mifi', 'lossless-cut');

async function checkNewVersion() {
  try {
    // From API: https://developer.github.com/v3/repos/releases/#get-the-latest-release
    // View the latest published full release for the repository.
    // Draft releases and prereleases are not returned by this endpoint.
    const res = (await repo.getRelease('latest')).data;
    const tagName = res.tag_name;

    const currentVersion = app.getVersion();
    // const currentVersion = '1.8.0';

    console.log('Current version', currentVersion);
    console.log('Newest version', tagName);

    if (tagName !== `v${currentVersion}`) return tagName;
    return undefined;
  } catch (e) {
    console.error('Failed to check github version');
    return undefined;
  }
}

module.exports = { checkNewVersion };
