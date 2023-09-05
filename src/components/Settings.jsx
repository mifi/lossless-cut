import React, { memo, useCallback, useMemo, useState } from 'react';
import { FaYinYang, FaKeyboard } from 'react-icons/fa';
import { GlobeIcon, CleanIcon, CogIcon, Button, NumericalIcon, FolderCloseIcon, DocumentIcon, TimeIcon } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import CaptureFormatButton from './CaptureFormatButton';
import AutoExportToggler from './AutoExportToggler';
import Switch from './Switch';
import useUserSettings from '../hooks/useUserSettings';
import { askForFfPath } from '../dialogs';
import { isMasBuild, isStoreBuild } from '../util';
import { langNames } from '../util/constants';
import styles from './Settings.module.css';
import Select from './Select';

import { getModifierKeyNames } from '../hooks/useTimelineScroll';


const Row = (props) => (
  <motion.tr
    // eslint-disable-next-line react/jsx-props-no-spreading
    {...props}
    transition={{ duration: 0.5, ease: 'easeIn' }}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  />
);
// eslint-disable-next-line react/jsx-props-no-spreading
const KeyCell = (props) => <td {...props} />;

const Header = ({ title }) => (
  <Row className={styles.header}>
    <th>{title}</th>
    <th />
  </Row>
);

const detailsStyle = { opacity: 0.75, fontSize: '.9em', marginTop: '.3em' };

