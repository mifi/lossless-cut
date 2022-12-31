import i18n from 'i18next';

import { isMac, isWindows, hasDuplicates } from '../util';
import isDev from '../isDev';

const { sep: pathSep, join: pathJoin, normalize: pathNormalize } = window.require('path');

// eslint-disable-next-line import/prefer-default-export
export function getOutSegError({ fileNames, filePath, outputDir }) {
  let error;

  // eslint-disable-next-line no-restricted-syntax
  for (const fileName of fileNames) {
    if (!filePath) {
      error = 'No file path';
      break;
    }

    const invalidChars = new Set();

    // https://stackoverflow.com/questions/1976007/what-characters-are-forbidden-in-windows-and-linux-directory-names
    if (isWindows) {
      ['/', '<', '>', ':', '"', '\\', '|', '?', '*'].forEach((char) => invalidChars.add(char));
    } else if (isMac) {
      // Colon is invalid on windows https://github.com/mifi/lossless-cut/issues/631 and on MacOS, but not Linux https://github.com/mifi/lossless-cut/issues/830
      ['/', ':'].forEach((char) => invalidChars.add(char));
    } else {
      invalidChars.add(pathSep);
    }

    const outPath = pathNormalize(pathJoin(outputDir, fileName));
    const sameAsInputPath = outPath === pathNormalize(filePath);
    const windowsMaxPathLength = 259;
    const shouldCheckPathLength = isWindows || isDev;

    if (fileName.length === 0) {
      error = i18n.t('At least one resulting file name has no length');
      break;
    }
    if ([...fileName].some((char) => invalidChars.has(char))) {
      error = i18n.t('At least one resulting file name contains invalid characters');
      break;
    }
    if (sameAsInputPath) {
      error = i18n.t('At least one resulting file name is the same as the input path');
      break;
    }
    if (shouldCheckPathLength && outPath.length >= windowsMaxPathLength) {
      error = i18n.t('At least one resulting file will have a too long path');
      break;
    }
  }

  if (error != null) return error;

  if (hasDuplicates(fileNames)) return i18n.t('Output file name template results in duplicate file names (you are trying to export multiple files with the same name.)');

  return undefined;
}
