import React, { memo, Fragment, useEffect, useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, InlineAlert, UndoIcon, Paragraph, TakeActionIcon, IconButton, Button, DeleteIcon, AddIcon, Heading, Text, Dialog } from 'evergreen-ui';
import { FaMouse, FaPlus, FaStepForward, FaStepBackward } from 'react-icons/fa';
import Mousetrap from 'mousetrap';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import uniq from 'lodash/uniq';

import SetCutpointButton from './SetCutpointButton';
import SegmentCutpointButton from './SegmentCutpointButton';


const renderKeys = (keys) => keys.map((key, i) => (
  <Fragment key={key}>
    {i > 0 && <FaPlus size={8} style={{ marginLeft: 4, marginRight: 4, color: 'rgba(0,0,0,0.5)' }} />}
    <kbd>{key.toUpperCase()}</kbd>
  </Fragment>
));

// From https://craig.is/killing/mice
// For modifier keys you can use shift, ctrl, alt, or meta.
// You can substitute option for alt and command for meta.
const allModifiers = ['shift', 'ctrl', 'alt', 'meta'];
function fixKeys(keys) {
  const replaced = keys.map((key) => {
    if (key === 'option') return 'alt';
    if (key === 'command') return 'meta';
    return key;
  });
  const uniqed = uniq(replaced);
  const nonModifierKeys = keys.filter((key) => !allModifiers.includes(key));
  if (nonModifierKeys.length === 0) return []; // only modifiers is invalid
  if (nonModifierKeys.length > 1) return []; // can only have one non-modifier
  return orderBy(uniqed, [key => key !== 'shift', key => key !== 'ctrl', key => key !== 'alt', key => key !== 'meta', key => key]);
}

const CreateBinding = memo(({
  actionsMap, action, setCreatingBinding, onNewKeyBindingConfirmed,
}) => {
  const { t } = useTranslation();

  const [keysDown, setKeysDown] = useState([]);

  const validKeysDown = useMemo(() => fixKeys(keysDown), [keysDown]);

  const isShown = action != null;

  useEffect(() => {
    if (isShown) {
      setKeysDown([]);
    }
  }, [isShown]);

  const addKeyDown = useCallback((character) => setKeysDown((old) => [...new Set([...old, character])]), []);

  useEffect(() => {
    if (!isShown) return undefined;

    const mousetrap = new Mousetrap();
    function handleKey(character, modifiers, e) {
      if (['keydown', 'keypress'].includes(e.type)) {
        addKeyDown(character);
      }
      e.preventDefault();
    }
    const handleKeyOrig = mousetrap.handleKey;
    mousetrap.handleKey = handleKey;

    return () => {
      mousetrap.handleKey = handleKeyOrig;
    };
  }, [addKeyDown, isShown]);

  const isComboInvalid = validKeysDown.length === 0 && keysDown.length > 0;

  return (
    <Dialog
      title={t('Bind new key to action')}
      isShown={action != null}
      confirmLabel={t('Save')}
      cancelLabel={t('Cancel')}
      onCloseComplete={() => setCreatingBinding()}
      onConfirm={() => onNewKeyBindingConfirmed(action, keysDown)}
      onCancel={() => setCreatingBinding()}
    >
      {isShown ? (
        <div style={{ color: 'black' }}>
          <Paragraph marginBottom={10}><TakeActionIcon verticalAlign="middle" marginRight={5} /> {actionsMap[action].name} <span style={{ color: 'rgba(0,0,0,0.5)' }}>({action})</span></Paragraph>

          <Paragraph>{t('Please press your desired key combination. Make sure it doesn\'t conflict with any other binding or system hotkeys.')}</Paragraph>

          <div style={{ margin: '20px 0' }}>{renderKeys(validKeysDown.length > 0 ? validKeysDown : keysDown)}</div>

          {isComboInvalid && <InlineAlert marginBottom={20} intent="danger">{t('Combination is invalid')}</InlineAlert>}

          <div>
            {!keysDown.includes('esc') && <Button iconBefore={PlusIcon} onClick={() => addKeyDown('esc')}>ESC</Button>}
            {keysDown.length > 0 && <Button intent="warning" iconBefore={UndoIcon} onClick={() => setKeysDown([])}>{t('Start over')}</Button>}
          </div>
        </div>
      ) : <div />}
    </Dialog>
  );
});

const rowStyle = { display: 'flex', alignItems: 'center', margin: '6px 0' };

