import { memo, Fragment, useEffect, useMemo, useCallback, useState, ReactNode, SetStateAction, Dispatch, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchInput, PlusIcon, InlineAlert, UndoIcon, Paragraph, TakeActionIcon, IconButton, Button, DeleteIcon, AddIcon, Dialog } from 'evergreen-ui';
import { FaMouse, FaPlus, FaStepForward, FaStepBackward } from 'react-icons/fa';
import Mousetrap from 'mousetrap';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import uniq from 'lodash/uniq';

import useUserSettings from '../hooks/useUserSettings';
import Swal from '../swal';
import SetCutpointButton from './SetCutpointButton';
import SegmentCutpointButton from './SegmentCutpointButton';
import { getModifier } from '../hooks/useTimelineScroll';
import { KeyBinding, KeyboardAction, ModifierKey } from '../../../../types';
import { StateSegment } from '../types';
import Sheet from './Sheet';


type Category = string;

type ActionsMap = Record<KeyboardAction, { name: string, category?: Category, before?: ReactNode }>;

const renderKeys = (keys: string[]) => keys.map((key, i) => (
  <Fragment key={key}>
    {i > 0 && <FaPlus style={{ fontSize: '.4em', opacity: 0.8, marginLeft: '.4em', marginRight: '.4em' }} />}
    <kbd>{key.toUpperCase()}</kbd>
  </Fragment>
));

// From https://craig.is/killing/mice
// For modifier keys you can use shift, ctrl, alt, or meta.
// You can substitute option for alt and command for meta.
const allModifiers = new Set(['shift', 'ctrl', 'alt', 'meta']);
function fixKeys(keys: string[]) {
  const replaced = keys.map((key) => {
    if (key === 'option') return 'alt';
    if (key === 'command') return 'meta';
    return key;
  });
  const uniqed = uniq(replaced);
  const nonModifierKeys = keys.filter((key) => !allModifiers.has(key));
  if (nonModifierKeys.length === 0) return []; // only modifiers is invalid
  if (nonModifierKeys.length > 1) return []; // can only have one non-modifier
  return orderBy(uniqed, [(key) => key !== 'shift', (key) => key !== 'ctrl', (key) => key !== 'alt', (key) => key !== 'meta', (key) => key]);
}

