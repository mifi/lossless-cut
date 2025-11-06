import { CSSProperties, ChangeEventHandler, TdHTMLAttributes, memo, useCallback, useMemo, useState } from 'react';
import { FaYinYang, FaKeyboard, FaGlobe, FaBroom, FaCogs, FaHashtag, FaClock, FaFolder, FaFile, FaTimes } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import invariant from 'tiny-invariant';

import Row from './AnimatedTr';
import CaptureFormatButton from './CaptureFormatButton';
import AutoExportToggler from './AutoExportToggler';
import Switch from './Switch';
import useUserSettings from '../hooks/useUserSettings';
import { askForFfPath } from '../dialogs';
import { isMasBuild, isStoreBuild } from '../util';
import { Config, LanguageKey, ModifierKey, TimecodeFormat, langNames } from '../../../../types';
import styles from './Settings.module.css';
import SelectRaw, { SelectProps } from './Select';
import ButtonRaw, { ButtonProps } from './Button';
import { getModifierKeyNames } from '../hooks/useTimelineScroll';
import { TunerType } from '../types';
import Truncated from './Truncated';
import { primaryColor } from '../colors';

// eslint-disable-next-line react/jsx-props-no-spreading
const Button = ({ style, ...props }: ButtonProps) => <ButtonRaw style={{ padding: '.5em .9em', ...style }} {...props} />;

// eslint-disable-next-line react/jsx-props-no-spreading
const Select = ({ style, ...props }: SelectProps) => <SelectRaw style={{ padding: '.5em 1.9em .5em .9em', ...style }} {...props} />;


// eslint-disable-next-line react/jsx-props-no-spreading
const KeyCell = (props: TdHTMLAttributes<HTMLTableCellElement>) => <td {...props} />;

const Header = ({ title }: { title: string }) => (
  <Row className={styles['header']}>
    <th>{title}</th>
    <th />
  </Row>
);

function ModifierKeySetting({ text, value, setValue }: { text: string, value: ModifierKey, setValue: (v: ModifierKey) => void }) {
  return (
    <Row>
      <KeyCell>{text}</KeyCell>
      <td>
        <Select value={value} onChange={(e) => setValue(e.target.value as ModifierKey)}>
          {Object.entries(getModifierKeyNames()).map(([key, name]) => (
            <option key={key} value={key}>{name}</option>
          ))}
        </Select>
      </td>
    </Row>
  );
}
const detailsStyle: CSSProperties = { opacity: 0.75, fontSize: '.9em', marginTop: '.3em' };