const KeyboardShortcuts = memo(({
  keyBindings, setKeyBindings, resetKeyBindings, currentCutSeg,
}) => {
  const { t } = useTranslation();

  const { actionsMap, extraLinesPerCategory } = useMemo(() => {
    const playbackCategory = t('Playback');
    const seekingCategory = t('Seeking');
    const segmentsAndCutpointsCategory = t('Segments and cut points');
    const zoomOperationsCategory = t('Timeline/zoom operations');
    const outputCategory = t('Output actions');
    const batchFilesCategory = t('Batch file list');
    const otherCategory = t('Other operations');
    const streamsCategory = t('Tracks');

    return {
      extraLinesPerCategory: {
        [zoomOperationsCategory]: [
          <div key="1" style={{ ...rowStyle, alignItems: 'center' }}>
            <Text>{t('Zoom in/out timeline')}</Text>
            <div style={{ flexGrow: 1 }} />
            <FaMouse style={{ marginRight: 3 }} />
            <Text>{t('Mouse scroll/wheel up/down')}</Text>
          </div>,

          <div key="2" style={{ ...rowStyle, alignItems: 'center' }}>
            <Text>{t('Pan timeline')}</Text>
            <div style={{ flexGrow: 1 }} />
            <FaMouse style={{ marginRight: 3 }} />
            <Text>{t('Mouse scroll/wheel left/right')}</Text>
          </div>,
        ],
      },
      actionsMap: {
        toggleHelp: {
          name: t('Show/hide help screen'),
        },
        toggleKeyboardShortcuts: {
          name: t('Keyboard & mouse shortcuts'),
        },

        // playbackCategory
        togglePlayResetSpeed: {
          name: t('Play/pause'),
          category: playbackCategory,
        },
        togglePlayNoResetSpeed: {
          name: t('Play/pause (no reset speed)'),
          category: playbackCategory,
        },
        play: {
          name: t('Play'),
          category: playbackCategory,
        },
        pause: {
          name: t('Pause'),
          category: playbackCategory,
        },
        increasePlaybackRate: {
          name: t('Speed up playback'),
          category: playbackCategory,
        },
        reducePlaybackRate: {
          name: t('Slow down playback'),
          category: playbackCategory,
        },
        increasePlaybackRateMore: {
          name: t('Speed up playback more'),
          category: playbackCategory,
        },
        reducePlaybackRateMore: {
          name: t('Slow down playback more'),
          category: playbackCategory,
        },
        increaseVolume: {
          name: t('Increase audio volume'),
          category: playbackCategory,
        },
        decreaseVolume: {
          name: t('Decrease audio volume'),
          category: playbackCategory,
        },

        // seekingCategory
        seekPreviousFrame: {
          name: t('Step backward 1 frame'),
          category: seekingCategory,
        },
        seekNextFrame: {
          name: t('Step forward 1 frame'),
          category: seekingCategory,
        },
        seekBackwards: {
          name: t('Seek backward 1 sec'),
          category: seekingCategory,
        },
        seekForwards: {
          name: t('Seek forward 1 sec'),
          category: seekingCategory,
        },
        seekBackwardsKeyframe: {
          name: t('Seek previous keyframe'),
          category: seekingCategory,
        },
        seekForwardsKeyframe: {
          name: t('Seek next keyframe'),
          category: seekingCategory,
        },
        seekBackwardsPercent: {
          name: t('Seek backward 1% of timeline at current zoom'),
          category: seekingCategory,
        },
        seekForwardsPercent: {
          name: t('Seek forward 1% of timeline at current zoom'),
          category: seekingCategory,
        },
        jumpCutStart: {
          name: t('Jump to cut start'),
          category: seekingCategory,
          before: <SegmentCutpointButton currentCutSeg={currentCutSeg} side="start" Icon={FaStepBackward} style={{ verticalAlign: 'middle', marginRight: 5 }} />,
        },
        jumpCutEnd: {
          name: t('Jump to cut end'),
          category: seekingCategory,
          before: <SegmentCutpointButton currentCutSeg={currentCutSeg} side="end" Icon={FaStepForward} style={{ verticalAlign: 'middle', marginRight: 5 }} />,
        },
        jumpTimelineStart: {
          name: t('Jump to start of video'),
          category: seekingCategory,
        },
        jumpTimelineEnd: {
          name: t('Jump to end of video'),
          category: seekingCategory,
        },
        goToTimecode: {
          name: t('Seek to timecode'),
          category: seekingCategory,
        },

        // segmentsAndCutpointsCategory
        addSegment: {
          name: t('Add cut segment'),
          category: segmentsAndCutpointsCategory,
        },
        removeCurrentSegment: {
          name: t('Remove current segment'),
          category: segmentsAndCutpointsCategory,
        },
        setCutStart: {
          name: t('Mark in / cut start point for current segment'),
          category: segmentsAndCutpointsCategory,
          before: <SetCutpointButton currentCutSeg={currentCutSeg} side="start" style={{ verticalAlign: 'middle', marginRight: 5 }} />,
        },
        setCutEnd: {
          name: t('Mark out / cut end point for current segment'),
          category: segmentsAndCutpointsCategory,
          before: <SetCutpointButton currentCutSeg={currentCutSeg} side="end" style={{ verticalAlign: 'middle', marginRight: 5 }} />,
        },
        labelCurrentSegment: {
          name: t('Label current segment'),
          category: segmentsAndCutpointsCategory,
        },
        splitCurrentSegment: {
          name: t('Split segment at cursor'),
          category: segmentsAndCutpointsCategory,
        },
        jumpPrevSegment: {
          name: t('Jump to previous segment'),
          category: segmentsAndCutpointsCategory,
        },
        jumpNextSegment: {
          name: t('Jump to next segment'),
          category: segmentsAndCutpointsCategory,
        },
        reorderSegsByStartTime: {
          name: t('Reorder segments by start time'),
          category: segmentsAndCutpointsCategory,
        },
        invertAllSegments: {
          name: t('Invert all segments on timeline'),
          category: segmentsAndCutpointsCategory,
        },
        fillSegmentsGaps: {
          name: t('Fill gaps between segments'),
          category: segmentsAndCutpointsCategory,
        },
        createFixedDurationSegments: {
          name: t('Create fixed duration segments'),
          category: segmentsAndCutpointsCategory,
        },
        createNumSegments: {
          name: t('Create num segments'),
          category: segmentsAndCutpointsCategory,
        },
        shuffleSegments: {
          name: t('Shuffle segments order'),
          category: segmentsAndCutpointsCategory,
        },
        clearSegments: {
          name: t('Clear all segments'),
          category: segmentsAndCutpointsCategory,
        },
        toggleSegmentsList: {
          name: t('Show sidebar'),
          category: segmentsAndCutpointsCategory,
        },
        selectOnlyCurrentSegment: {
          name: t('Select only this segment'),
          category: segmentsAndCutpointsCategory,
        },
        deselectAllSegments: {
          name: t('Deselect all segments'),
          category: segmentsAndCutpointsCategory,
        },
        selectAllSegments: {
          name: t('Select all segments'),
          category: segmentsAndCutpointsCategory,
        },
        toggleCurrentSegmentSelected: {
          name: t('Toggle current segment selected'),
          category: segmentsAndCutpointsCategory,
        },
        removeSelectedSegments: {
          name: t('Remove selected segments'),
          category: segmentsAndCutpointsCategory,
        },

        // streamsCategory
        toggleStreamsSelector: {
          name: t('Edit tracks / metadata tags'),
          category: streamsCategory,
        },
        extractAllStreams: {
          name: t('Extract all tracks'),
          category: streamsCategory,
        },

        // zoomOperationsCategory
        timelineZoomIn: {
          name: t('Zoom in timeline'),
          category: zoomOperationsCategory,
        },
        timelineZoomOut: {
          name: t('Zoom out timeline'),
          category: zoomOperationsCategory,
        },
        timelineToggleComfortZoom: {
          name: t('Toggle zoom between 1x and a calculated comfortable zoom level'),
          category: zoomOperationsCategory,
        },

        // outputCategory
        export: {
          name: t('Export segment(s)'),
          category: outputCategory,
        },
        captureSnapshot: {
          name: t('Capture snapshot'),
          category: outputCategory,
        },
        extractCurrentSegmentFramesAsImages: {
          name: t('Extract all frames in segment as images'),
          category: outputCategory,
        },
        cleanupFilesDialog: {
          name: t('Delete source file'),
          category: outputCategory,
        },
        convertFormatBatch: {
          name: t('Batch convert files to supported format'),
          category: outputCategory,
        },
        convertFormatCurrentFile: {
          name: t('Convert current file to supported format'),
          category: outputCategory,
        },
        fixInvalidDuration: {
          name: t('Fix incorrect duration'),
          category: outputCategory,
        },

        // batchFilesCategory
        batchPreviousFile: {
          name: t('Previous file'),
          category: batchFilesCategory,
        },
        batchNextFile: {
          name: t('Next file'),
          category: batchFilesCategory,
        },
        batchOpenSelectedFile: {
          name: t('Open selected file'),
          category: batchFilesCategory,
        },
        closeBatch: {
          name: t('Close batch'),
          category: batchFilesCategory,
        },
        concatBatch: {
          name: t('Merge/concatenate files'),
          category: batchFilesCategory,
        },

        // otherCategory
        toggleKeyframeCutMode: {
          name: t('Cut mode'),
          category: otherCategory,
        },
        toggleCaptureFormat: {
          name: t('Capture frame format'),
          category: otherCategory,
        },
        toggleStripAudio: {
          name: t('Keep or discard audio tracks'),
          category: otherCategory,
        },
        increaseRotation: {
          name: t('Change rotation'),
          category: otherCategory,
        },
        setStartTimeOffset: {
          name: t('Set custom start offset/timecode'),
          category: otherCategory,
        },
        undo: {
          name: t('Undo'),
          category: otherCategory,
        },
        redo: {
          name: t('Redo'),
          category: otherCategory,
        },
        closeActiveScreen: {
          name: t('Close current screen'),
          category: otherCategory,
        },
      },
    };
  }, [currentCutSeg, t]);

  const [creatingBinding, setCreatingBinding] = useState();

  const categoriesWithActions = useMemo(() => Object.entries(groupBy(Object.entries(actionsMap), ([, { category }]) => category)), [actionsMap]);

  const onDeleteBindingClick = useCallback(({ action, keys }) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('Are you sure?'))) return;

    console.log('delete key binding', action, keys);
    setKeyBindings((existingBindings) => existingBindings.filter((existingBinding) => !(existingBinding.keys === keys && existingBinding.action === action)));
  }, [setKeyBindings, t]);


  const onResetClick = useCallback(() => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('Are you sure?'))) return;

    resetKeyBindings();
  }, [resetKeyBindings, t]);

  const onAddBindingClick = useCallback((action) => {
    setCreatingBinding(action);
  }, []);

  const stringifyKeys = (keys) => keys.join('+');

  const onNewKeyBindingConfirmed = useCallback((action, keys) => {
    const fixedKeys = fixKeys(keys);
    if (fixedKeys.length === 0) return;
    const keysStr = stringifyKeys(fixedKeys);
    console.log('new key binding', action, keysStr);

    setKeyBindings((existingBindings) => {
      const haveDuplicate = existingBindings.some((existingBinding) => existingBinding.keys === keysStr);
      if (haveDuplicate) {
        console.log('trying to add duplicate');
        return existingBindings;
      }

      console.log('saving key binding');
      setCreatingBinding();
      return [...existingBindings, { action, keys: keysStr }];
    });
  }, [setKeyBindings]);

  return (
    <>
      <div style={{ color: 'black' }}>
        {categoriesWithActions.map(([category, actionsInCategory]) => (
          <div key={category}>
            {category !== 'undefined' && <Heading marginTop={30} marginBottom={14}>{category}</Heading>}

            {actionsInCategory.map(([action, actionObj]) => {
              const actionName = (actionObj && actionObj.name) || action;
              const beforeContent = actionObj && actionObj.before;

              const bindingsForThisAction = keyBindings.filter((keyBinding) => keyBinding.action === action);

              return (
                <div key={action} style={rowStyle}>
                  {beforeContent}

                  <Text title={action} marginRight={10}>{actionName}</Text>

                  <div style={{ flexGrow: 1 }} />

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    {bindingsForThisAction.map(({ keys }) => (
                      <div key={keys} style={{ display: 'flex', alignItems: 'center' }}>
                        {renderKeys(keys.split('+'))}

                        <IconButton title={t('Remove key binding')} appearance="minimal" intent="danger" icon={DeleteIcon} onClick={() => onDeleteBindingClick({ action, keys })} />
                      </div>
                    ))}

                    {bindingsForThisAction.length === 0 && <Text color="muted">{t('No binding')}</Text>}
                  </div>

                  <IconButton title={t('Bind new key to action')} appearance="minimal" intent="success" icon={AddIcon} onClick={() => onAddBindingClick(action)} />
                </div>
              );
            })}

            {extraLinesPerCategory[category]}
          </div>
        ))}
      </div>

      <Button intent="danger" onClick={onResetClick}>{t('Reset')}</Button>

      <CreateBinding actionsMap={actionsMap} action={creatingBinding} setCreatingBinding={setCreatingBinding} onNewKeyBindingConfirmed={onNewKeyBindingConfirmed} />
    </>
  );
});

const KeyboardShortcutsDialog = memo(({
  isShown, onHide, keyBindings, setKeyBindings, resetKeyBindings, currentCutSeg,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog
      title={t('Keyboard & mouse shortcuts')}
      isShown={isShown}
      confirmLabel={t('Done')}
      hasCancel={false}
      onCloseComplete={onHide}
      onConfirm={onHide}
      topOffset="3vh"
    >
      {isShown ? <KeyboardShortcuts keyBindings={keyBindings} setKeyBindings={setKeyBindings} currentCutSeg={currentCutSeg} resetKeyBindings={resetKeyBindings} /> : <div />}
    </Dialog>
  );
});

export default KeyboardShortcutsDialog;
