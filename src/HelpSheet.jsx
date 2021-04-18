import React, { memo } from 'react';
import { FaHandPointRight, FaHandPointLeft, FaStepBackward, FaStepForward } from 'react-icons/fa';
import { useTranslation, Trans } from 'react-i18next';

import SetCutpointButton from './components/SetCutpointButton';
import CopyClipboardButton from './components/CopyClipboardButton';
import { primaryTextColor } from './colors';
import Sheet from './Sheet';

const electron = window.require('electron');

const { githubLink } = electron.remote.require('./constants');

const HelpSheet = memo(({ visible, onTogglePress, ffmpegCommandLog, currentCutSeg }) => {
  const { t } = useTranslation();

  return (
    <Sheet visible={visible} onClosePress={onTogglePress} style={{ background: '#6b6b6b', color: 'white' }}>
      <div className="help-sheet">
        <p><Trans><b>Note:</b> Keyframe cut and Merge cuts buttons have been moved to the export panel (press Export to see it.)</Trans></p>
        <h1>{t('Common problems')}</h1>
        <p>
          {t('Lossless cutting is not an exact science. For some codecs and files it just works. For others you may need to trial and error depending on the codec, keyframes etc to get the best cut.')}
        </p>
        <ol>
          <li><Trans>Try both <b>Normal cut</b> and <b>Keyframe cut</b></Trans></li>
          <li><Trans>Try to set the <b>start-</b>cutpoint a <b>few frames before or after</b> the nearest keyframe (may also solve audio sync issues)</Trans></li>
          <li><Trans>Disable unnecessary <b>Tracks</b></Trans></li>
          <li><Trans>Select a different output <b>Format</b> (<b>matroska</b> and <b>mp4</b> support most codecs)</Trans></li>
          <li><Trans>Try to enable the <b>Experimental Flag</b> in Settings</Trans></li>
        </ol>

        <p style={{ fontWeight: 'bold' }}>
          {t('For more help and issues, please go to:')}<br />
          <span style={{ color: primaryTextColor, cursor: 'pointer' }} role="button" onClick={() => electron.shell.openExternal(githubLink)}>{githubLink}</span>
        </p>

        <h1>{t('Keyboard & mouse shortcuts')}</h1>

        <div><kbd>H</kbd> {t('Show/hide help screen')}</div>

        <h2>{t('Playback')}</h2>

        <div><kbd>SPACE</kbd>, <kbd>k</kbd> {t('Play/pause')}</div>
        <div><kbd>J</kbd> {t('Slow down playback')}</div>
        <div><kbd>L</kbd> {t('Speed up playback')}</div>
        <div><kbd>SHIFT</kbd> + <kbd>J</kbd> {t('Slow down playback by a multiplier')}</div>
        <div><kbd>SHIFT</kbd> + <kbd>L</kbd> {t('Speed up playback by a multiplier')}</div>

        <h2>{t('Seeking')}</h2>

        <div><kbd>,</kbd> {t('Step backward 1 frame')}</div>
        <div><kbd>.</kbd> {t('Step forward 1 frame')}</div>
        <div><kbd>ALT</kbd> / <kbd>OPT</kbd> + <kbd>←</kbd> {t('Seek to previous keyframe')}</div>
        <div><kbd>ALT</kbd> / <kbd>OPT</kbd> + <kbd>→</kbd> {t('Seek to next keyframe')}</div>
        <div><kbd>←</kbd> {t('Seek backward 1 sec')}</div>
        <div><kbd>→</kbd> {t('Seek forward 1 sec')}</div>
        <div><kbd>CTRL</kbd> / <kbd>CMD</kbd> + <kbd>←</kbd> {t('Seek backward 1% of timeline at current zoom')}</div>
        <div><kbd>CTRL</kbd> / <kbd>CMD</kbd> + <kbd>→</kbd> {t('Seek forward 1% of timeline at current zoom')}</div>
        <div style={{ lineHeight: 1.7 }}><SetCutpointButton currentCutSeg={currentCutSeg} side="start" Icon={FaStepBackward} style={{ verticalAlign: 'middle' }} />, <kbd>SHIFT</kbd> + <kbd>←</kbd> {t('Jump to cut start')}</div>
        <div style={{ lineHeight: 1.7 }}><SetCutpointButton currentCutSeg={currentCutSeg} side="end" Icon={FaStepForward} style={{ verticalAlign: 'middle' }} />, <kbd>SHIFT</kbd> + <kbd>→</kbd> {t('Jump to cut end')}</div>

        <h2>{t('Segments and cut points')}</h2>

        <div style={{ lineHeight: 1.7 }}><SetCutpointButton currentCutSeg={currentCutSeg} side="start" Icon={FaHandPointLeft} style={{ verticalAlign: 'middle' }} />, <kbd>I</kbd> {t('Mark in / cut start point for current segment')}</div>
        <div style={{ lineHeight: 1.7 }}><SetCutpointButton currentCutSeg={currentCutSeg} side="end" Icon={FaHandPointRight} style={{ verticalAlign: 'middle' }} />, <kbd>O</kbd> {t('Mark out / cut end point for current segment')}</div>
        <div><kbd>+</kbd> {t('Add cut segment')}</div>
        <div><kbd>BACKSPACE</kbd> {t('Remove current segment')}</div>
        <div><kbd>ENTER</kbd> {t('Label current segment')}</div>
        <div><kbd>↑</kbd> {t('Select previous segment')}</div>
        <div><kbd>↓</kbd> {t('Select next segment')}</div>
        <div><kbd>B</kbd> {t('Split segment at cursor')}</div>

        <h2>{t('Timeline/zoom operations')}</h2>
        <div><kbd>Z</kbd> {t('Toggle zoom between 1x and a calculated comfortable zoom level')}</div>
        <div><kbd>CTRL</kbd> / <kbd>CMD</kbd> + <kbd>↑</kbd> {t('Zoom in timeline')}</div>
        <div><kbd>CTRL</kbd> / <kbd>CMD</kbd> + <kbd>↓</kbd> {t('Zoom out timeline')}</div>
        <div><kbd>CTRL</kbd> <i>+ {t('Mouse scroll/wheel up/down')}</i> - {t('Zoom in/out timeline')}</div>
        <div><i>{t('Mouse scroll/wheel left/right')}</i> - {t('Pan timeline')}</div>

        <h2>{t('Other operations')}</h2>
        <div><kbd>R</kbd> {t('Change rotation')}</div>

        <h2>{t('Output actions')}</h2>
        <div><kbd>E</kbd> {t('Export segment(s)')}</div>
        <div><kbd>C</kbd> {t('Capture snapshot')}</div>
        <div><kbd>D</kbd> {t('Delete source file')}</div>

        <p style={{ fontWeight: 'bold' }}>{t('Hover mouse over buttons in the main interface to see which function they have')}</p>

        <h1 style={{ marginTop: 40 }}>{t('Last ffmpeg commands')}</h1>
        {ffmpegCommandLog.length > 0 ? (
          <div style={{ overflowY: 'scroll', height: 200 }}>
            {ffmpegCommandLog.reverse().map(({ command }, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} style={{ whiteSpace: 'pre', margin: '5px 0' }}>
                <CopyClipboardButton text={command} /> {command}
              </div>
            ))}
          </div>
        ) : (
          <p>{t('The last executed ffmpeg commands will show up here after you run operations. You can copy them to clipboard and modify them to your needs before running on your command line.')}</p>
        )}
      </div>
    </Sheet>
  );
});

export default HelpSheet;
