import React, { memo } from 'react';
import { IoIosCloseCircleOutline } from 'react-icons/io';
import { FaClipboard } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { Table } from 'evergreen-ui';

// eslint-disable-next-line import/no-extraneous-dependencies
const { clipboard } = require('electron');

const { toast } = require('./util');

const HelpSheet = memo(({
  visible, onTogglePress, renderSettings, ffmpegCommandLog,
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
        <div><kbd>SPACE</kbd>, <kbd>k</kbd> Play/pause</div>
        <div><kbd>J</kbd> Slow down video</div>
        <div><kbd>L</kbd> Speed up video</div>
        <div><kbd>←</kbd> Seek backward 1 sec</div>
        <div><kbd>→</kbd> Seek forward 1 sec</div>
        <div><kbd>,</kbd> Seek backward 1 frame</div>
        <div><kbd>.</kbd> Seek forward 1 frame</div>
        <div><kbd>I</kbd> Mark in / cut start point</div>
        <div><kbd>O</kbd> Mark out / cut end point</div>
        <div><kbd>E</kbd> Cut (export selection in the same directory)</div>
        <div><kbd>C</kbd> Capture snapshot (in the same directory)</div>
        <div><kbd>+</kbd> Add cut segment</div>
        <div><kbd>BACKSPACE</kbd> Remove current cut segment</div>
        <div><kbd>D</kbd> Delete source file</div>

        <p style={{ fontWeight: 'bold' }}>Hover mouse over buttons in the main interface to see which function they have.</p>

        <Table style={{ marginTop: 40 }}>
          <Table.Head>
            <Table.TextHeaderCell>
              Settings
            </Table.TextHeaderCell>
            <Table.TextHeaderCell>
              Current setting
            </Table.TextHeaderCell>
          </Table.Head>
          <Table.Body>
            {renderSettings()}
          </Table.Body>
        </Table>

        <h1 style={{ marginTop: 40 }}>Last ffmpeg commands</h1>
        <div style={{ overflowY: 'scroll', height: 200 }}>
          {ffmpegCommandLog.reverse().map((log) => (
            <div key={log} style={{ whiteSpace: 'pre', margin: '5px 0' }}>
              <FaClipboard style={{ cursor: 'pointer' }} title="Copy to clipboard" onClick={() => { clipboard.writeText(log); toast.fire({ timer: 2000, icon: 'success', title: 'Copied to clipboard' }); }} /> {log}
            </div>
          ))}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));

export default HelpSheet;
