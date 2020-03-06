import React, { Fragment, memo } from 'react';
import { Button, Table, SegmentedControl, Checkbox } from 'evergreen-ui';

const Settings = memo(({
  setOutputDir, customOutDir, autoMerge, setAutoMerge, keyframeCut, setKeyframeCut, invertCutSegments, setInvertCutSegments,
  autoSaveProjectFile, setAutoSaveProjectFile, timecodeShowFrames, setTimecodeShowFrames, askBeforeClose, setAskBeforeClose,
  renderOutFmt, AutoExportToggler, renderCaptureFormatButton, onWheelTunerRequested,
}) => {
  // eslint-disable-next-line react/jsx-props-no-spreading
  const Row = (props) => <Table.Row height="auto" paddingY={12} {...props} />;
  // eslint-disable-next-line react/jsx-props-no-spreading
  const KeyCell = (props) => <Table.TextCell textProps={{ whiteSpace: 'auto' }} {...props} />;

  return (
    <Fragment>
      <Row>
        <KeyCell textProps={{ whiteSpace: 'auto' }}>Output format (default autodetected)</KeyCell>
        <Table.TextCell>{renderOutFmt({ width: '100%' })}</Table.TextCell>
      </Row>

      <Row>
        <KeyCell>
          Working directory<br />
          This is where working files, exported files, project files (CSV) are stored.
        </KeyCell>
        <Table.TextCell>
          <Button onClick={setOutputDir}>
            {customOutDir ? 'Custom working directory' : 'Same directory as input file'}
          </Button>
          <div>{customOutDir}</div>
        </Table.TextCell>
      </Row>

      <Row>
        <KeyCell>Auto merge segments to one file during export or export to separate files?</KeyCell>
        <Table.TextCell>
          <SegmentedControl
            options={[{ label: 'Auto merge', value: 'automerge' }, { label: 'Separate', value: 'separate' }]}
            value={autoMerge ? 'automerge' : 'separate'}
            onChange={value => setAutoMerge(value === 'automerge')}
          />
        </Table.TextCell>
      </Row>

      <Row>
        <KeyCell>
          Keyframe cut mode<br />
          <b>Nearest keyframe</b>: Cut at the nearest keyframe (not accurate time.) Equiv to <i>ffmpeg -ss -i ...</i><br />
          <b>Normal cut</b>: Accurate time but could leave an empty portion at the beginning of the video. Equiv to <i>ffmpeg -i -ss ...</i><br />
        </KeyCell>
        <Table.TextCell>
          <SegmentedControl
            options={[{ label: 'Nearest keyframe', value: 'keyframe' }, { label: 'Normal cut', value: 'normal' }]}
            value={keyframeCut ? 'keyframe' : 'normal'}
            onChange={value => setKeyframeCut(value === 'keyframe')}
          />
        </Table.TextCell>
      </Row>

      <Row>
        <KeyCell>
          <span role="img" aria-label="Yin Yang">☯️</span> Choose cutting mode: Remove or keep selected segments from video when exporting?<br />
          When <b>Keep</b> is selected, the video inside segments will be kept, while the video outside will be discarded.<br />
          When <b>Remove</b> is selected, the video inside segments will be discarded, while the video surrounding them will be kept.
        </KeyCell>
        <Table.TextCell>
          <SegmentedControl
            options={[{ label: 'Remove', value: 'discard' }, { label: 'Keep', value: 'keep' }]}
            value={invertCutSegments ? 'discard' : 'keep'}
            onChange={value => setInvertCutSegments(value === 'discard')}
          />
        </Table.TextCell>
      </Row>

      <Row>
        <KeyCell>
          Extract unprocessable tracks to separate files or discard them?<br />
          (data tracks such as GoPro GPS, telemetry etc. are not copied over by default because ffmpeg cannot cut them, thus they will cause the media duration to stay the same after cutting video/audio)
        </KeyCell>
        <Table.TextCell>
          <AutoExportToggler />
        </Table.TextCell>
      </Row>

      <Row>
        <KeyCell>
          Auto save project file?<br />
          The project will be stored along with the output files as a CSV file
        </KeyCell>
        <Table.TextCell>
          <Checkbox
            label="Auto save project"
            checked={autoSaveProjectFile}
            onChange={e => setAutoSaveProjectFile(e.target.checked)}
          />
        </Table.TextCell>
      </Row>

      <Row>
        <KeyCell>
          Snapshot capture format
        </KeyCell>
        <Table.TextCell>
          {renderCaptureFormatButton()}
        </Table.TextCell>
      </Row>

      <Row>
        <KeyCell>In timecode show</KeyCell>
        <Table.TextCell>
          <SegmentedControl
            options={[{ label: 'Frame numbers', value: 'frames' }, { label: 'Millisecond fractions', value: 'ms' }]}
            value={timecodeShowFrames ? 'frames' : 'ms'}
            onChange={value => setTimecodeShowFrames(value === 'frames')}
          />
        </Table.TextCell>
      </Row>

      <Row>
        <KeyCell>Scroll/wheel sensitivity</KeyCell>
        <Table.TextCell>
          <Button onClick={onWheelTunerRequested}>Change sensitivity</Button>
        </Table.TextCell>
      </Row>

      <Row>
        <KeyCell>Ask for confirmation when closing app or file?</KeyCell>
        <Table.TextCell>
          <Checkbox
            label="Ask before closing"
            checked={askBeforeClose}
            onChange={e => setAskBeforeClose(e.target.checked)}
          />
        </Table.TextCell>
      </Row>
    </Fragment>
  );
});

export default Settings;
