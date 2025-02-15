import i18n from 'i18next';
import { PlatformPath } from 'node:path';
import pMap from 'p-map';

import { isMac, isWindows, hasDuplicates, filenamify, getOutFileExtension } from '../util';
import isDev from '../isDev';
import { getSegmentTags, formatSegNum } from '../segments';
import { FormatTimecode, SegmentToExport } from '../types';
import safeishEval from '../worker/eval';


export const segNumVariable = 'SEG_NUM';
export const segNumIntVariable = 'SEG_NUM_INT';
export const segSuffixVariable = 'SEG_SUFFIX';
export const extVariable = 'EXT';
export const segTagsVariable = 'SEG_TAGS';

// I don't remember why I set it to 200, but on Windows max length seems to be 256, on MacOS it seems to be 255.
export const maxFileNameLength = 200;

const { parse: parsePath, sep: pathSep, join: pathJoin, normalize: pathNormalize, basename }: PlatformPath = window.require('path');


function getTemplateProblems({ fileNames, filePath, outputDir, safeOutputFileName }: {
  fileNames: string[],
  filePath: string,
  outputDir: string,
  safeOutputFileName: boolean,
}) {
  let error: string | undefined;
  let sameAsInputFileNameWarning = false;

  for (const fileName of fileNames) {
    if (!filePath) {
      error = i18n.t('No file is loaded');
      break;
    }

    const invalidChars = new Set<string>();

    // https://stackoverflow.com/questions/1976007/what-characters-are-forbidden-in-windows-and-linux-directory-names
    // note that we allow path separators in some cases (see below)
    if (isWindows) {
      ['<', '>', ':', '"', '|', '?', '*'].forEach((char) => invalidChars.add(char));
    } else if (isMac) {
      // Colon is invalid on windows https://github.com/mifi/lossless-cut/issues/631 and on MacOS, but not Linux https://github.com/mifi/lossless-cut/issues/830
      [':'].forEach((char) => invalidChars.add(char));
    }

    if (safeOutputFileName) {
      if (isWindows) {
        // Only when sanitize is "off" shall we allow slashes (you're on your own)
        invalidChars.add('/');
        invalidChars.add('\\');
      } else {
        invalidChars.add(pathSep);
      }
    }

    const inPathNormalized = pathNormalize(filePath);
    const outPathNormalized = pathNormalize(pathJoin(outputDir, fileName));
    const sameAsInputPath = outPathNormalized === inPathNormalized;
    const windowsMaxPathLength = 259;
    const shouldCheckPathLength = isWindows || isDev;
    const shouldCheckFileEnd = isWindows || isDev;

    if (basename(filePath) === fileName) {
      sameAsInputFileNameWarning = true; // just an extra warning in case sameAsInputPath doesn't work
    }

    if (fileName.length === 0) {
      error = i18n.t('At least one resulting file name has no length');
      break;
    }
    const matchingInvalidChars = new Set([...fileName].filter((char) => invalidChars.has(char)));
    if (matchingInvalidChars.size > 0) {
      error = i18n.t('At least one resulting file name contains invalid character(s): {{invalidChars}}', { invalidChars: `"${[...matchingInvalidChars].join('", "')}"` });
      break;
    }
    if (sameAsInputPath) {
      error = i18n.t('At least one resulting file name is the same as the input path');
      break;
    }
    if (shouldCheckFileEnd && /[\s.]$/.test(fileName)) {
      // Filenames cannot end in a space or dot on windows
      // https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file#naming-conventions
      error = i18n.t('At least one resulting file name ends with a whitespace character or a dot, which is not allowed.');
      break;
    }
    if (shouldCheckPathLength && outPathNormalized.length >= windowsMaxPathLength) {
      error = i18n.t('At least one resulting file will have a too long path');
      break;
    }
  }

  if (error == null && fileNames.length > 1 && hasDuplicates(fileNames)) {
    error = i18n.t('Output file name template results in duplicate file names (you are trying to export multiple files with the same name). You can fix this for example by adding the "{{segNumVariable}}" variable.', { segNumVariable });
  }

  return {
    error,
    sameAsInputFileNameWarning,
  };
}

// This is used as a fallback and so it has to always generate unique file names
// eslint-disable-next-line no-template-curly-in-string
export const defaultOutSegTemplate = '${FILENAME}-${CUT_FROM}-${CUT_TO}${SEG_SUFFIX}${EXT}';
// eslint-disable-next-line no-template-curly-in-string
export const defaultCutMergedFileTemplate = '${FILENAME}-cut-merged-${EPOCH_MS}${EXT}';
// eslint-disable-next-line no-template-curly-in-string
export const defaultMergedFileTemplate = '${FILENAME}-merged-${EPOCH_MS}${EXT}';

async function interpolateOutFileName(template: string, { epochMs, inputFileNameWithoutExt, ext, segSuffix, segNum, segNumPadded, segLabel, cutFrom, cutTo, tags, exportCount, currentFileExportCount }: {
  epochMs: number,
  inputFileNameWithoutExt: string,
  ext: string,
  exportCount: number,
  currentFileExportCount?: number | undefined,
} & Partial<{
  segSuffix: string,
  segNum: number,
  segNumPadded: string,
  segLabel: string,
  cutFrom: string,
  cutTo: string,
  tags: Record<string, string>,
}>) {
  const context = {
    FILENAME: inputFileNameWithoutExt,
    [segSuffixVariable]: segSuffix,
    [extVariable]: ext,
    [segNumIntVariable]: segNum,
    [segNumVariable]: segNumPadded, // todo rename this (breaking change)
    SEG_LABEL: segLabel,
    EPOCH_MS: epochMs,
    CUT_FROM: cutFrom,
    CUT_TO: cutTo,
    [segTagsVariable]: tags && {
      // allow both original case and uppercase
      ...tags,
      ...Object.fromEntries(Object.entries(tags).map(([key, value]) => [`${key.toLocaleUpperCase('en-US')}`, value])),
    },
    FILE_EXPORT_COUNT: currentFileExportCount != null ? currentFileExportCount + 1 : undefined,
    EXPORT_COUNT: exportCount != null ? exportCount + 1 : undefined,
  };

  const ret = (await safeishEval(`\`${template}\``, context));
  if (typeof ret !== 'string') throw new Error('Expression did not lead to a string');
  return ret;
}

