const fs = require('fs');
const util = require('./util');

async function captureBookmark(customOutDir, filePath, interestedTimestamp) {
  const ext = 'txt';
  const outPath = util.getOutPath(customOutDir, filePath, `bookmark.${ext}`);
  const buf = `${interestedTimestamp}\n`;
  await fs.appendFile(outPath, buf);
  return util.transferTimestamps(filePath, outPath);
}

module.exports = captureBookmark;
