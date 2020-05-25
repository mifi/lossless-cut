import React, { memo } from 'react';
import { IoIosCloseCircleOutline } from 'react-icons/io';
import { FaClipboard, FaHandPointRight, FaHandPointLeft, FaStepBackward, FaStepForward } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import SetCutpointButton from './SetCutpointButton';
import { toast } from './util';
import { primaryTextColor } from './colors';

const electron = window.require('electron');
const { clipboard } = electron;

const { githubLink } = electron.remote.require('./constants');

const HelpSheet = memo(({
  visible, onTogglePress, ffmpegCommandLog, currentCutSeg,
}) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="help-sheet"
        >
          <IoIosCloseCircleOutline role="button" onClick={onTogglePress} size={30} style={{ position: 'fixed', right: 0, top: 0, padding: 20 }} />

          <h1>{t('Common problems')}</h1>
          <p>
            {t('Lossless cutting is not an exact science. For some codecs and files it just works. For others you may need to trial and error depending on the codec, keyframes etc to get the best cut.')}
          </p>
          <ol>
            <li>Try both <b>Keyframe cut</b> and <b>Normal cut</b> modes</li>
            <li>Try to set the <b>start-</b>cutpoint a <b>few frames before or after</b> the nearest keyframe (may also solve audio sync issues)</li>
            <li>Try to disable some <b>Tracks</b></li>
            <li>Try a different <b>Output format</b></li>
            <li>Try to enable the <b>Experimental Flag</b> in Settings</li>
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
          <div><kbd>↑</kbd> {t('Select previous segment')}</div>
          <div><kbd>↓</kbd> {t('Select next segment')}</div>

          <h2>{t('Timeline/zoom operations')}</h2>
          <div><kbd>Z</kbd> {t('Toggle zoom between 1x and a calculated comfortable zoom level')}</div>
          <div><kbd>CTRL</kbd> / <kbd>CMD</kbd> + <kbd>↑</kbd> {t('Zoom in timeline')}</div>
          <div><kbd>CTRL</kbd> / <kbd>CMD</kbd> + <kbd>↓</kbd> {t('Zoom out timeline')}</div>
          <div><kbd>CTRL</kbd> <i>+ {t('Mouse scroll/wheel up/down')}</i> - {t('Zoom in/out timeline')}</div>
          <div><i>{t('Mouse scroll/wheel left/right')}</i> - {t('Pan timeline')}</div>

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
                  <FaClipboard style={{ cursor: 'pointer' }} title={t('Copy to clipboard')} onClick={() => { clipboard.writeText(command); toast.fire({ timer: 2000, icon: 'success', title: t('Copied to clipboard') }); }} /> {command}
                </div>
              ))}
            </div>
          ) : (
            <p>{t('The last executed ffmpeg commands will show up here after you run operations. You can copy them to clipboard and modify them to your needs before running on your command line.')}</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default HelpSheet;
