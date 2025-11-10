import { useState, useCallback, ChangeEventHandler } from 'react';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

import { Html5ifyMode } from '../../../common/types';
import { DirectoryAccessDeclinedError } from '../../errors';
import getSwal from '../swal';
import Checkbox from '../components/Checkbox';
import { getSuffixedOutPath, html5dummySuffix, html5ifiedPrefix } from '../util';
import { SetWorking } from './useLoading';
import { WithErrorHandling } from './useErrorHandling';
import { FfmpegOperations } from './useFfmpegOperations';
import { ShowGenericDialog, useGenericDialogContext } from '../components/GenericDialog';
import * as AlertDialog from '../components/AlertDialog';
import { ButtonRow } from '../components/Dialog';
import { DialogButton } from '../components/Button';


export default function useHtml5ify({ filePath, hasVideo, hasAudio, workingRef, setWorking, ensureWritableOutDir, customOutDir, batchFiles, enableAutoHtml5ify, setProgress, html5ify, html5ifyDummy, withErrorHandling, showGenericDialog }: {
  filePath: string | undefined,
  hasVideo: boolean,
  hasAudio: boolean,
  workingRef: React.MutableRefObject<boolean>,
  setWorking: SetWorking,
  ensureWritableOutDir: (options: { inputPath: string, outDir: string | undefined }) => Promise<string | undefined>,
  customOutDir: string | undefined,
  batchFiles: { path: string }[],
  enableAutoHtml5ify: boolean,
  setProgress: (progress: number | undefined) => void,
  html5ify: FfmpegOperations['html5ify'],
  html5ifyDummy: FfmpegOperations['html5ifyDummy'],
  withErrorHandling: WithErrorHandling,
  showGenericDialog: ShowGenericDialog,
}) {
  const [previewFilePath, setPreviewFilePath] = useState<string>();
  const [usingDummyVideo, setUsingDummyVideo] = useState(false);
  const [rememberConvertToSupportedFormat, setRememberConvertToSupportedFormat] = useState<Html5ifyMode>();

  const html5ifyAndLoad = useCallback(async (cod: string | undefined, fp: string, speed: Html5ifyMode, hv: boolean, ha: boolean) => {
    const usesDummyVideo = speed === 'fastest';
    console.log('html5ifyAndLoad', { speed, hasVideo: hv, hasAudio: ha, usesDummyVideo });

    async function doHtml5ify() {
      if (speed == null) return undefined;
      if (speed === 'fastest') {
        const path = getSuffixedOutPath({ customOutDir: cod, filePath: fp, nameSuffix: `${html5ifiedPrefix}${html5dummySuffix}.mkv` });
        try {
          setProgress(0);
          await html5ifyDummy({ filePath: fp, outPath: path, onProgress: setProgress });
        } finally {
          setProgress(undefined);
        }
        return path;
      }

      try {
        const shouldIncludeVideo = !usesDummyVideo && hv;
        return await html5ify({ customOutDir: cod, filePath: fp, speed, hasAudio: ha, hasVideo: shouldIncludeVideo, onProgress: setProgress });
      } finally {
        setProgress(undefined);
      }
    }

    const path = await doHtml5ify();
    if (!path) return;

    setPreviewFilePath(path);
    setUsingDummyVideo(usesDummyVideo);
  }, [html5ify, html5ifyDummy, setProgress]);

  const askForHtml5ifySpeed = useCallback(async ({ allowedOptions, showRemember, initialOption }: {
    allowedOptions: Html5ifyMode[],
    showRemember?: boolean | undefined,
    initialOption?: Html5ifyMode | undefined,
  }) => {
    const availOptions: Record<Html5ifyMode, string> = {
      fastest: i18n.t('Fastest: FFmpeg-assisted playback'),
      fast: i18n.t('Fast: Full quality remux (no audio), likely to fail'),
      'fast-audio-remux': i18n.t('Fast: Full quality remux, likely to fail'),
      'fast-audio': i18n.t('Fast: Remux video, encode audio (fails if unsupported video codec)'),
      slow: i18n.t('Slow: Low quality encode (no audio)'),
      'slow-audio': i18n.t('Slow: Low quality encode'),
      slowest: i18n.t('Slowest: High quality encode'),
    };
    const inputOptions: Partial<Record<Html5ifyMode, string>> = {};
    allowedOptions.forEach((allowedOption) => {
      inputOptions[allowedOption] = availOptions[allowedOption];
    });

    const response = await new Promise<{ selectedOption: Html5ifyMode, rememberChoice: boolean } | undefined>((resolve) => {
      function AskForHtml5ifySpeed() {
        const { onOpenChange } = useGenericDialogContext();
        const { t } = useTranslation();

        const [option, setOption] = useState(initialOption != null && inputOptions[initialOption] ? initialOption : Object.keys(inputOptions)[0]! as Html5ifyMode);
        const [remember, setRemember] = useState(!!initialOption);

        const onOptionChange = useCallback<ChangeEventHandler<HTMLInputElement>>((e) => setOption(e.currentTarget.value as Html5ifyMode), []);

        const onRememberChange = useCallback((checked: boolean) => setRemember(checked), []);

        const handleOkClick = useCallback(() => {
          resolve({ selectedOption: option, rememberChoice: remember });
          onOpenChange(false);
        }, [onOpenChange, option, remember]);

        return (
          <AlertDialog.Content aria-describedby={undefined} style={{ width: '80vw' }}>
            <AlertDialog.Title>
              {i18n.t('Convert to supported format')}
            </AlertDialog.Title>

            <AlertDialog.Description>
              {i18n.t('These options will let you convert files to a format that is supported by the player. You can try different options and see which works with your file. Note that the conversion is for preview only. When you run an export, the output will still be lossless with full quality')}
            </AlertDialog.Description>

            {Object.entries(inputOptions).map(([value, label]) => {
              const id = `html5ify-${value}`;
              return (
                <div key={value}>
                  <input
                    id={id}
                    type="radio"
                    name="html5ify-speed"
                    value={value}
                    checked={option === value}
                    onChange={onOptionChange}
                  />
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label htmlFor={id} style={{ marginLeft: '.5em' }}>{label}</label>
                </div>
              );
            })}

            {showRemember && <Checkbox checked={remember} onCheckedChange={onRememberChange} label={t('Use this for all files until LosslessCut is restarted?')} style={{ marginTop: '.5em' }} />}

            <ButtonRow>
              <AlertDialog.Cancel asChild>
                <DialogButton>{t('Cancel')}</DialogButton>
              </AlertDialog.Cancel>

              <DialogButton onClick={handleOkClick} primary>{t('OK')}</DialogButton>
            </ButtonRow>
          </AlertDialog.Content>
        );
      }

      showGenericDialog({
        isAlert: true,
        content: <AskForHtml5ifySpeed />,
        onClose: () => resolve(undefined),
      });
    });

    if (response == null) {
      return undefined;
    }

    return response;
  }, [showGenericDialog]);

  const userHtml5ifyCurrentFile = useCallback(async ({ ignoreRememberedValue }: { ignoreRememberedValue?: boolean } = {}) => {
    if (!filePath) return;

    let selectedOption = rememberConvertToSupportedFormat;
    if (selectedOption == null || ignoreRememberedValue) {
      let allowedOptions: Html5ifyMode[] = [];
      if (hasAudio && hasVideo) allowedOptions = ['fastest', 'fast-audio-remux', 'fast-audio', 'fast', 'slow', 'slow-audio', 'slowest'];
      else if (hasAudio) allowedOptions = ['fast-audio-remux', 'slow-audio', 'slowest'];
      else if (hasVideo) allowedOptions = ['fastest', 'fast', 'slow', 'slowest'];

      const userResponse = await askForHtml5ifySpeed({ allowedOptions, showRemember: true, initialOption: selectedOption });
      console.log('Choice', userResponse);
      if (userResponse == null) return;
      ({ selectedOption } = userResponse);

      const { rememberChoice } = userResponse;

      setRememberConvertToSupportedFormat(rememberChoice ? selectedOption : undefined);
    }

    if (workingRef.current) return;
    try {
      setWorking({ text: i18n.t('Converting to supported format') });
      await withErrorHandling(async () => {
        await html5ifyAndLoad(customOutDir, filePath, selectedOption, hasVideo, hasAudio);
      }, i18n.t('Failed to convert file. Try a different conversion'));
    } finally {
      setWorking(undefined);
    }
  }, [filePath, rememberConvertToSupportedFormat, workingRef, hasAudio, hasVideo, askForHtml5ifySpeed, setWorking, withErrorHandling, html5ifyAndLoad, customOutDir]);

  const convertFormatBatch = useCallback(async () => {
    if (batchFiles.length === 0) return;

    const response = await askForHtml5ifySpeed({ allowedOptions: ['fast-audio-remux', 'fast-audio', 'fast', 'slow', 'slow-audio', 'slowest'] });
    if (response == null) return;
    const { selectedOption: speed } = response;

    if (workingRef.current) return;

    setWorking({ text: i18n.t('Batch converting to supported format') });
    setProgress(0);

    const filePaths = batchFiles.map((f) => f.path);

    const failedFiles: string[] = [];
    let i = 0;
    const setTotalProgress = (fileProgress = 0) => setProgress((i + fileProgress) / filePaths.length);

    try {
      await withErrorHandling(async () => {
        // eslint-disable-next-line no-restricted-syntax
        for (const path of filePaths) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const newCustomOutDir = await ensureWritableOutDir({ inputPath: path, outDir: customOutDir });

            // eslint-disable-next-line no-await-in-loop
            await html5ify({ customOutDir: newCustomOutDir, filePath: path, speed, hasAudio: true, hasVideo: true, onProgress: setTotalProgress });
          } catch (err2) {
            if (err2 instanceof DirectoryAccessDeclinedError) return;

            console.error('Failed to html5ify', path, err2);
            failedFiles.push(path);
          }

          i += 1;
          setTotalProgress();
        }

        if (failedFiles.length > 0) getSwal().toast.fire({ title: `${i18n.t('Failed to convert files:')} ${failedFiles.join(' ')}`, timer: undefined, showConfirmButton: true });
      }, i18n.t('Failed to batch convert to supported format'));
    } finally {
      setWorking(undefined);
      setProgress(undefined);
    }
  }, [askForHtml5ifySpeed, batchFiles, customOutDir, ensureWritableOutDir, html5ify, setProgress, setWorking, withErrorHandling, workingRef]);

  const getConvertToSupportedFormat = useCallback((fallback: Html5ifyMode) => rememberConvertToSupportedFormat || fallback, [rememberConvertToSupportedFormat]);

  const html5ifyAndLoadWithPreferences = useCallback(async (cod: string | undefined, fp: string, speed: Html5ifyMode, hv: boolean, ha: boolean) => {
    if (!enableAutoHtml5ify) return;
    setWorking({ text: i18n.t('Converting to supported format') });
    await html5ifyAndLoad(cod, fp, getConvertToSupportedFormat(speed), hv, ha);
  }, [enableAutoHtml5ify, setWorking, html5ifyAndLoad, getConvertToSupportedFormat]);

  return { previewFilePath, setPreviewFilePath, usingDummyVideo, setUsingDummyVideo, userHtml5ifyCurrentFile, convertFormatBatch, html5ifyAndLoadWithPreferences };
}
