const execa = require('execa');
const bluebird = require('bluebird');
const which = bluebird.promisify(require('which'));

const Configstore = require('configstore');

const configstore = new Configstore('lossless-cut', { ffmpegPath: '' });


module.exports.cut = (filePath, cutFrom, cutTo, outFile) => {
  console.log('Cutting from', cutFrom, 'to', cutTo);

  return which('ffmpeg')
    .catch(() => configstore.get('ffmpegPath'))
    .then(ffmpegPath => execa(ffmpegPath, [
      '-i', filePath, '-y', '-vcodec', 'copy', '-acodec', 'copy', '-ss', cutFrom, '-t', cutTo - cutFrom, outFile,
    ]))
    .then((result) => {
      console.log(result.stdout);
    })
    .catch((err) => {
      console.error(err.stack);
      alert(`Failed to run ffmpeg, make sure you have it installed and in available in your PATH or its path configured in ${configstore.path}`);
    });
};