function Settings({
  onTunerRequested,
  onKeyboardShortcutsDialogRequested,
  askForCleanupChoices,
  toggleStoreProjectInWorkingDir,
  clearOutDir,
}: {
  onTunerRequested: (type: TunerType) => void,
  onKeyboardShortcutsDialogRequested: () => void,
  askForCleanupChoices: () => Promise<unknown>,
  toggleStoreProjectInWorkingDir: () => Promise<void>,
  clearOutDir: () => Promise<void>,
}) {
  const { t } = useTranslation();

  const { customOutDir, changeOutDir, keyframeCut, toggleKeyframeCut, timecodeFormat, setTimecodeFormat, invertCutSegments, setInvertCutSegments, askBeforeClose, setAskBeforeClose, enableAskForImportChapters, setEnableAskForImportChapters, enableAskForFileOpenAction, setEnableAskForFileOpenAction, autoSaveProjectFile, setAutoSaveProjectFile, invertTimelineScroll, setInvertTimelineScroll, language, setLanguage, hideNotifications, setHideNotifications, hideOsNotifications, setHideOsNotifications, autoLoadTimecode, setAutoLoadTimecode, enableAutoHtml5ify, setEnableAutoHtml5ify, customFfPath, setCustomFfPath, storeProjectInWorkingDir, mouseWheelZoomModifierKey, setMouseWheelZoomModifierKey, mouseWheelFrameSeekModifierKey, setMouseWheelFrameSeekModifierKey, mouseWheelKeyframeSeekModifierKey, setMouseWheelKeyframeSeekModifierKey, segmentMouseModifierKey, setSegmentMouseModifierKey, captureFrameMethod, setCaptureFrameMethod, captureFrameQuality, setCaptureFrameQuality, captureFrameFileNameFormat, setCaptureFrameFileNameFormat, enableNativeHevc, setEnableNativeHevc, enableUpdateCheck, setEnableUpdateCheck, allowMultipleInstances, setAllowMultipleInstances, preferStrongColors, setPreferStrongColors, treatInputFileModifiedTimeAsStart, setTreatInputFileModifiedTimeAsStart, treatOutputFileModifiedTimeAsStart, setTreatOutputFileModifiedTimeAsStart, exportConfirmEnabled, toggleExportConfirmEnabled, storeWindowBounds, setStoreWindowBounds, reducedMotion, setReducedMotion, simpleMode } = useUserSettings();

  const [showAdvanced, setShowAdvanced] = useState(!simpleMode);

  const onLangChange = useCallback<ChangeEventHandler<HTMLSelectElement>>((e) => {
    const { value } = e.target;
    const l = value !== '' ? value : undefined;
    setLanguage(l as LanguageKey | undefined);
  }, [setLanguage]);

  const timecodeFormatOptions = useMemo<Record<TimecodeFormat, string>>(() => ({
    frameCount: t('Frame counts'),
    seconds: t('Total seconds'),
    timecodeWithDecimalFraction: t('Millisecond fractions'),
    timecodeWithFramesFraction: t('Frame fractions'),
  }), [t]);

  const onTimecodeFormatClick = useCallback(() => {
    const keys = Object.keys(timecodeFormatOptions) as TimecodeFormat[];
    let index = keys.indexOf(timecodeFormat);
    if (index === -1 || index >= keys.length - 1) index = 0;
    else index += 1;
    const newKey = keys[index];
    invariant(newKey != null);
    setTimecodeFormat(newKey);
  }, [setTimecodeFormat, timecodeFormat, timecodeFormatOptions]);

  const changeCustomFfPath = useCallback(async () => {
    const newCustomFfPath = await askForFfPath(customFfPath);
    if (newCustomFfPath == null) return;
    setCustomFfPath(newCustomFfPath);
  }, [customFfPath, setCustomFfPath]);

  const clearCustomFfPath = useCallback(() => {
    setCustomFfPath(undefined);
  }, [setCustomFfPath]);

  return (
    <table className={styles['settings']}>
      <thead>
        <tr className={styles['header']}>
          <th>{t('Setting')}</th>
          <th style={{ maxWidth: '15em' }}>{t('Current setting')}</th>
        </tr>
      </thead>

      <tbody>
        <Row>
          <KeyCell><FaGlobe style={{ verticalAlign: 'middle', fontSize: '1.2em', marginRight: '.3em' }} /> App language</KeyCell>
          <td>
            <Select value={language || ''} onChange={onLangChange} style={{ fontSize: '1em' }}>
              <option key="" value="">{t('System language')}</option>
              {Object.keys(langNames).map((lang) => <option key={lang} value={lang}>{langNames[lang as keyof typeof langNames]}</option>)}
            </Select>
          </td>
        </Row>

        <Row>
          <KeyCell>
            {t('Show advanced settings')}
            <div style={detailsStyle}>
              {!showAdvanced && t('Advanced settings are currently not visible.')}
            </div>
          </KeyCell>
          <td>
            <Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
          </td>
        </Row>

        <Row>
          <KeyCell>
            {t('Show export options screen before exporting?')}
            <div style={detailsStyle}>
              {t('This gives you an overview of the export and allows you to customise more parameters before exporting, like changing the output file name.')}
            </div>
          </KeyCell>
          <td>
            <Switch checked={exportConfirmEnabled} onCheckedChange={toggleExportConfirmEnabled} />
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
              <Button disabled={!autoSaveProjectFile} onClick={toggleStoreProjectInWorkingDir}>
                {storeProjectInWorkingDir ? <FaFolder style={{ verticalAlign: 'middle', fontSize: '1.1em', marginRight: '.3em' }} /> : <FaFile style={{ verticalAlign: 'middle', fontSize: '1.1em', marginRight: '.3em' }} />}
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
              <Truncated maxWidth="15em">{customFfPath}</Truncated>
              <Button onClick={changeCustomFfPath}>
                <FaCogs style={{ verticalAlign: 'middle', marginRight: '.4em' }} />{customFfPath ? t('Using external ffmpeg') : t('Using built-in ffmpeg')}
              </Button>
              {customFfPath && (
                <Button onClick={clearCustomFfPath} title={t('Clear')}>
                  <FaTimes />
                </Button>
              )}
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
              {invertCutSegments ? (
                <><b>{t('Remove')}</b>: {t('The video inside segments will be discarded, while the video surrounding them will be kept.')}</>
              ) : (
                <><b>{t('Keep')}</b>: {t('The video inside segments will be kept, while the video outside will be discarded.')}</>
              )}
            </div>
          </KeyCell>
          <td>
            <Button onClick={() => setInvertCutSegments((v) => !v)}>
              <FaYinYang style={{ verticalAlign: 'middle', marginRight: '.3em', color: invertCutSegments ? primaryColor : undefined }} /> {invertCutSegments ? t('Remove') : t('Keep')}
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
            <Truncated maxWidth="15em">{customOutDir}</Truncated>
            <Button onClick={changeOutDir}>
              {customOutDir ? <FaFolder style={{ marginRight: '.3em', verticalAlign: 'middle' }} /> : <FaFile style={{ marginRight: '.3em', verticalAlign: 'middle' }} />}
              {customOutDir ? t('Custom working directory') : t('Same directory as input file')}...
            </Button>
            {customOutDir && (
              <Button onClick={clearOutDir} title={t('Clear')}>
                <FaTimes />
              </Button>
            )}
          </td>
        </Row>

        {showAdvanced && (
          <Row>
            <KeyCell>{t('Set file modification date/time of output files to:')}</KeyCell>
            <td>
              <Select value={typeof treatOutputFileModifiedTimeAsStart === 'boolean' ? String(treatOutputFileModifiedTimeAsStart) : 'disabled'} onChange={(e) => setTreatOutputFileModifiedTimeAsStart(e.target.value === 'disabled' ? null : (e.target.value === 'true'))}>
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
              <Select disabled={treatOutputFileModifiedTimeAsStart == null} value={String(treatInputFileModifiedTimeAsStart)} onChange={(e) => setTreatInputFileModifiedTimeAsStart((e.target.value === 'true'))}>
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
                  <b>{t('Keyframe cut')}</b>: {t('Cut at the preceding keyframe (not accurate time.) Equiv to')}:<br />
                  <code className="highlighted">ffmpeg -ss N -i input.mp4</code>
                </>
              ) : (
                <>
                  <b>{t('Normal cut')}</b>: {t('Accurate time but could leave an empty portion at the beginning of the video. Equiv to')}:<br />
                  <code className="highlighted">ffmpeg -i input -ss N</code>
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
            <Button onClick={askForCleanupChoices}><FaBroom style={{ verticalAlign: 'middle', marginRight: '.3em' }} />{t('Change preferences')}</Button>
          </td>
        </Row>

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
            <CaptureFormatButton showIcon style={{ padding: '.5em 1em' }} />
          </td>
        </Row>

        {showAdvanced && (
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
        )}

        <Row>
          <KeyCell>{t('Snapshot capture quality')}</KeyCell>
          <td>
            <input type="range" min={1} max={1000} style={{ width: 200 }} value={Math.round(captureFrameQuality * 1000)} onChange={(e) => setCaptureFrameQuality(Math.max(Math.min(1, parseInt(e.target.value, 10) / 1000), 0))} /><br />
            {Math.round(captureFrameQuality * 100)}%
          </td>
        </Row>

        {showAdvanced && (
          <Row>
            <KeyCell>
              {t('File names of extracted video frames')}
              <div style={detailsStyle}>{t('Note that this only applies when extracting multiple frames. When "Frame number" is selected, frame numbers are relative to the start of the segment (starting from 1).')}</div>
            </KeyCell>
            <td>
              <Button onClick={() => setCaptureFrameFileNameFormat((existing) => (existing === 'timestamp' ? 'index' : 'timestamp'))}>
                {captureFrameFileNameFormat === 'timestamp' ? <FaClock style={{ verticalAlign: 'middle', marginRight: '.3em' }} /> : <FaHashtag style={{ verticalAlign: 'middle', marginRight: '.3em' }} />}
                {captureFrameFileNameFormat === 'timestamp' ? t('Frame timestamp') : t('Frame number')}
              </Button>
            </td>
          </Row>
        )}


        <Header title={t('Keyboard, mouse and input')} />

        <Row>
          <KeyCell>{t('Keyboard & mouse shortcuts')}</KeyCell>
          <td>
            <Button onClick={onKeyboardShortcutsDialogRequested}><FaKeyboard style={{ verticalAlign: 'middle', marginRight: '.3em' }} /> {t('Keyboard & mouse shortcuts')}</Button>
          </td>
        </Row>

        <ModifierKeySetting text={t('Segment manipulation mouse modifier key')} value={segmentMouseModifierKey} setValue={setSegmentMouseModifierKey} />
        <ModifierKeySetting text={t('Mouse wheel zoom modifier key')} value={mouseWheelZoomModifierKey} setValue={setMouseWheelZoomModifierKey} />
        <ModifierKeySetting text={t('Mouse wheel frame seek modifier key')} value={mouseWheelFrameSeekModifierKey} setValue={setMouseWheelFrameSeekModifierKey} />
        <ModifierKeySetting text={t('Mouse wheel keyframe seek modifier key')} value={mouseWheelKeyframeSeekModifierKey} setValue={setMouseWheelKeyframeSeekModifierKey} />

        <Row>
          <KeyCell>{t('Timeline trackpad/wheel sensitivity')}</KeyCell>
          <td>
            <Button onClick={() => onTunerRequested('wheelSensitivity')}><FaCogs style={{ verticalAlign: 'middle', marginRight: '.4em' }} />{t('Change value')}</Button>
          </td>
        </Row>

        <Row>
          <KeyCell>{t('Timeline keyboard seek interval')}</KeyCell>
          <td>
            <Button onClick={() => onTunerRequested('keyboardNormalSeekSpeed')}><FaCogs style={{ verticalAlign: 'middle', marginRight: '.4em' }} /> {t('Change value')}</Button>
          </td>
        </Row>

        <Row>
          <KeyCell>{t('Timeline keyboard seek interval (longer)')}</KeyCell>
          <td>
            <Button onClick={() => onTunerRequested('keyboardSeekSpeed2')}><FaCogs style={{ verticalAlign: 'middle', marginRight: '.4em' }} /> {t('Change value')}</Button>
          </td>
        </Row>

        <Row>
          <KeyCell>{t('Timeline keyboard seek interval (longest)')}</KeyCell>
          <td>
            <Button onClick={() => onTunerRequested('keyboardSeekSpeed3')}><FaCogs style={{ verticalAlign: 'middle', marginRight: '.4em' }} /> {t('Change value')}</Button>
          </td>
        </Row>

        <Row>
          <KeyCell>{t('Timeline keyboard seek acceleration')}</KeyCell>
          <td>
            <Button onClick={() => onTunerRequested('keyboardSeekAccFactor')}><FaCogs style={{ verticalAlign: 'middle', marginRight: '.4em' }} /> {t('Change value')}</Button>
          </td>
        </Row>

        <Row>
          <KeyCell>{t('Invert timeline trackpad/wheel direction?')}</KeyCell>
          <td>
            <Switch checked={invertTimelineScroll ?? false} onCheckedChange={setInvertTimelineScroll} />
          </td>
        </Row>


        <Header title={t('User interface')} />

        {showAdvanced && (
          <Row>
            <KeyCell>{t('Remember window size and position')}</KeyCell>
            <td>
              <Switch checked={storeWindowBounds} onCheckedChange={setStoreWindowBounds} />
            </td>
          </Row>
        )}

        {showAdvanced && (
          <Row>
            <KeyCell>{t('Waveform height')}</KeyCell>
            <td>
              <Button onClick={() => onTunerRequested('waveformHeight')}><FaCogs style={{ verticalAlign: 'middle', marginRight: '.4em' }} /> {t('Change value')}</Button>
            </td>
          </Row>
        )}

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
          <KeyCell>{t('Prefer strong colors')}</KeyCell>
          <td>
            <Switch checked={preferStrongColors} onCheckedChange={setPreferStrongColors} />
          </td>
        </Row>

        <Row>
          <KeyCell>{t('Reduce motion in user interface')}</KeyCell>
          <td>
            <Select value={reducedMotion} onChange={(e) => setReducedMotion(e.target.value as Config['reducedMotion'])}>
              {Object.entries({ user: t('System default'), always: t('Yes'), never: t('No') } satisfies Record<Config['reducedMotion'], string>).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
              ))}
            </Select>
          </td>
        </Row>

        <Row>
          <KeyCell>{t('In timecode show')}</KeyCell>
          <td>
            <Button onClick={onTimecodeFormatClick}>
              {timecodeFormat === 'frameCount'
                ? <FaHashtag style={{ verticalAlign: 'middle', marginRight: '.3em' }} />
                : <FaClock style={{ verticalAlign: 'middle', marginRight: '.3em' }} />}{timecodeFormatOptions[timecodeFormat]}
            </Button>
          </td>
        </Row>


        <Header title={t('Prompts and dialogs')} />

        <Row>
          <KeyCell>{t('Show notifications')}</KeyCell>
          <td>
            <Switch checked={!hideOsNotifications} onCheckedChange={(v) => setHideOsNotifications(v ? undefined : 'all')} />
          </td>
        </Row>

        <Row>
          <KeyCell>{t('Show informational in-app notifications')}</KeyCell>
          <td>
            <Switch checked={!hideNotifications} onCheckedChange={(v) => setHideNotifications(v ? undefined : 'all')} />
          </td>
        </Row>

        <Row>
          <KeyCell>{t('Ask for confirmation when closing app or file?')}</KeyCell>
          <td>
            <Switch checked={askBeforeClose} onCheckedChange={setAskBeforeClose} />
          </td>
        </Row>

        {showAdvanced && (
          <Row>
            <KeyCell>{t('Ask about what to do when opening a new file when another file is already already open?')}</KeyCell>
            <td>
              <Switch checked={enableAskForFileOpenAction} onCheckedChange={setEnableAskForFileOpenAction} />
            </td>
          </Row>
        )}

        {showAdvanced && (
          <Row>
            <KeyCell>{t('Ask about importing chapters from opened file?')}</KeyCell>
            <td>
              <Switch checked={enableAskForImportChapters} onCheckedChange={setEnableAskForImportChapters} />
            </td>
          </Row>
        )}
      </tbody>
    </table>
  );
}

export default memo(Settings);
