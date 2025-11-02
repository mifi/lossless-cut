import i18n from 'i18next';
import { PlatformPath } from 'node:path';
import pMap from 'p-map';
import max from 'lodash/max';
import invariant from 'tiny-invariant';

import { isMac, isWindows, hasDuplicates, filenamify, getOutFileExtension } from '../util';
import isDev from '../isDev';
import { getSegmentTags, formatSegNum, getGuaranteedSegments } from '../segments';
import { FormatTimecode, SegmentToExport } from '../types';
import safeishEval from '../worker/eval';


export const segNumVariable = 'SEG_NUM';
export const segNumIntVariable = 'SEG_NUM_INT';
export const selectedSegNumVariable = 'SELECTED_SEG_NUM';
export const selectedSegNumIntVariable = 'SELECTED_SEG_NUM_INT';
export const segSuffixVariable = 'SEG_SUFFIX';
export const extVariable = 'EXT';
export const segTagsVariable = 'SEG_TAGS';

// I don't remember why I set it to 200, but on Windows max length seems to be 256, on MacOS it seems to be 255.
export const maxFileNameLength = 200;

const { parse: parsePath, sep: pathSep, join: pathJoin, normalize: pathNormalize, basename }: PlatformPath = window.require('path');


export interface GeneratedOutFileNames {
  fileNames: string[],
  originalFileNames?: string[] | undefined,
  problems: {
    error: string | undefined;
    sameAsInputFileNameWarning?: boolean;
  },
}

export type GenerateOutFileNames = (template: string) => Promise<GeneratedOutFileNames>;

export interface GenerateMergedOutFileNamesParams {
  template: string;
  filePaths: string[];
  fileFormat: string;
  outputDir: string;
  epochMs: number;
}

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
export const defaultCutFileTemplate = '${FILENAME}-${CUT_FROM}-${CUT_TO}${SEG_SUFFIX}${EXT}';
// eslint-disable-next-line no-template-curly-in-string
export const defaultCutMergedFileTemplate = '${FILENAME}-cut-merged-${EPOCH_MS}${EXT}';
// eslint-disable-next-line no-template-curly-in-string
export const defaultMergedFileTemplate = '${FILENAME}-merged-${EPOCH_MS}${EXT}';


