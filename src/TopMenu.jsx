import React, { Fragment, memo } from 'react';
import { IoIosHelpCircle } from 'react-icons/io';
import { Button } from 'evergreen-ui';
import { MdCallSplit, MdCallMerge } from 'react-icons/md';

import { withBlur } from './util';


const TopMenu = memo(({
  filePath, copyAnyAudioTrack, toggleStripAudio, customOutDir, setOutputDir,
  renderOutFmt, outSegments, autoMerge, toggleAutoMerge, keyframeCut, toggleKeyframeCut, toggleHelp,
  numStreamsToCopy, numStreamsTotal, setStreamsSelectorShown,
}) => {
  const AutoMergeIcon = autoMerge ? MdCallMerge : MdCallSplit;

  return (
    <Fragment>
      {filePath && (
        <Fragment>
          <Button height={20} iconBefore="list" onClick={withBlur(() => setStreamsSelectorShown(true))}>
            Tracks ({numStreamsToCopy}/{numStreamsTotal})
          </Button>

          <Button
            iconBefore={copyAnyAudioTrack ? 'volume-up' : 'volume-off'}
            height={20}
            title={`Discard audio? Current: ${copyAnyAudioTrack ? 'keep audio tracks' : 'Discard audio tracks'}`}
            onClick={withBlur(toggleStripAudio)}
          >
            {copyAnyAudioTrack ? 'Keep audio' : 'Discard audio'}
          </Button>
        </Fragment>
      )}

      <div style={{ flexGrow: 1 }} />

      {filePath && (
        <Fragment>
          <Button
            iconBefore={customOutDir ? 'folder-open' : undefined}
            height={20}
            onClick={withBlur(setOutputDir)}
            title={customOutDir}
          >
            {`Working dir ${customOutDir ? 'set' : 'unset'}`}
          </Button>

          <div style={{ width: 60 }}>{renderOutFmt({ height: 20 })}</div>

          <Button
            height={20}
            style={{ opacity: outSegments && outSegments.length < 2 ? 0.4 : undefined }}
            title={autoMerge ? 'Auto merge segments to one file after export' : 'Export to separate files'}
            onClick={withBlur(toggleAutoMerge)}
          >
            <AutoMergeIcon /> {autoMerge ? 'Merge cuts' : 'Separate files'}
          </Button>

          <Button
            height={20}
            iconBefore={keyframeCut ? 'key' : undefined}
            title={`Cut mode is ${keyframeCut ? 'keyframe cut' : 'normal cut'}`}
            onClick={withBlur(toggleKeyframeCut)}
          >
            {keyframeCut ? 'Keyframe cut' : 'Normal cut'}
          </Button>
        </Fragment>
      )}

      <IoIosHelpCircle size={24} role="button" onClick={toggleHelp} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
    </Fragment>
  );
});

export default TopMenu;
