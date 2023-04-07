import i18n from 'i18next';
import lodashTemplate from 'lodash/template';

import { isMac, isWindows, hasDuplicates, filenamify, getOutFileExtension, getNumDigits } from '../util';
import isDev from '../isDev';
import { getSegmentTags } from '../segments';


const { parse: parsePath, sep: pathSep, join: pathJoin, normalize: pathNormalize } = window.require('path');

// eslint-disable-next-line import/prefer-default-export
export function getOutSegError({ fileNames, filePath, outputDir, safeOutputFileName }) {
  let error;

  // eslint-disable-next-line no-restricted-syntax
  for (const fileName of fileNames) {
    if (!filePath) {
      error = 'No file path';
      break;
    }

    const invalidChars = new Set();

    // https://stackoverflow.com/questions/1976007/what-characters-are-forbidden-in-windows-and-linux-directory-names
    // note that we allow path separators!
    if (isWindows) {
      ['<', '>', ':', '"', '|', '?', '*'].forEach((char) => invalidChars.add(char));
    } else if (isMac) {
      // Colon is invalid on windows https://github.com/mifi/lossless-cut/issues/631 and on MacOS, but not Linux https://github.com/mifi/lossless-cut/issues/830
      [':'].forEach((char) => invalidChars.add(char));
    }

    if (safeOutputFileName) invalidChars.add(pathSep);

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

// This is used as a fallback and so it has to always generate unique file names
// eslint-disable-next-line no-template-curly-in-string
export const defaultOutSegTemplate = '${FILENAME}-${CUT_FROM}-${CUT_TO}${SEG_SUFFIX}${EXT}';

function interpolateSegmentFileName({ template, epochMs, inputFileNameWithoutExt, segSuffix, ext, segNum, segLabel, cutFrom, cutTo, tags }) {
  const compiled = lodashTemplate(template);

  const data = {
    FILENAME: inputFileNameWithoutExt,
    SEG_SUFFIX: segSuffix,
    EXT: ext,
    SEG_NUM: segNum,
    SEG_LABEL: segLabel,
    EPOCH_MS: String(epochMs),
    CUT_FROM: cutFrom,
    CUT_TO: cutTo,
    SEG_TAGS: {
      // allow both original case and uppercase
      ...tags,
      ...Object.fromEntries(Object.entries(tags).map(([key, value]) => [`${key.toLocaleUpperCase('en-US')}`, value])),
    },
  };
  return compiled(data);
}

function formatSegNum(segIndex, segments) {
  const numDigits = getNumDigits(segments);
  return `${segIndex + 1}`.padStart(numDigits, '0');
}

export function generateOutSegFileNames({ segments, template, forceSafeOutputFileName, formatTimecode, isCustomFormatSelected, fileFormat, filePath, safeOutputFileName, maxLabelLength }) {
  const currentTimestamp = Date.now();

  return segments.map((segment, i) => {
    const { start, end, name = '' } = segment;
    const segNum = formatSegNum(i, segments);

    // Fields that did not come from the source file's name must be sanitized, because they may contain characters that are not supported by the target operating/file system
    // however we disable this when the user has chosen to (safeOutputFileName === false)
    const filenamifyOrNot = (fileName) => (safeOutputFileName || forceSafeOutputFileName ? filenamify(fileName) : fileName).substr(0, maxLabelLength);

    function getSegSuffix() {
      if (name) return `-${filenamifyOrNot(name)}`;
      // https://github.com/mifi/lossless-cut/issues/583
      if (segments.length > 1) return `-seg${segNum}`;
      return '';
    }

    const { name: inputFileNameWithoutExt } = parsePath(filePath);

    const segFileName = interpolateSegmentFileName({
      template,
      epochMs: currentTimestamp + i, // for convenience: give each segment a unique timestamp
      segNum,
      inputFileNameWithoutExt,
      segSuffix: getSegSuffix(),
      ext: getOutFileExtension({ isCustomFormatSelected, outFormat: fileFormat, filePath }),
      segLabel: filenamifyOrNot(name),
      cutFrom: formatTimecode({ seconds: start, fileNameFriendly: true }),
      cutTo: formatTimecode({ seconds: end, fileNameFriendly: true }),
      tags: Object.fromEntries(Object.entries(getSegmentTags(segment)).map(([tag, value]) => [tag, filenamifyOrNot(value)])),
    });

    // Now split the path by its separator, so we can check the actual file name (last path seg)
    const pathSegs = segFileName.split(pathSep);
    if (pathSegs.length === 0) return '';
    const [lastSeg] = pathSegs.slice(-1);
    const rest = pathSegs.slice(0, -1);

    return [
      ...rest,
      // If sanitation is enabled, make sure filename (last seg of the path) is not too long
      safeOutputFileName ? lastSeg.substring(0, 200) : lastSeg,
    ].join(pathSep);
  });
}
