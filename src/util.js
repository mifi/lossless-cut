import Swal from 'sweetalert2';
import i18n from 'i18next';
import lodashTemplate from 'lodash/template';

export const {
  isWindows,
  getOutDir,
  getOutFileExtension,
  transferTimestamps,
  dirExists,
  checkDirWriteAccess,
  havePermissionToReadFile,
  getOutPath,
  getExtensionForFormat,
  isMasBuild,
  isWindowsStoreBuild,
  isStoreBuild,
} = window.util;


export const toast = Swal.mixin({
  toast: true,
  position: 'top',
  showConfirmButton: false,
  timer: 5000,
});

export const errorToast = (title) => toast.fire({
  icon: 'error',
  title,
});

export const openDirToast = async ({ dirPath, ...props }) => {
  const { value } = await toast.fire({ icon: 'success', ...props, timer: 13000, showConfirmButton: true, confirmButtonText: i18n.t('Show'), showCancelButton: true, cancelButtonText: i18n.t('Close') });
  if (value) window.util.open(dirPath);
};

export async function showFfmpegFail(err) {
  console.error(err);
  return errorToast(`${i18n.t('Failed to run ffmpeg:')} ${err.stack}`);
}

export function setFileNameTitle(filePath) {
  const appName = 'LosslessCut';
  document.title = filePath ? `${appName} - ${window.util.getBaseName(filePath)}` : appName;
}

export function filenamify(name) {
  return name.replace(/[^0-9a-zA-Z_.]/g, '_');
}

export function withBlur(cb) {
  return (e) => {
    cb(e);
    e.target.blur();
  };
}

export function dragPreventer(ev) {
  ev.preventDefault();
}

// With these codecs, the player will not give a playback error, but instead only play audio
export function doesPlayerSupportFile(streams) {
  const videoStreams = streams.filter(s => s.codec_type === 'video');
  // Don't check audio formats, assume all is OK
  if (videoStreams.length === 0) return true;
  // If we have at least one video that is NOT of the unsupported formats, assume the player will be able to play it natively
  // https://github.com/mifi/lossless-cut/issues/595
  return videoStreams.some(s => !['hevc', 'prores', 'mpeg4'].includes(s.codec_name));
}

export const isDurationValid = (duration) => Number.isFinite(duration) && duration > 0;

// eslint-disable-next-line no-template-curly-in-string
export const defaultOutSegTemplate = '${FILENAME}-${CUT_FROM}-${CUT_TO}${SEG_SUFFIX}${EXT}';

export function generateSegFileName({ template, inputFileNameWithoutExt, segSuffix, ext, segNum, segLabel, cutFrom, cutTo }) {
  const compiled = lodashTemplate(template);
  return compiled({ FILENAME: inputFileNameWithoutExt, SEG_SUFFIX: segSuffix, EXT: ext, SEG_NUM: segNum, SEG_LABEL: segLabel, CUT_FROM: cutFrom, CUT_TO: cutTo });
}

export const hasDuplicates = (arr) => new Set(arr).size !== arr.length;

export function openAbout() {
  Swal.fire({
    icon: 'info',
    title: 'About LosslessCut',
    text: `You are running version ${window.util.getAppVersion()}`,
  });
}

export function isCuttingStart(cutFrom) {
  return cutFrom > 0;
}

export function isCuttingEnd(cutTo, duration) {
  if (!isDurationValid(duration)) return true;
  return cutTo < duration;
}
