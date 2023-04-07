const afterAllArtifactBuild = require('./afterAllArtifactBuild');

afterAllArtifactBuild({
  outDir: '/path/to/lossless-cut/dist',
  artifactPaths: [
    '/path/to/lossless-cut/dist/LosslessCut-mac-arm64.dmg.blockmap',
    '/path/to/lossless-cut/dist/LosslessCut-mac-arm64.dmg',
    '/path/to/lossless-cut/dist/LosslessCut-mac-universal.pkg',
    '/path/to/lossless-cut/dist/LosslessCut-win-x64.appx',
  ],
});