const Settings = memo(({
  onTunerRequested,
  onKeyboardShortcutsDialogRequested,
  askForCleanupChoices,
  toggleStoreProjectInWorkingDir,
  simpleMode,
}) => {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(!simpleMode);

  const { customOutDir, changeOutDir, keyframeCut, toggleKeyframeCut, timecodeFormat, setTimecodeFormat, invertCutSegments, setInvertCutSegments, askBeforeClose, setAskBeforeClose, enableAskForImportChapters, setEnableAskForImportChapters, enableAskForFileOpenAction, setEnableAskForFileOpenAction, autoSaveProjectFile, setAutoSaveProjectFile, invertTimelineScroll, setInvertTimelineScroll, language, setLanguage, ffmpegExperimental, setFfmpegExperimental, hideNotifications, setHideNotifications, autoLoadTimecode, setAutoLoadTimecode, enableAutoHtml5ify, setEnableAutoHtml5ify, customFfPath, setCustomFfPath, storeProjectInWorkingDir, mouseWheelZoomModifierKey, setMouseWheelZoomModifierKey, captureFrameMethod, setCaptureFrameMethod, captureFrameQuality, setCaptureFrameQuality, captureFrameFileNameFormat, setCaptureFrameFileNameFormat, enableNativeHevc, setEnableNativeHevc, enableUpdateCheck, setEnableUpdateCheck, allowMultipleInstances, setAllowMultipleInstances, preferStrongColors, setPreferStrongColors, treatInputFileModifiedTimeAsStart, setTreatInputFileModifiedTimeAsStart, treatOutputFileModifiedTimeAsStart, setTreatOutputFileModifiedTimeAsStart } = useUserSettings();

  const onLangChange = useCallback((e) => {
    const { value } = e.target;
    const l = value !== '' ? value : undefined;
    setLanguage(l);
  }, [setLanguage]);

  const timecodeFormatOptions = useMemo(() => ({
    frameCount: t('Frame counts'),
    timecodeWithDecimalFraction: t('Millisecond fractions'),
    timecodeWithFramesFraction: t('Frame fractions'),
  }), [t]);

  const onTimecodeFormatClick = useCallback(() => {
    const keys = Object.keys(timecodeFormatOptions);
    let index = keys.indexOf(timecodeFormat);
    if (index === -1 || index >= keys.length - 1) index = 0;
    else index += 1;
    setTimecodeFormat(keys[index]);
  }, [setTimecodeFormat, timecodeFormat, timecodeFormatOptions]);

  const changeCustomFfPath = useCallback(async () => {
    const newCustomFfPath = await askForFfPath(customFfPath);
    setCustomFfPath(newCustomFfPath);
  }, [customFfPath, setCustomFfPath]);

  return (
    <>
      <div style={{ margin: '0 2em' }}>
        <div>{t('Hover mouse over buttons in the main interface to see which function they have')}</div>
      </div>

      <table style={{ marginTop: 20 }} className={styles.settings}>
        <thead>
          <tr className={styles.header}>
            <th>{t('Settings')}</th>
            <th style={{ width: 300 }}>{t('Current setting')}</th>
          </tr>
        </thead>

        <tbody>
          <Row>
            <KeyCell>{t('Show advanced settings')}</KeyCell>
            <td>
              <Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
            </td>
          </Row>

          <Row>
            <KeyCell><GlobeIcon style={{ verticalAlign: 'middle', marginRight: '.5em' }} /> App language</KeyCell>
            <td>
              <Select value={language || ''} onChange={onLangChange} style={{ fontSize: '1.2em' }}>
                <option key="" value="">{t('System language')}</option>
                {Object.keys(langNames).map((lang) => <option key={lang} value={lang}>{langNames[lang]}</option>)}
              </Select>
            </td>
          </Row>

          {showAdvanced && (
            <Row>
              <KeyCell>
                {t('Auto save project file?')}<br />
              </KeyCell>
              <td>
                <Switch checked={autoSaveProjectFile} onCheckedChange={setAutoSaveProjectFile} />
              </td>
            </Row>
          )}

          {showAdvanced && (
            <Row>
              <KeyCell>{t('Store project file (.llc) in the working directory or next to loaded media file?')}</KeyCell>
              <td>
                <Button iconBefore={storeProjectInWorkingDir ? FolderCloseIcon : DocumentIcon} disabled={!autoSaveProjectFile} onClick={toggleStoreProjectInWorkingDir}>
                  {storeProjectInWorkingDir ? t('Store in working directory') : t('Store next to media file')}
                </Button>
              </td>
            </Row>
          )}

          {showAdvanced && !isMasBuild && (
            <Row>
              <KeyCell>
                {t('Custom FFmpeg directory (experimental)')}<br />
                <div style={detailsStyle}>
                  {t('This allows you to specify custom FFmpeg and FFprobe binaries to use. Make sure the "ffmpeg" and "ffprobe" executables exist in the same directory, and then select the directory.')}
                </div>
              </KeyCell>
              <td>
                <Button iconBefore={CogIcon} onClick={changeCustomFfPath}>
                  {customFfPath ? t('Using external ffmpeg') : t('Using built-in ffmpeg')}
                </Button>
                <div>{customFfPath}</div>
              </td>
            </Row>
          )}

          {showAdvanced && !isStoreBuild && (
            <Row>
              <KeyCell>{t('Check for updates on startup?')}</KeyCell>
              <td>
                <Switch checked={enableUpdateCheck} onCheckedChange={setEnableUpdateCheck} />
              </td>
            </Row>
          )}

          {showAdvanced && (
            <Row>
              <KeyCell>{t('Allow multiple instances of LosslessCut to run concurrently? (experimental)')}</KeyCell>
              <td>
                <Switch checked={allowMultipleInstances} onCheckedChange={setAllowMultipleInstances} />
              </td>
            </Row>
          )}


          <Header title={t('Options affecting exported files')} />

          <Row>
            <KeyCell>
              {t('Choose cutting mode: Remove or keep selected segments from video when exporting?')}<br />
              <div style={detailsStyle}>
                <b>{t('Keep')}</b>: {t('The video inside segments will be kept, while the video outside will be discarded.')}<br />
                <b>{t('Remove')}</b>: {t('The video inside segments will be discarded, while the video surrounding them will be kept.')}
              </div>
            </KeyCell>
            <td>
              <Button iconBefore={FaYinYang} appearance={invertCutSegments ? 'default' : 'primary'} intent="success" onClick={() => setInvertCutSegments((v) => !v)}>
                {invertCutSegments ? t('Remove') : t('Keep')}
              </Button>
            </td>
          </Row>

          <Row>
            <KeyCell>
              {t('Working directory')}<br />
              <div style={detailsStyle}>
                {t('This is where working files and exported files are stored.')}
              </div>
            </KeyCell>
            <td>
              <Button iconBefore={customOutDir ? FolderCloseIcon : DocumentIcon} onClick={changeOutDir}>
                {customOutDir ? t('Custom working directory') : t('Same directory as input file')}...
              </Button>
              <div>{customOutDir}</div>
            </td>
          </Row>

          {showAdvanced && (
            <Row>
              <KeyCell>{t('Set file modification date/time of output files to:')}</KeyCell>
              <td>
                <Select value={treatOutputFileModifiedTimeAsStart ?? 'disabled'} onChange={(e) => setTreatOutputFileModifiedTimeAsStart(e.target.value === 'disabled' ? null : (e.target.value === 'true'))}>
                  <option value="disabled">{t('Current time')}</option>
                  <option value="true">{t('Source file\'s time plus segment start cut time')}</option>
                  <option value="false">{t('Source file\'s time minus segment end cut time')}</option>
                </Select>
              </td>
            </Row>
          )}

          {showAdvanced && (
            <Row>
              <KeyCell>{t('Treat source file modification date/time as:')}</KeyCell>
              <td>
                <Select disabled={treatOutputFileModifiedTimeAsStart == null} value={treatInputFileModifiedTimeAsStart} onChange={(e) => setTreatInputFileModifiedTimeAsStart((e.target.value === 'true'))}>
                  <option value="true">{t('Start of video')}</option>
                  <option value="false">{t('End of video')}</option>
                </Select>
              </td>
            </Row>
          )}

          <Row>
            <KeyCell>
              {t('Keyframe cut mode')}<br />
              <div style={detailsStyle}>
                {keyframeCut ? (
                  <>
                    {t('Cut at the nearest keyframe (not accurate time.) Equiv to')}:<br />
                    <code className="highlighted">ffmpeg -ss -i ...</code>
                  </>
                ) : (
                  <>
                    {t('Accurate time but could leave an empty portion at the beginning of the video. Equiv to')}:<br />
                    <code className="highlighted">ffmpeg -i -ss ...</code>
                  </>
                )}
              </div>
            </KeyCell>
            <td>
              <Switch checked={keyframeCut} onCheckedChange={() => toggleKeyframeCut()} />
            </td>
          </Row>

          <Row>
            <KeyCell>{t('Cleanup files after export?')}</KeyCell>
            <td>
              <Button iconBefore={<CleanIcon />} onClick={askForCleanupChoices}>{t('Change preferences')}</Button>
            </td>
          </Row>

          {showAdvanced && (
            <Row>
              <KeyCell>{t('Enable experimental ffmpeg features flag?')}</KeyCell>
              <td>
                <Switch checked={ffmpegExperimental} onCheckedChange={setFfmpegExperimental} />
              </td>
            </Row>
          )}

          {showAdvanced && (
            <Row>
              <KeyCell>
                {t('Extract unprocessable tracks to separate files or discard them?')}<br />
                <div style={detailsStyle}>
                  {t('(data tracks such as GoPro GPS, telemetry etc. are not copied over by default because ffmpeg cannot cut them, thus they will cause the media duration to stay the same after cutting video/audio)')}
                </div>
              </KeyCell>
              <td>
                <AutoExportToggler />
              </td>
            </Row>
          )}


          <Header title={t('Snapshots and frame extraction')} />

          <Row>
            <KeyCell>
              {t('Snapshot capture format')}
            </KeyCell>
            <td>
              <CaptureFormatButton showIcon />
            </td>
          </Row>

          <Row>
            <KeyCell>
              {t('Snapshot capture method')}
              <div style={detailsStyle}>{t('FFmpeg capture method might sometimes capture more correct colors, but the captured snapshot might be off by one or more frames, relative to the preview.')}</div>
            </KeyCell>
            <td>
              <Button onClick={() => setCaptureFrameMethod((existing) => (existing === 'ffmpeg' ? 'videotag' : 'ffmpeg'))}>
                {captureFrameMethod === 'ffmpeg' ? t('FFmpeg') : t('HTML video tag')}
              </Button>
            </td>
          </Row>

          <Row>
            <KeyCell>{t('Snapshot capture quality')}</KeyCell>
            <td>
              <input type="range" min={1} max={1000} style={{ width: 200 }} value={Math.round(captureFrameQuality * 1000)} onChange={(e) => setCaptureFrameQuality(Math.max(Math.min(1, parseInt(e.target.value, 10) / 1000)), 0)} /><br />
              {Math.round(captureFrameQuality * 100)}%
            </td>
          </Row>

          <Row>
            <KeyCell>{t('File names of extracted video frames')}</KeyCell>
            <td>
              <Button iconBefore={captureFrameFileNameFormat === 'timestamp' ? TimeIcon : NumericalIcon} onClick={() => setCaptureFrameFileNameFormat((existing) => (existing === 'timestamp' ? 'index' : 'timestamp'))}>
                {captureFrameFileNameFormat === 'timestamp' ? t('Frame timestamp') : t('Frame number')}
              </Button>
            </td>
          </Row>


          <Header title={t('Keyboard, mouse and input')} />

          <Row>
            <KeyCell>{t('Keyboard & mouse shortcuts')}</KeyCell>
            <td>
              <Button iconBefore={<FaKeyboard />} onClick={onKeyboardShortcutsDialogRequested}>{t('Keyboard & mouse shortcuts')}</Button>
            </td>
          </Row>

          <Row>
            <KeyCell>{t('Mouse wheel zoom modifier key')}</KeyCell>
            <td>
              <Select value={mouseWheelZoomModifierKey} onChange={(e) => setMouseWheelZoomModifierKey(e.target.value)}>
                {Object.entries(getModifierKeyNames()).map(([key, value]) => (
                  <option key={key} value={key}>{value}</option>
                ))}
              </Select>
            </td>
          </Row>

          <Row>
            <KeyCell>{t('Timeline trackpad/wheel sensitivity')}</KeyCell>
            <td>
              <Button iconBefore={CogIcon} onClick={() => onTunerRequested('wheelSensitivity')}>{t('Change value')}</Button>
            </td>
          </Row>

          <Row>
            <KeyCell>{t('Timeline keyboard seek speed')}</KeyCell>
            <td>
              <Button iconBefore={CogIcon} onClick={() => onTunerRequested('keyboardNormalSeekSpeed')}>{t('Change value')}</Button>
            </td>
          </Row>

          <Row>
            <KeyCell>{t('Timeline keyboard seek acceleration')}</KeyCell>
            <td>
              <Button iconBefore={CogIcon} onClick={() => onTunerRequested('keyboardSeekAccFactor')}>{t('Change value')}</Button>
            </td>
          </Row>

          <Row>
            <KeyCell>{t('Invert timeline trackpad/wheel direction?')}</KeyCell>
            <td>
              <Switch checked={invertTimelineScroll} onCheckedChange={setInvertTimelineScroll} />
            </td>
          </Row>

          <Header title={t('User interface')} />

          {showAdvanced && (
            <Row>
              <KeyCell>{t('Auto load timecode from file as an offset in the timeline?')}</KeyCell>
              <td>
                <Switch checked={autoLoadTimecode} onCheckedChange={setAutoLoadTimecode} />
              </td>
            </Row>
          )}

          {showAdvanced && (
            <Row>
              <KeyCell>{t('Enable HEVC / H265 hardware decoding (you may need to turn this off if you have problems with HEVC files)')}</KeyCell>
              <td>
                <Switch checked={enableNativeHevc} onCheckedChange={setEnableNativeHevc} />
              </td>
            </Row>
          )}


          {showAdvanced && (
            <Row>
              <KeyCell>{t('Try to automatically convert to supported format when opening unsupported file?')}</KeyCell>
              <td>
                <Switch checked={enableAutoHtml5ify} onCheckedChange={setEnableAutoHtml5ify} />
              </td>
            </Row>
          )}

          <Row>
            <KeyCell>{t('In timecode show')}</KeyCell>
            <td>
              <Button iconBefore={timecodeFormat === 'frameCount' ? NumericalIcon : TimeIcon} onClick={onTimecodeFormatClick}>
                {timecodeFormatOptions[timecodeFormat]}
              </Button>
            </td>
          </Row>

          <Row>
            <KeyCell>{t('Prefer strong colors')}</KeyCell>
            <td>
              <Switch checked={preferStrongColors} onCheckedChange={setPreferStrongColors} />
            </td>
          </Row>

          <Header title={t('Prompts and dialogs')} />

          <Row>
            <KeyCell>{t('Show informational notifications')}</KeyCell>
            <td>
              <Switch checked={!hideNotifications} onCheckedChange={(v) => setHideNotifications(v ? undefined : 'all')} />
            </td>
          </Row>

          <Row>
            <KeyCell>{t('Ask about what to do when opening a new file when another file is already already open?')}</KeyCell>
            <td>
              <Switch checked={enableAskForFileOpenAction} onCheckedChange={setEnableAskForFileOpenAction} />
            </td>
          </Row>

          <Row>
            <KeyCell>{t('Ask for confirmation when closing app or file?')}</KeyCell>
            <td>
              <Switch checked={askBeforeClose} onCheckedChange={setAskBeforeClose} />
            </td>
          </Row>

          <Row>
            <KeyCell>{t('Ask about importing chapters from opened file?')}</KeyCell>
            <td>
              <Switch checked={enableAskForImportChapters} onCheckedChange={setEnableAskForImportChapters} />
            </td>
          </Row>
        </tbody>
      </table>
    </>
  );
});

export default Settings;
