const GitHub = require('github-api');
const electron = require('electron');

const app = electron.app;

const gh = new GitHub();
const repo = gh.getRepo('mifi', 'lossless-cut');

async function checkNewVersion() {
  try {
    const res = (await repo.getRelease('latest')).data;
    const tagName = res.tag_name;
    console.log(tagName);

    const currentVersion = app.getVersion();
    // const currentVersion = '1.8.0';

    if (tagName !== `v${currentVersion}`) return tagName;
    return undefined;
  } catch (e) {
    console.error('Failed to check github version');
    return undefined;
  }
}

module.exports = { checkNewVersion };