async function interpolateOutFileName(template: string, { epochMs, inputFileNameWithoutExt, ext, segSuffix, segNum, segNumPadded, selectedSegNum, selectedSegNumPadded, segLabels, cutFrom, cutFromStr, cutTo, cutToStr, cutDurationStr, tags, exportCount, currentFileExportCount }: {
  epochMs: number,
  inputFileNameWithoutExt: string,
  ext: string,
  exportCount: number,
  currentFileExportCount?: number | undefined,
  segLabels: string[],
} & Partial<{
  segSuffix: string,
  segNum: number,
  segNumPadded: string,
  selectedSegNum: number,
  selectedSegNumPadded: string,
  cutFrom: number,
  cutFromStr: string,
  cutTo: number,
  cutToStr: string,
  cutDurationStr: string,
  tags: Record<string, string>,
}>) {
  const context = {
    FILENAME: inputFileNameWithoutExt,
    [segSuffixVariable]: segSuffix,
    [extVariable]: ext,
    [segNumIntVariable]: segNum,
    [segNumVariable]: segNumPadded,
    [selectedSegNumIntVariable]: selectedSegNum,
    [selectedSegNumVariable]: selectedSegNumPadded,
    SEG_LABEL: segLabels.length === 1 ? segLabels[0] : segLabels,
    EPOCH_MS: epochMs,
    CUT_FROM: cutFromStr,
    CUT_FROM_NUM: cutFrom,
    CUT_TO: cutToStr,
    CUT_TO_NUM: cutTo,
    CUT_DURATION: cutDurationStr,
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

async function generateWithFallback({ generate, desiredTemplate, defaultTemplate, safeOutputFileName, filePath, outputDir, maxLabelLength }: {
  generate: (a: {
    template: string,
    sanitizeName: (name: string) => string,
    safeOutputFileName: boolean,
  }) => Promise<string[]>,
  desiredTemplate: string,
  defaultTemplate: string,
  safeOutputFileName: boolean,
  filePath: string,
  outputDir: string,
  maxLabelLength: number,
}) {
  // Fields that did not come from the source file's name must be sanitized, because they may contain characters that are not supported by the target operating/file system
  // however we disable this when the user has chosen to (safeOutputFileName === false)
  const sanitizeName = (name: string, safe: boolean) => (safe ? filenamify(name) : name).slice(0, Math.max(0, maxLabelLength));

  let originalFileNames: string[] | undefined;
  let problems: GeneratedOutFileNames['problems'];

  try {
    originalFileNames = await generate({ template: desiredTemplate, sanitizeName: (name: string) => sanitizeName(name, safeOutputFileName), safeOutputFileName });
    problems = getTemplateProblems({ fileNames: originalFileNames, filePath, outputDir, safeOutputFileName });
  } catch (err) {
    console.warn(err);
    problems = {
      error: i18n.t('Template error: {{error}}', { error: err instanceof Error ? err.message : String(err) }),
    };
  }

  if (problems.error != null) {
    const fileNames = await generate({ template: defaultTemplate, sanitizeName: (name: string) => sanitizeName(name, true), safeOutputFileName: true });
    return { fileNames, originalFileNames, problems };
  }

  invariant(originalFileNames != null);
  return { fileNames: originalFileNames, problems };
}

export async function generateCutFileNames({ fileDuration, segmentsToExport: segmentsToExportIn, template: desiredTemplate, formatTimecode, isCustomFormatSelected, fileFormat, filePath, outputDir, safeOutputFileName, maxLabelLength, outputFileNameMinZeroPadding, exportCount, currentFileExportCount }: {
  fileDuration: number | undefined,
  segmentsToExport: SegmentToExport[],
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
  const segmentsToExport = getGuaranteedSegments(segmentsToExportIn, fileDuration);

  return generateWithFallback({
    generate: async ({ template, safeOutputFileName: safeOutputFileName2, sanitizeName }) => {
      const epochMs = Date.now();

      const maxOriginalIndex = max(segmentsToExport.map((s) => s.originalIndex)) ?? 0;

      return pMap(segmentsToExport, async (segment, i) => {
        const { start, end, name = '' } = segment;
        const selectedSegNum = i + 1;
        const selectedSegNumPadded = formatSegNum(i, segmentsToExport.length, outputFileNameMinZeroPadding);
        const segNum = segment.originalIndex + 1;
        const segNumPadded = formatSegNum(segment.originalIndex, maxOriginalIndex + 1, outputFileNameMinZeroPadding);

        function getSegSuffix() {
          if (name) return `-${sanitizeName(name)}`;
          // https://github.com/mifi/lossless-cut/issues/583
          if (segmentsToExport.length > 1) return `-seg${segNumPadded}`;
          return '';
        }

        const { name: inputFileNameWithoutExt } = parsePath(filePath);

        const cutDuration = end - start;

        const segFileName = await interpolateOutFileName(template, {
          epochMs,
          segNum,
          segNumPadded,
          selectedSegNum,
          selectedSegNumPadded,
          segSuffix: getSegSuffix(),
          inputFileNameWithoutExt,
          ext: getOutFileExtension({ isCustomFormatSelected, outFormat: fileFormat, filePath }),
          segLabels: [sanitizeName(name)],
          cutFrom: start,
          cutFromStr: formatTimecode({ seconds: start, fileNameFriendly: true }),
          cutTo: end,
          cutToStr: formatTimecode({ seconds: end, fileNameFriendly: true }),
          cutDurationStr: formatTimecode({ seconds: cutDuration, fileNameFriendly: true }),
          tags: Object.fromEntries(Object.entries(getSegmentTags(segment)).map(([tag, value]) => [tag, sanitizeName(value)])),
          exportCount,
          currentFileExportCount,
        });

        return maybeTruncatePath(segFileName, safeOutputFileName2);
      }, { concurrency: 5 });
    },
    desiredTemplate,
    defaultTemplate: defaultCutFileTemplate,
    filePath,
    outputDir,
    maxLabelLength,
    safeOutputFileName,
  });
}

export type GenerateMergedOutFileNames = (params: GenerateMergedOutFileNamesParams) => Promise<GeneratedOutFileNames>;

export async function generateCutMergedFileNames({ template: desiredTemplate, isCustomFormatSelected, fileFormat, filePath, outputDir, safeOutputFileName, maxLabelLength, exportCount, currentFileExportCount, segLabels, epochMs = Date.now() }: {
  template: string,
  isCustomFormatSelected: boolean,
  fileFormat: string,
  filePath: string,
  outputDir: string,
  safeOutputFileName: boolean,
  maxLabelLength: number,
  exportCount: number,
  currentFileExportCount: number,
  segLabels: string[],
  epochMs?: number,
}) {
  return generateWithFallback({
    generate: async ({ template, safeOutputFileName: safeOutputFileName2, sanitizeName }) => {
      const { name: inputFileNameWithoutExt } = parsePath(filePath);

      const fileName = await interpolateOutFileName(template, {
        epochMs,
        inputFileNameWithoutExt,
        ext: getOutFileExtension({ isCustomFormatSelected, outFormat: fileFormat, filePath }),
        exportCount,
        currentFileExportCount,
        segLabels: segLabels.map((label) => sanitizeName(label)),
      });

      return [maybeTruncatePath(fileName, safeOutputFileName2)];
    },
    desiredTemplate,
    defaultTemplate: defaultCutMergedFileTemplate,
    filePath,
    outputDir,
    maxLabelLength,
    safeOutputFileName,
  });
}

export async function generateMergedFileNames({ template: desiredTemplate, isCustomFormatSelected, fileFormat, filePaths, outputDir, safeOutputFileName, maxLabelLength, exportCount, epochMs }: {
  template: string,
  isCustomFormatSelected: boolean,
  fileFormat: string,
  filePaths: string[],
  outputDir: string,
  safeOutputFileName: boolean,
  maxLabelLength: number,
  exportCount: number,
  epochMs: number,
}) {
  const [firstPath] = filePaths;
  invariant(firstPath != null);

  return generateWithFallback({
    generate: async ({ template, safeOutputFileName: safeOutputFileName2, sanitizeName }) => {
      const { name: inputFileNameWithoutExt } = parsePath(firstPath);

      const fileName = await interpolateOutFileName(template, {
        epochMs,
        inputFileNameWithoutExt,
        ext: getOutFileExtension({ isCustomFormatSelected, outFormat: fileFormat, filePath: firstPath }),
        exportCount,
        segLabels: filePaths.map((filePath) => sanitizeName(basename(filePath))),
      });

      return [maybeTruncatePath(fileName, safeOutputFileName2)];
    },
    desiredTemplate,
    defaultTemplate: defaultCutMergedFileTemplate,
    filePath: firstPath,
    outputDir,
    maxLabelLength,
    safeOutputFileName,
  });
}