function maybeTruncatePath(fileName: string, truncate: boolean) {
  // Split the path by its separator, so we can check the actual file name (last path seg)
  const pathSegs = fileName.split(pathSep);
  if (pathSegs.length === 0) return '';
  const [lastSeg] = pathSegs.slice(-1);
  const rest = pathSegs.slice(0, -1);

  return [
    ...rest,
    // If sanitation is enabled, make sure filename (last seg of the path) is not too long
    truncate ? lastSeg!.slice(0, maxFileNameLength) : lastSeg,
  ].join(pathSep);
}

export async function generateOutSegFileNames({ segments, template: desiredTemplate, formatTimecode, isCustomFormatSelected, fileFormat, filePath, outputDir, safeOutputFileName, maxLabelLength, outputFileNameMinZeroPadding, exportCount, currentFileExportCount }: {
  segments: SegmentToExport[],
  template: string,
  formatTimecode: FormatTimecode,
  isCustomFormatSelected: boolean,
  fileFormat: string,
  filePath: string,
  outputDir: string,
  safeOutputFileName: boolean,
  maxLabelLength: number,
  outputFileNameMinZeroPadding: number,
  exportCount: number,
  currentFileExportCount: number,
}) {
  async function generate({ template, forceSafeOutputFileName }: { template: string, forceSafeOutputFileName: boolean }) {
    const epochMs = Date.now();

    return pMap(segments, async (segment, i) => {
      const { start, end, name = '' } = segment;
      const segNum = i + 1;
      const segNumPadded = formatSegNum(i, segments.length, outputFileNameMinZeroPadding);

      // Fields that did not come from the source file's name must be sanitized, because they may contain characters that are not supported by the target operating/file system
      // however we disable this when the user has chosen to (safeOutputFileName === false)
      const filenamifyOrNot = (fileName: string) => (safeOutputFileName || forceSafeOutputFileName ? filenamify(fileName) : fileName).slice(0, Math.max(0, maxLabelLength));

      function getSegSuffix() {
        if (name) return `-${filenamifyOrNot(name)}`;
        // https://github.com/mifi/lossless-cut/issues/583
        if (segments.length > 1) return `-seg${segNumPadded}`;
        return '';
      }

      const { name: inputFileNameWithoutExt } = parsePath(filePath);

      const segFileName = await interpolateOutFileName(template, {
        epochMs,
        segNum,
        segNumPadded,
        inputFileNameWithoutExt,
        segSuffix: getSegSuffix(),
        ext: getOutFileExtension({ isCustomFormatSelected, outFormat: fileFormat, filePath }),
        segLabel: filenamifyOrNot(name),
        cutFrom: formatTimecode({ seconds: start, fileNameFriendly: true }),
        cutTo: formatTimecode({ seconds: end, fileNameFriendly: true }),
        tags: Object.fromEntries(Object.entries(getSegmentTags(segment)).map(([tag, value]) => [tag, filenamifyOrNot(value)])),
        exportCount,
        currentFileExportCount,
      });

      return maybeTruncatePath(segFileName, safeOutputFileName);
    }, { concurrency: 5 });
  }

  let fileNames = await generate({ template: desiredTemplate, forceSafeOutputFileName: false });

  const problems = getTemplateProblems({ fileNames, filePath, outputDir, safeOutputFileName });
  if (problems.error != null) {
    fileNames = await generate({ template: defaultOutSegTemplate, forceSafeOutputFileName: true });
  }

  return { fileNames, problems };
}

export type GenerateOutFileNames = (a: { template: string }) => Promise<{
  fileNames: string[],
  problems: {
    error: string | undefined;
    sameAsInputFileNameWarning: boolean;
  },
}>;

export async function generateMergedFileNames({ template: desiredTemplate, isCustomFormatSelected, fileFormat, filePath, outputDir, safeOutputFileName, epochMs = Date.now(), exportCount, currentFileExportCount }: {
  template: string,
  isCustomFormatSelected: boolean,
  fileFormat: string,
  filePath: string,
  outputDir: string,
  safeOutputFileName: boolean,
  epochMs?: number,
  exportCount: number,
  currentFileExportCount?: number,
}) {
  async function generate(template: string) {
    const { name: inputFileNameWithoutExt } = parsePath(filePath);

    const fileName = await interpolateOutFileName(template, {
      epochMs,
      inputFileNameWithoutExt,
      ext: getOutFileExtension({ isCustomFormatSelected, outFormat: fileFormat, filePath }),
      exportCount,
      currentFileExportCount,
    });

    return maybeTruncatePath(fileName, safeOutputFileName);
  }

  let fileName = await generate(desiredTemplate);

  const problems = getTemplateProblems({ fileNames: [fileName], filePath, outputDir, safeOutputFileName });
  if (problems.error != null) {
    fileName = await generate(defaultCutMergedFileTemplate);
  }

  return { fileNames: [fileName], problems };
}
