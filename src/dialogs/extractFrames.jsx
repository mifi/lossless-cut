import Swal from 'sweetalert2';
import i18n from 'i18next';


// eslint-disable-next-line import/prefer-default-export
export async function askExtractFramesAsImages({ segmentNumFrames, fps }) {
  const { value: captureChoice } = await Swal.fire({
    text: i18n.t('Extract frames of the selected segment as images?'),
    icon: 'question',
    input: 'radio',
    inputValue: 'thumbnailFilter',
    showCancelButton: true,
    customClass: { input: 'swal2-losslesscut-radio' },
    inputOptions: {
      thumbnailFilter: i18n.t('Capture the best image every nth second'),
      selectNthSec: i18n.t('Capture exactly one image every nth second'),
      selectNthFrame: i18n.t('Capture exactly one image every nth frame'),
      selectScene: i18n.t('Capture frames that differ the most from the previous frame'),
      everyFrame: i18n.t('Capture every single frame as an image'),
    },
  });

  if (!captureChoice) return undefined;

  let filter;
  let estimatedMaxNumFiles = segmentNumFrames;

  if (captureChoice === 'thumbnailFilter') {
    const { value } = await Swal.fire({
      text: i18n.t('Capture the best image every nth second'),
      icon: 'question',
      input: 'text',
      inputLabel: i18n.t('Enter the number of seconds between each image (decimal)'),
      inputValue: 5,
      showCancelButton: true,
    });
    if (value == null) return undefined;
    const intervalFrames = Math.round(parseFloat(value) * fps);
    if (Number.isNaN(intervalFrames) || intervalFrames < 1 || intervalFrames > 1000) return undefined; // a too large value uses a lot of memory

    filter = `thumbnail=${intervalFrames}`;
    estimatedMaxNumFiles = Math.round(segmentNumFrames / intervalFrames);
  }

  if (captureChoice === 'selectNthSec' || captureChoice === 'selectNthFrame') {
    let nthFrame;
    if (captureChoice === 'selectNthFrame') {
      const { value } = await Swal.fire({
        text: i18n.t('Capture exactly one image every nth frame'),
        icon: 'question',
        input: 'number',
        inputLabel: i18n.t('Enter the number of frames between each image (integer)'),
        inputValue: 30,
        showCancelButton: true,
      });
      if (value == null) return undefined;
      const intervalFrames = parseInt(value, 10);
      if (Number.isNaN(intervalFrames) || intervalFrames < 1) return undefined;
      nthFrame = intervalFrames;
    } else {
      const { value } = await Swal.fire({
        text: i18n.t('Capture exactly one image every nth second'),
        icon: 'question',
        input: 'text',
        inputLabel: i18n.t('Enter the number of seconds between each image (decimal)'),
        inputValue: 5,
        showCancelButton: true,
      });
      if (value == null) return undefined;
      const intervalFrames = Math.round(parseFloat(value) * fps);
      if (Number.isNaN(intervalFrames) || intervalFrames < 1) return undefined;
      nthFrame = intervalFrames;
    }

    filter = `select=not(mod(n\\,${nthFrame}))`;
    estimatedMaxNumFiles = Math.round(segmentNumFrames / nthFrame);
  }
  if (captureChoice === 'selectScene') {
    const { value } = await Swal.fire({
      text: i18n.t('Capture frames that differ the most from the previous frame'),
      icon: 'question',
      input: 'text',
      inputLabel: i18n.t('Enter a decimal number between 0 and 1 (sane values are 0.3 - 0.5)'),
      inputValue: '0.4',
      showCancelButton: true,
    });
    if (value == null) return undefined;
    const minSceneChange = parseFloat(value);
    if (Number.isNaN(minSceneChange) || minSceneChange <= 0 || minSceneChange >= 1) return undefined;

    filter = `select=gt(scene\\,${minSceneChange})`;
    // we don't know estimatedMaxNumFiles here
  }

  estimatedMaxNumFiles += 1; // just to be sure

  if (estimatedMaxNumFiles > 1000) {
    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      text: i18n.t('Note that depending on input parameters, up to {{estimatedMaxNumFiles}} files may be produced!', { estimatedMaxNumFiles }),
      showCancelButton: true,
      confirmButtonText: i18n.t('Confirm'),
    });
    if (!isConfirmed) return undefined;
  }

  return { filter, estimatedMaxNumFiles };
}