// eslint-disable-next-line react/display-name
const CreateBinding = memo(({
  actionsMap, action, setCreatingBinding, onNewKeyBindingConfirmed,
}: {
  actionsMap: ActionsMap,
  action: KeyboardAction | undefined,
  setCreatingBinding: Dispatch<SetStateAction<KeyboardAction | undefined>>,
  onNewKeyBindingConfirmed: (a: KeyboardAction, keys: string[]) => void,
}) => {
  const { t } = useTranslation();

  const [keysDown, setKeysDown] = useState<string[]>([]);

  const validKeysDown = useMemo(() => fixKeys(keysDown), [keysDown]);

  const isShown = action != null;

  useEffect(() => {
    if (isShown) {
      setKeysDown([]);
    }
  }, [isShown]);

  const addKeyDown = useCallback((character: string) => setKeysDown((old) => [...new Set([...old, character])]), []);

  useEffect(() => {
    if (!isShown) return undefined;

    const mousetrap = new Mousetrap();
    function handleKey(character: string, _modifiers: unknown, e: { type: string, preventDefault: () => void }) {
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
      onCloseComplete={() => setCreatingBinding(undefined)}
      onConfirm={() => action != null && onNewKeyBindingConfirmed(action, keysDown)}
      onCancel={() => setCreatingBinding(undefined)}
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

const rowStyle = { display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '.2em' };

function WheelModifier({ text, wheelText, modifier }: { text: string, wheelText: string, modifier: ModifierKey }) {
  return (
    <div style={{ ...rowStyle, alignItems: 'center' }}>
      <span>{text}</span>
      <div style={{ flexGrow: 1 }} />
      {getModifier(modifier).map((v) => <kbd key={v} style={{ marginRight: '.7em' }}>{v}</kbd>)}
      <FaMouse style={{ marginRight: '.3em' }} />
      <span>{wheelText}</span>
    </div>
  );
}

// eslint-disable-next-line react/display-name
const KeyboardShortcuts = memo(({
  keyBindings, setKeyBindings, resetKeyBindings, currentCutSeg,
}: {
  keyBindings: KeyBinding[], setKeyBindings: Dispatch<SetStateAction<KeyBinding[]>>, resetKeyBindings: () => void, currentCutSeg: StateSegment,
}) => {
  const { t } = useTranslation();

  const { mouseWheelZoomModifierKey, mouseWheelFrameSeekModifierKey, mouseWheelKeyframeSeekModifierKey } = useUserSettings();

  const { actionsMap, extraLinesPerCategory } = useMemo(() => {
    const playbackCategory = t('Playback');
    const selectivePlaybackCategory = t('Playback/preview segments only');
    const seekingCategory = t('Seeking');
    const segmentsAndCutpointsCategory = t('Segments and cut points');
    const zoomOperationsCategory = t('Timeline/zoom operations');
    const outputCategory = t('Output actions');
    const batchFilesCategory = t('Batch file list');
    const otherCategory = t('Other operations');
    const streamsCategory = t('Tracks');

    // eslint-disable-next-line no-shadow
    const actionsMap: ActionsMap = {
      toggleLastCommands: {
        name: t('Last ffmpeg commands'),
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
      toggleMuted: {
        name: t('Mute preview'),
        category: playbackCategory,
      },
      reloadFile: {
        name: t('Reload current media'),
        category: playbackCategory,
      },
      html5ify: {
        name: t('Convert to supported format'),
        category: playbackCategory,
      },

      // selectivePlaybackCategory
      togglePlayOnlyCurrentSegment: {
        name: t('Play current segment once'),
        category: selectivePlaybackCategory,
      },
      toggleLoopOnlyCurrentSegment: {
        name: t('Loop current segment'),
        category: selectivePlaybackCategory,
      },
      toggleLoopStartEndOnlyCurrentSegment: {
        name: t('Loop beginning and end of current segment'),
        category: selectivePlaybackCategory,
      },
      toggleLoopSelectedSegments: {
        name: t('Play selected segments in order'),
        category: selectivePlaybackCategory,
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
        name: t('Backward seek'),
        category: seekingCategory,
      },
      seekForwards: {
        name: t('Forward seek'),
        category: seekingCategory,
      },
      seekBackwards2: {
        name: t('Backward seek (longer)'),
        category: seekingCategory,
      },
      seekForwards2: {
        name: t('Forward seek (longer)'),
        category: seekingCategory,
      },
      seekBackwards3: {
        name: t('Backward seek (longest)'),
        category: seekingCategory,
      },
      seekForwards3: {
        name: t('Forward seek (longest)'),
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
        name: t('Jump to current segment\'s start time'),
        category: seekingCategory,
        before: <SegmentCutpointButton currentCutSeg={currentCutSeg} side="start" Icon={FaStepBackward} style={{ verticalAlign: 'middle', marginRight: 5 }} />,
      },
      jumpCutEnd: {
        name: t('Jump to current segment\'s end time'),
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
        name: t('Start current segment at current time'),
        category: segmentsAndCutpointsCategory,
        before: <SetCutpointButton currentCutSeg={currentCutSeg} side="start" style={{ verticalAlign: 'middle', marginRight: 5 }} />,
      },
      setCutEnd: {
        name: t('End current segment at current time'),
        category: segmentsAndCutpointsCategory,
        before: <SetCutpointButton currentCutSeg={currentCutSeg} side="end" style={{ verticalAlign: 'middle', marginRight: 5 }} />,
      },
      labelCurrentSegment: {
        name: t('Label current segment'),
        category: segmentsAndCutpointsCategory,
      },
      editCurrentSegmentTags: {
        name: t('Edit current segment tags'),
        category: segmentsAndCutpointsCategory,
      },
      splitCurrentSegment: {
        name: t('Split segment at cursor'),
        category: segmentsAndCutpointsCategory,
      },
      focusSegmentAtCursor: {
        name: t('Focus segment at cursor'),
        category: segmentsAndCutpointsCategory,
      },
      duplicateCurrentSegment: {
        name: t('Duplicate current segment'),
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
      jumpFirstSegment: {
        name: t('Jump to first segment'),
        category: segmentsAndCutpointsCategory,
      },
      jumpLastSegment: {
        name: t('Jump to last segment'),
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
      shiftAllSegmentTimes: {
        name: t('Shift all segments on timeline'),
        category: segmentsAndCutpointsCategory,
      },
      alignSegmentTimesToKeyframes: {
        name: t('Align segment times to keyframes'),
        category: segmentsAndCutpointsCategory,
      },
      createSegmentsFromKeyframes: {
        name: t('Create segments from keyframes'),
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
      createFixedByteSizedSegments: {
        name: t('Create byte sized segments'),
        category: segmentsAndCutpointsCategory,
      },
      createRandomSegments: {
        name: t('Create random segments'),
        category: segmentsAndCutpointsCategory,
      },
      detectBlackScenes: {
        name: t('Detect black scenes'),
        category: segmentsAndCutpointsCategory,
      },
      detectSilentScenes: {
        name: t('Detect silent scenes'),
        category: segmentsAndCutpointsCategory,
      },
      detectSceneChanges: {
        name: t('Detect scene changes'),
        category: segmentsAndCutpointsCategory,
      },
      shuffleSegments: {
        name: t('Shuffle segments order'),
        category: segmentsAndCutpointsCategory,
      },
      combineOverlappingSegments: {
        name: t('Combine overlapping segments'),
        category: segmentsAndCutpointsCategory,
      },
      combineSelectedSegments: {
        name: t('Combine selected segments'),
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
      selectAllMarkers: {
        name: t('Select all markers'),
        category: segmentsAndCutpointsCategory,
      },
      toggleCurrentSegmentSelected: {
        name: t('Toggle current segment selected'),
        category: segmentsAndCutpointsCategory,
      },
      invertSelectedSegments: {
        name: t('Invert selected segments'),
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
      showStreamsSelector: {
        name: t('Edit tracks / metadata tags'),
        category: streamsCategory,
      },
      showIncludeExternalStreamsDialog: {
        name: t('Include more tracks from other file'),
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
      captureSnapshotAsCoverArt: {
        name: t('Set current frame as cover art'),
        category: outputCategory,
      },
      extractCurrentSegmentFramesAsImages: {
        name: t('Extract frames from current segment as image files'),
        category: outputCategory,
      },
      extractSelectedSegmentsFramesAsImages: {
        name: t('Extract frames from selected segments as image files'),
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
      batchOpenPreviousFile: {
        name: t('Open previous file'),
        category: batchFilesCategory,
      },
      batchNextFile: {
        name: t('Next file'),
        category: batchFilesCategory,
      },
      batchOpenNextFile: {
        name: t('Open next file'),
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
      toggleStripThumbnail: {
        name: t('Keep or discard thumbnail tracks'),
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
      copySegmentsToClipboard: {
        name: t('Copy selected segments times to clipboard'),
        category: otherCategory,
      },
      toggleWaveformMode: {
        name: t('Show waveform'),
        category: otherCategory,
      },
      toggleShowThumbnails: {
        name: t('Show thumbnails'),
        category: otherCategory,
      },
      toggleShowKeyframes: {
        name: t('Show keyframes'),
        category: otherCategory,
      },
      toggleFullscreenVideo: {
        name: 'Toggle full screen video',
        category: otherCategory,
      },
      toggleSettings: {
        name: t('Settings'),
        category: otherCategory,
      },
      openSendReportDialog: {
        name: t('Report an error'),
        category: otherCategory,
      },
      openFilesDialog: {
        name: t('Open'),
        category: otherCategory,
      },
      openDirDialog: {
        name: t('Open folder'),
        category: otherCategory,
      },
      exportYouTube: {
        name: t('Start times as YouTube Chapters'),
        category: otherCategory,
      },
      closeActiveScreen: {
        name: t('Close current screen'),
        category: otherCategory,
      },
      closeCurrentFile: {
        name: t('Close current file'),
        category: otherCategory,
      },
      quit: {
        name: t('Quit LosslessCut'),
        category: otherCategory,
      },
    };

    // eslint-disable-next-line no-shadow
    const extraLinesPerCategory: Record<Category, ReactNode> = {
      [zoomOperationsCategory]: [
        <div key="1" style={{ ...rowStyle, alignItems: 'center' }}>
          <span>{t('Pan timeline')}</span>
          <div style={{ flexGrow: 1 }} />
          <FaMouse style={{ marginRight: '.3em' }} />
          <span>{t('Mouse scroll/wheel up/down')}</span>
        </div>,

        <WheelModifier key="2" text={t('Seek one frame')} wheelText={t('Mouse scroll/wheel up/down')} modifier={mouseWheelFrameSeekModifierKey} />,

        <WheelModifier key="3" text={t('Seek one key frame')} wheelText={t('Mouse scroll/wheel up/down')} modifier={mouseWheelKeyframeSeekModifierKey} />,

        <WheelModifier key="4" text={t('Zoom in/out timeline')} wheelText={t('Mouse scroll/wheel up/down')} modifier={mouseWheelZoomModifierKey} />,
      ],
    };

    return {
      extraLinesPerCategory,
      actionsMap,
    };
  }, [currentCutSeg, mouseWheelFrameSeekModifierKey, mouseWheelKeyframeSeekModifierKey, mouseWheelZoomModifierKey, t]);

  useEffect(() => {
    // cleanup invalid bindings, to prevent renamed actions from blocking user to rebind
    const validBindings = keyBindings.filter(({ action }) => actionsMap[action]);

    if (validBindings.length !== keyBindings.length) {
      console.log(`Auto deleting ${keyBindings.length - validBindings.length} invalid key binding(s)`);
      setKeyBindings(validBindings);
    }
  }, [actionsMap, keyBindings, setKeyBindings]);

  const [creatingBinding, setCreatingBinding] = useState<KeyboardAction>();
  const [searchQuery, setSearchQuery] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionEntries = useMemo(() => (Object.entries(actionsMap) as any as [keyof typeof actionsMap, typeof actionsMap[keyof typeof actionsMap]][]).filter(([key, { name, category }]) => {
    const searchQueryTrimmed = searchQuery.toLowerCase().trim();
    return (
      !searchQuery
      || key.toLocaleLowerCase().includes(searchQueryTrimmed)
      || name.toLowerCase().includes(searchQueryTrimmed)
      || (category != null && category.toLowerCase().includes(searchQueryTrimmed))
    );
  }), [actionsMap, searchQuery]);

  const categoriesWithActions = useMemo(() => Object.entries(groupBy(actionEntries, ([, { category }]) => category)), [actionEntries]);

  const onDeleteBindingClick = useCallback(({ action, keys }: { action: KeyboardAction, keys: string }) => {
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

  const onAddBindingClick = useCallback((action: KeyboardAction) => {
    setCreatingBinding(action);
  }, []);

  const stringifyKeys = (keys: string[]) => keys.join('+');

  const onNewKeyBindingConfirmed = useCallback(async (action: KeyboardAction, keys: string[]) => {
    const fixedKeys = fixKeys(keys);
    if (fixedKeys.length === 0) return;
    const keysStr = stringifyKeys(fixedKeys);
    console.log('new key binding', action, keysStr);

    const duplicate = keyBindings.find((existingBinding) => existingBinding.keys === keysStr);
    let shouldReplaceDuplicate: KeyBinding | undefined;
    if (duplicate) {
      const { isConfirmed } = await Swal.fire({
        icon: 'warning',
        title: t('Duplicate keyboard combination'),
        text: t('Combination is already bound to "{{alreadyBoundKey}}". Do you want to replace the existing binding?', { alreadyBoundKey: actionsMap[duplicate.action]?.name }),
        confirmButtonText: t('Replace'),
        focusCancel: true,
        showCancelButton: true,
      });
      if (isConfirmed) {
        shouldReplaceDuplicate = duplicate;
      } else {
        return;
      }
    }

    setKeyBindings((existingBindings) => {
      console.log('Saving key binding');
      setCreatingBinding(undefined);
      const filtered = !shouldReplaceDuplicate ? existingBindings : existingBindings.filter((existing) => existing.keys !== shouldReplaceDuplicate.keys);
      return [...filtered, { action, keys: keysStr }];
    });
  }, [actionsMap, keyBindings, setKeyBindings, t]);

  return (
    <>
      <div style={{ marginBottom: '1em' }}>
        <div style={{ marginBottom: '1em' }}>
          <SearchInput ref={searchInputRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search" width="100%" />
        </div>

        {categoriesWithActions.map(([category, actionsInCategory]) => (
          <div key={category}>
            {category !== 'undefined' && <div style={{ marginTop: '2em', marginBottom: '.7em', fontSize: '1.4em' }}>{category}</div>}

            {actionsInCategory.map(([action, actionObj]) => {
              const actionName = (actionObj && actionObj.name) || action;
              const beforeContent = actionObj && actionObj.before;

              const bindingsForThisAction = keyBindings.filter((keyBinding) => keyBinding.action === action);

              return (
                <div key={action} style={rowStyle}>
                  <div>
                    {beforeContent}
                    <span title={action} style={{ marginRight: '.5em', opacity: 0.9 }}>{actionName}</span>
                    <div style={{ fontSize: '.8em', opacity: 0.3 }} title={t('API action name: {{action}}', { action })}>{action}</div>
                  </div>

                  <div style={{ flexGrow: 1 }} />

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    {bindingsForThisAction.map(({ keys }) => (
                      <div key={keys} style={{ display: 'flex', alignItems: 'center' }}>
                        {renderKeys(keys.split('+'))}

                        <IconButton title={t('Remove key binding')} appearance="minimal" intent="danger" icon={DeleteIcon} onClick={() => onDeleteBindingClick({ action, keys })} />
                      </div>
                    ))}

                    {bindingsForThisAction.length === 0 && <span style={{ opacity: 0.8, fontSize: '.8em' }}>{t('No binding')}</span>}
                  </div>

                  <IconButton title={t('Bind new key to action')} appearance="minimal" intent="success" icon={AddIcon} onClick={() => onAddBindingClick(action)} />
                </div>
              );
            })}

            {extraLinesPerCategory[category] && <div style={{ marginTop: '.8em' }}>{extraLinesPerCategory[category]}</div>}
          </div>
        ))}
      </div>

      <Button intent="danger" onClick={onResetClick}>{t('Reset')}</Button>

      <CreateBinding actionsMap={actionsMap} action={creatingBinding} setCreatingBinding={setCreatingBinding} onNewKeyBindingConfirmed={onNewKeyBindingConfirmed} />
    </>
  );
});

function KeyboardShortcutsDialog({
  isShown, onHide, keyBindings, setKeyBindings, resetKeyBindings, currentCutSeg,
}: {
  isShown: boolean, onHide: () => void, keyBindings: KeyBinding[], setKeyBindings: Dispatch<SetStateAction<KeyBinding[]>>, resetKeyBindings: () => void, currentCutSeg: StateSegment,
}) {
  const { t } = useTranslation();

  return (
    <Sheet visible={isShown} onClosePress={onHide} maxWidth="40em" style={{ padding: '0 2em' }}>
      <h2>{t('Keyboard & mouse shortcuts')}</h2>

      <KeyboardShortcuts keyBindings={keyBindings} setKeyBindings={setKeyBindings} currentCutSeg={currentCutSeg} resetKeyBindings={resetKeyBindings} />
      <Button onClick={onHide}>{t('Done')}</Button>

    </Sheet>
  );
}

export default memo(KeyboardShortcutsDialog);
