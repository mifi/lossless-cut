import React, { memo } from 'react';
import { IoIosCloseCircleOutline } from 'react-icons/io';
import { FaClipboard } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

import { toast } from './util';

const { clipboard } = window.require('electron');


const HelpSheet = memo(({
  visible, onTogglePress, ffmpegCommandLog,
}) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="help-sheet"
      >
        <IoIosCloseCircleOutline role="button" onClick={onTogglePress} size={30} style={{ position: 'fixed', right: 0, top: 0, padding: 20 }} />

        <h1>Keyboard shortcuts</h1>
        <div><kbd>H</kbd> Show/hide this screen</div>

        <h2>Playback</h2>
        <div><kbd>SPACE</kbd>, <kbd>k</kbd> Play/pause</div>
        <div><kbd>J</kbd> Slow down playback</div>
        <div><kbd>L</kbd> Speed up playback</div>

        <h2>Seeking</h2>
        <div><kbd>,</kbd> Step backward 1 frame</div>
        <div><kbd>.</kbd> Step forward 1 frame</div>
        <div><kbd>ALT</kbd> / <kbd>OPT</kbd> + <kbd>←</kbd> Seek to previous keyframe</div>
        <div><kbd>ALT</kbd> / <kbd>OPT</kbd> + <kbd>→</kbd> Seek to next keyframe</div>
        <div><kbd>←</kbd> Seek backward 1 sec</div>
        <div><kbd>→</kbd> Seek forward 1 sec</div>
        <div><kbd>CTRL</kbd> / <kbd>CMD</kbd> + <kbd>←</kbd> Seek backward 1% of timeline at current zoom</div>
        <div><kbd>CTRL</kbd> / <kbd>CMD</kbd> + <kbd>→</kbd> Seek forward 1% of timeline at current zoom</div>

        <h2>Timeline/zoom operations</h2>
        <div><kbd>Z</kbd> Toggle zoom between 1x and a calculated comfortable zoom level</div>
        <div><kbd>CTRL</kbd> / <kbd>CMD</kbd> + <kbd>↑</kbd> Zoom in timeline</div>
        <div><kbd>CTRL</kbd> / <kbd>CMD</kbd> + <kbd>↓</kbd> Zoom out timeline</div>
        <div><i>Mouse scroll up/down/left/right</i> - Pan timeline</div>
        <div><kbd>CTRL</kbd><i> + Mouse scroll up/down</i> - Zoom in/out timeline</div>

        <h2>Segments and cut points</h2>
        <div><kbd>I</kbd> Mark in / cut start point for current segment</div>
        <div><kbd>O</kbd> Mark out / cut end point for current segment</div>
        <div><kbd>+</kbd> Add cut segment</div>
        <div><kbd>BACKSPACE</kbd> Remove current segment</div>
        <div><kbd>↑</kbd> Select previous segment</div>
        <div><kbd>↓</kbd> Select next segment</div>

        <h2>File system actions</h2>
        <div><kbd>E</kbd> Export segment(s)</div>
        <div><kbd>C</kbd> Capture snapshot</div>
        <div><kbd>D</kbd> Delete source file</div>

        <p style={{ fontWeight: 'bold' }}>Hover mouse over buttons in the main interface to see which function they have.</p>

        <h1 style={{ marginTop: 40 }}>Last ffmpeg commands</h1>
        {ffmpegCommandLog.length > 0 ? (
          <div style={{ overflowY: 'scroll', height: 200 }}>
            {ffmpegCommandLog.reverse().map(({ command }, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} style={{ whiteSpace: 'pre', margin: '5px 0' }}>
                <FaClipboard style={{ cursor: 'pointer' }} title="Copy to clipboard" onClick={() => { clipboard.writeText(command); toast.fire({ timer: 2000, icon: 'success', title: 'Copied to clipboard' }); }} /> {command}
              </div>
            ))}
          </div>
        ) : (
          <p>Here the last run ffmpeg commands will show up after you ran an operation. You can copy them to clipboard and modify them to your needs before running on your command line.</p>
        )}
      </motion.div>
    )}
  </AnimatePresence>
));

export default HelpSheet;
