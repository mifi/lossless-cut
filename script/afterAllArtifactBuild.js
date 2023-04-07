const { join, dirname, basename } = require('path');
const { rename } = require('fs/promises');

module.exports = async (buildResult) => {
  const newArtifactPaths = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const artifactPath of buildResult.artifactPaths) {
    const artifactName = basename(artifactPath);

    // Because many people try to download these files but get confused by it
    if (['LosslessCut-win-x64.appx', 'LosslessCut-mac-universal.pkg'].includes(artifactName)) {
      const newPath = join(dirname(artifactPath), `${artifactName}-DO-NOT-DOWNLOAD`);
      // eslint-disable-next-line no-await-in-loop
      await rename(artifactPath, newPath);
      newArtifactPaths.push(newPath);
    } else {
      newArtifactPaths.push(artifactPath);
    }
  }

  // console.log(newArtifactPaths)

  // this seems to be the only way to do it
  // eslint-disable-next-line no-param-reassign
  buildResult.artifactPaths = newArtifactPaths;
};
