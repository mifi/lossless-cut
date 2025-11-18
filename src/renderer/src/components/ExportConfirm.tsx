import { CSSProperties, Dispatch, ReactNode, SetStateAction, memo, useCallback, useMemo, useState } from 'react';
import { FaExclamationTriangle, FaInfoCircle, FaRegCheckCircle } from 'react-icons/fa';
import i18n from 'i18next';
import { useTranslation, Trans } from 'react-i18next';
import { IoIosHelpCircle, IoIosSettings } from 'react-icons/io';
import type { SweetAlertIcon } from 'sweetalert2';

import ExportButton from './ExportButton';
import ExportModeButton from './ExportModeButton';
import FileNameTemplateEditor from './FileNameTemplateEditor';
import HighlightedText from './HighlightedText';
import Select from './Select';
import Switch from './Switch';

import { primaryTextColor, warningColor } from '../colors';
import { withBlur } from '../util';
import getSwal from '../swal';
import { isMov as ffmpegIsMov } from '../util/streams';
import useUserSettings from '../hooks/useUserSettings';
import styles from './ExportConfirm.module.css';
import { SegmentToExport } from '../types';
import { defaultCutFileTemplate, defaultCutMergedFileTemplate, GenerateOutFileNames } from '../util/outputNameTemplate';
import { FFprobeStream } from '../../../common/ffprobe';
import { AvoidNegativeTs, FixCodecTagOption, PreserveMetadata } from '../../../common/types';
import TextInput from './TextInput';
import { UseSegments } from '../hooks/useSegments';
import ExportSheet from './ExportSheet';
import ToggleExportConfirm from './ToggleExportConfirm';
import { LossyMode } from '../../../main';
import AnimatedTr from './AnimatedTr';


const noticeStyle: CSSProperties = { marginBottom: '.5em' };
const infoStyle: CSSProperties = { ...noticeStyle, color: primaryTextColor };
const warningStyle: CSSProperties = { ...noticeStyle, color: warningColor };

const rightIconStyle: CSSProperties = { fontSize: '1.2em', verticalAlign: 'middle' };

const adjustCutFromValues = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const adjustCutToValues = [-10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const HelpIcon = ({ onClick, style }: { onClick: () => void, style?: CSSProperties }) => (
  <IoIosHelpCircle role="button" onClick={withBlur(onClick)} style={{ cursor: 'pointer', color: primaryTextColor, verticalAlign: 'middle', fontSize: '1.5em', ...style }} />
);

function ShiftTimes({ values, num, setNum }: { values: number[], num: number, setNum: (n: number) => void }) {
  const { t } = useTranslation();
  return (
    <Select value={num} onChange={(e) => setNum(Number(e.target.value))} style={{ height: 20, marginLeft: 5 }}>
      {values.map((v) => <option key={v} value={v}>{t('{{numFrames}} frames', { numFrames: v >= 0 ? `+${v}` : v, count: v })}</option>)}
    </Select>
  );
}

function renderNoticeIcon(notice: { warning?: boolean | undefined } | undefined, style?: CSSProperties) {
  if (!notice) return undefined;
  return notice.warning ? (
    <FaExclamationTriangle style={{ flexShrink: '0', fontSize: '.8em', verticalAlign: 'baseline', color: warningColor, ...style }} />
  ) : (
    <FaInfoCircle style={{ flexShrink: '0', fontSize: '.8em', verticalAlign: 'baseline', color: 'var(--blue-10)', ...style }} />
  );
}

function renderNotice(notice: { warning?: boolean | undefined, text: ReactNode } | undefined, { key, style }: { key?: string, style?: CSSProperties }) {
  if (notice == null) return null;
  const { warning, text } = notice;
  return (
    <div key={key} style={{ ...(warning ? warningStyle : infoStyle), gap: '0 .5em', ...style }}>
      {renderNoticeIcon({ warning })} {text}
    </div>
  );
}

function ExportConfirm({
  areWeCutting,
  segmentsToExport,
  willMerge,
  visible,
  onClosePress,
  onExportConfirm,
  outFormat,
  renderOutFmt,
  outputDir,
  numStreamsTotal,
  numStreamsToCopy,
  onShowStreamsSelectorClick,
  cutFileTemplate,
  cutMergedFileTemplate,
  generateCutFileNames,
  generateCutMergedFileNames,
  currentSegIndexSafe,
  segmentsOrInverse,
  mainCopiedThumbnailStreams,
  needSmartCut,
  isEncoding,
  encBitrate,
  setEncBitrate,
  toggleSettings,
  outputPlaybackRate,
  lossyMode,
} : {
  areWeCutting: boolean,
  segmentsToExport: SegmentToExport[],
  willMerge: boolean,
  visible: boolean,
  onClosePress: () => void,
  onExportConfirm: () => void,
  outFormat: string | undefined,
  renderOutFmt: (style: CSSProperties) => JSX.Element,
  outputDir: string | undefined,
  numStreamsTotal: number,
  numStreamsToCopy: number,
  onShowStreamsSelectorClick: () => void,
  cutFileTemplate: string,
  cutMergedFileTemplate: string,
  generateCutFileNames: GenerateOutFileNames,
  generateCutMergedFileNames: GenerateOutFileNames,
  currentSegIndexSafe: number,
  segmentsOrInverse: UseSegments['segmentsOrInverse'],
  mainCopiedThumbnailStreams: FFprobeStream[],
  needSmartCut: boolean,
  isEncoding: boolean,
  encBitrate: number | undefined,
  setEncBitrate: Dispatch<SetStateAction<number | undefined>>,
  toggleSettings: () => void,
  outputPlaybackRate: number,
  lossyMode: LossyMode | undefined,
}) {
  const { t } = useTranslation();

  const { changeOutDir, keyframeCut, toggleKeyframeCut, preserveMovData, setPreserveMovData, setFixCodecTag, fixCodecTag, preserveMetadata, setPreserveMetadata, preserveChapters, setPreserveChapters, movFastStart, setMovFastStart, avoidNegativeTs, setAvoidNegativeTs, autoDeleteMergedSegments, exportConfirmEnabled, toggleExportConfirmEnabled, segmentsToChapters, setSegmentsToChapters, preserveMetadataOnMerge, setPreserveMetadataOnMerge, enableSmartCut, setEnableSmartCut, effectiveExportMode, enableOverwriteOutput, setEnableOverwriteOutput, ffmpegExperimental, setFfmpegExperimental, cutFromAdjustmentFrames, setCutFromAdjustmentFrames, cutToAdjustmentFrames, setCutToAdjustmentFrames, setCutFileTemplate, setCutMergedFileTemplate, simpleMode } = useUserSettings();

  const [showAdvanced, setShowAdvanced] = useState(!simpleMode);

  const togglePreserveChapters = useCallback(() => setPreserveChapters((val) => !val), [setPreserveChapters]);
  const togglePreserveMovData = useCallback(() => setPreserveMovData((val) => !val), [setPreserveMovData]);
  const toggleMovFastStart = useCallback(() => setMovFastStart((val) => !val), [setMovFastStart]);
  const toggleSegmentsToChapters = useCallback(() => setSegmentsToChapters((v) => !v), [setSegmentsToChapters]);
  const togglePreserveMetadataOnMerge = useCallback(() => setPreserveMetadataOnMerge((v) => !v), [setPreserveMetadataOnMerge]);

  const isMov = ffmpegIsMov(outFormat);
  const isIpod = outFormat === 'ipod';

  // some thumbnail streams (png,jpg etc) cannot always be cut correctly, so we warn if they try to.
  const areWeCuttingProblematicStreams = areWeCutting && mainCopiedThumbnailStreams.length > 0;

  const notices = useMemo(() => {
    const specific: Record<'exportMode' | 'problematicStreams' | 'movFastStart' | 'preserveMovData' | 'smartCut' | 'cutMode' | 'avoidNegativeTs' | 'overwriteOutput', { warning?: true, text: ReactNode } | undefined> = {
      exportMode: effectiveExportMode === 'segments_to_chapters' ? { text: i18n.t('Segments to chapters mode is active, this means that the file will not be cut. Instead chapters will be created from the segments.') } : undefined,
      problematicStreams: areWeCuttingProblematicStreams ? { warning: true, text: <Trans>Warning: Cutting thumbnail tracks is known to cause problems. Consider disabling track {{ trackNumber: mainCopiedThumbnailStreams[0] ? mainCopiedThumbnailStreams[0].index + 1 : 0 }}.</Trans> } : undefined,
      movFastStart: isMov && isIpod && !movFastStart ? { warning: true, text: t('For the ipod format, it is recommended to activate this option') } : undefined,
      preserveMovData: isMov && isIpod && preserveMovData ? { warning: true, text: t('For the ipod format, it is recommended to deactivate this option') } : undefined,
      smartCut: areWeCutting && needSmartCut ? { warning: true, text: t('Smart cut is experimental and will not work on all files.') } : undefined,
      cutMode: areWeCutting && !isEncoding && !keyframeCut ? { text: t('Note: Keyframe cut is recommended for most common files') } : undefined,
      avoidNegativeTs: !isEncoding ? (() => {
        if (willMerge) {
          if (avoidNegativeTs !== 'make_non_negative') {
            return { text: t('When merging, it\'s generally recommended to set this to "make_non_negative"') };
          }
          return undefined;
        }
        if (!['make_zero', 'auto'].includes(avoidNegativeTs)) {
          return { text: t('It\'s generally recommended to set this to one of: {{values}}', { values: '"auto", "make_zero"' }) };
        }
        return undefined;
      })() : undefined,
      overwriteOutput: enableOverwriteOutput ? { text: t('Existing files will be overwritten without warning!') } : undefined,
    };

    const generic: { warning?: true, text: string }[] = [];

    if (effectiveExportMode === 'separate' && !areWeCutting) {
      generic.push({ text: t('Exporting whole file without cutting, because there are no segments to export.') });
    }

    // https://github.com/mifi/lossless-cut/issues/1809
    if (areWeCutting && outFormat === 'flac') {
      generic.push({ warning: true, text: t('There is a known issue in FFmpeg with cutting FLAC files. The file will be re-encoded, which is still lossless, but the export may be slower.') });
    }
    if (areWeCutting && outputPlaybackRate !== 1) {
      generic.push({ warning: true, text: t('Adjusting the output FPS and cutting at the same time will cause incorrect cuts. Consider instead doing it in two separate steps.') });
    }

    return {
      generic,
      specific,
      totalNum: generic.filter((n) => n.warning).length + Object.values(specific).filter((n) => n != null && n.warning).length,
    };
  }, [areWeCutting, areWeCuttingProblematicStreams, avoidNegativeTs, effectiveExportMode, enableOverwriteOutput, isEncoding, isIpod, isMov, keyframeCut, mainCopiedThumbnailStreams, movFastStart, needSmartCut, outFormat, outputPlaybackRate, preserveMovData, t, willMerge]);

  const exportModeDescription = useMemo(() => ({
    segments_to_chapters: t('Don\'t cut the file, but instead export an unmodified original which has chapters generated from segments'),
    merge: t('Auto merge segments to one file after export'),
    'merge+separate': t('Auto merge segments into one file after export, but keep exported per-segment files too'),
    separate: t('Export each segment to a separate file'),
  })[effectiveExportMode], [effectiveExportMode, t]);

  const showHelpText = useCallback(({ icon = 'info', timer = 10000, text }: { icon?: SweetAlertIcon, timer?: number, text: string }) => getSwal().toast.fire({ icon, timer, text }), []);

  const onPreserveChaptersPress = useCallback(() => {
    showHelpText({ text: i18n.t('Whether to preserve chapters from source file.') });
  }, [showHelpText]);

  const onPreserveMovDataHelpPress = useCallback(() => {
    showHelpText({ text: i18n.t('Preserve all MOV/MP4 metadata tags (e.g. EXIF, GPS position etc.) from source file? Note that some players have trouble playing back files where all metadata is preserved, like iTunes and other Apple software') });
  }, [showHelpText]);

  const onPreserveMetadataHelpPress = useCallback(() => {
    showHelpText({ text: i18n.t('Whether to preserve metadata from source file. Default: Global (file metadata), per-track and per-chapter metadata will be copied. Non-global: Only per-track and per-chapter metadata will be copied. None: No metadata will be copied') });
  }, [showHelpText]);

  const onMovFastStartHelpPress = useCallback(() => {
    showHelpText({ text: i18n.t('Enabling this will allow faster playback of the exported file. This makes processing use 3 times as much export I/O, which is negligible for small files but might slow down exporting of large files.') });
  }, [showHelpText]);

  const onOutFmtHelpPress = useCallback(() => {
    showHelpText({ text: i18n.t('Defaults to same format as input file. You can losslessly change the file format (container) of the file with this option. Not all formats support all codecs. Matroska/MP4/MOV support the most common codecs. Sometimes it\'s even impossible to export to the same output format as input.') });
  }, [showHelpText]);

  const onKeyframeCutHelpPress = useCallback(() => {
    showHelpText({ text: i18n.t('With "keyframe cut", we will cut at the nearest keyframe before the desired start cutpoint. This is recommended for most files. With "Normal cut" you may have to manually set the cutpoint a few frames before the next keyframe to achieve a precise cut') });
  }, [showHelpText]);

  const onSmartCutHelpPress = useCallback(() => {
    showHelpText({ text: i18n.t('This experimental feature will re-encode the part of the video from the cutpoint until the next keyframe in order to attempt to make a 100% accurate cut. Only works on some files. I\'ve had success with some h264 files, and only a few h265 files. See more here: {{url}}', { url: 'https://github.com/mifi/lossless-cut/issues/126' }) });
  }, [showHelpText]);

  const onTracksHelpPress = useCallback(() => {
    showHelpText({ text: i18n.t('Not all formats support all track types, and LosslessCut is unable to properly cut some track types, so you may have to sacrifice some tracks by disabling them in order to get correct result.') });
  }, [showHelpText]);

  const onSegmentsToChaptersHelpPress = useCallback(() => {
    showHelpText({ text: i18n.t('When merging, do you want to create chapters in the merged file, according to the cut segments? NOTE: This may dramatically increase processing time') });
  }, [showHelpText]);

  const onPreserveMetadataOnMergeHelpPress = useCallback(() => {
    showHelpText({ text: i18n.t('When merging, do you want to preserve metadata from your original file? NOTE: This may dramatically increase processing time') });
  }, [showHelpText]);

  const onCutFileTemplateHelpPress = useCallback(() => {
    showHelpText({ text: i18n.t('You can customize the file name of the output segment(s) using special variables.', { count: segmentsToExport.length }) });
  }, [segmentsToExport.length, showHelpText]);

  const onCutMergedFileTemplateHelpPress = useCallback(() => {
    showHelpText({ text: i18n.t('You can customize the file name of the merged file using special variables.') });
  }, [showHelpText]);

  const onExportModeHelpPress = useCallback(() => {
    showHelpText({ text: exportModeDescription });
  }, [exportModeDescription, showHelpText]);

  // https://github.com/mifi/lossless-cut/issues/2518
  // https://github.com/mifi/lossless-cut/issues/1444
  const onFixCodecTagHelpPress = useCallback(() => {
    showHelpText({ text: i18n.t('Some video files have incorrect codec tags which may cause problems playing back the video track in some players. On the flip side, fixing the codec tag will also cause problems in some players, so you might have to try both settings.') });
  }, [showHelpText]);

  const onAvoidNegativeTsHelpPress = useCallback(() => {
    // https://ffmpeg.org/ffmpeg-all.html#Format-Options
    // https://github.com/mifi/lossless-cut/issues/1206
    const texts = {
      make_non_negative: i18n.t('Shift timestamps to make them non-negative. Also note that this affects only leading negative timestamps, and not non-monotonic negative timestamps.'),
      make_zero: i18n.t('Shift timestamps so that the first timestamp is 0. (LosslessCut default)'),
      auto: i18n.t('Enables shifting when required by the target format.'),
      disabled: i18n.t('Disables shifting of timestamp.'),
    };
    showHelpText({ text: `${avoidNegativeTs}: ${texts[avoidNegativeTs]}` });
  }, [avoidNegativeTs, showHelpText]);

  const onCutFromAdjustmentFramesHelpPress = useCallback(() => {
    showHelpText({ text: i18n.t('This option allows you to shift all segment start times forward by one or more frames before cutting. This can be useful if the output video starts from the wrong (preceding) keyframe.') });
  }, [showHelpText]);

  const onFfmpegExperimentalHelpPress = useCallback(() => {
    showHelpText({ text: t('Enable experimental ffmpeg features flag?') });
  }, [showHelpText, t]);

  const canEditSegTemplate = !willMerge || !autoDeleteMergedSegments;

  const handleEncBitrateToggle = useCallback((checked: boolean) => {
    setEncBitrate(() => (checked ? undefined : 10000));
  }, [setEncBitrate]);

  const handleEncBitrateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (Number.isNaN(v) || v <= 0) return;
    setEncBitrate(v);
  }, [setEncBitrate]);

  return (
    <ExportSheet
      width="50em"
      visible={visible}
      title={t('Export options')}
      onClosePress={onClosePress}
      renderButton={() => (
        <ExportButton segmentsToExport={segmentsToExport} areWeCutting={areWeCutting} onClick={withBlur(() => onExportConfirm())} style={{ fontSize: '1.3em' }} />
      )}
      renderBottom={() => (
        <>
          <ToggleExportConfirm size="1.5em" />
          <div style={{ fontSize: '.8em', marginLeft: '.4em', marginRight: '.5em', maxWidth: '8.5em', lineHeight: '100%', color: exportConfirmEnabled ? 'var(--gray-12)' : 'var(--gray-11)' }} role="button" onClick={toggleExportConfirmEnabled}>
            {t('Show this page before exporting?')}
          </div>
          {notices.totalNum > 0 && (
            renderNoticeIcon({ warning: true }, { fontSize: '1.5em', marginRight: '.5em' })
          )}
        </>
      )}
    >
      <table className={styles['options']}>
        <tbody>
          <tr>
            <td colSpan={2}>
              {notices.generic.map(({ warning, text }) => (
                renderNotice({ warning, text }, { key: text })
              ))}
            </td>
            <td />
          </tr>

          {segmentsOrInverse.selected.length !== segmentsOrInverse.all.length && (
            <tr>
              <td colSpan={2}>
                <FaRegCheckCircle size={12} style={{ marginRight: 3 }} />{t('{{selectedSegments}} of {{nonFilteredSegments}} segments selected', { selectedSegments: segmentsOrInverse.selected.length, nonFilteredSegments: segmentsOrInverse.all.length })}
              </td>
              <td />
            </tr>
          )}

          <tr>
            <td>
              {segmentsOrInverse.selected.length > 1 ? t('Export mode for {{segments}} segments', { segments: segmentsOrInverse.selected.length }) : t('Export mode')}
              {renderNotice(notices.specific['exportMode'], { style: { fontSize: '85%' } })}
            </td>
            <td>
              <ExportModeButton selectedSegments={segmentsOrInverse.selected} style={{ height: '1.8em' }} />
            </td>
            <td>
              {renderNoticeIcon(notices.specific['exportMode'], rightIconStyle) ?? <HelpIcon onClick={onExportModeHelpPress} />}
            </td>
          </tr>

          <tr>
            <td>
              {t('Output container format:')}
            </td>
            <td>
              {renderOutFmt({ height: '1.8em', maxWidth: 150 })}
            </td>
            <td>
              <HelpIcon onClick={onOutFmtHelpPress} />
            </td>
          </tr>

          <tr>
            <td>
              <Trans>Input has {{ numStreamsTotal }} tracks</Trans>
              {renderNotice(notices.specific['problematicStreams'], { style: { fontSize: '85%' } })}
            </td>
            <td>
              <HighlightedText style={{ cursor: 'pointer' }} onClick={onShowStreamsSelectorClick}><Trans>Keeping {{ numStreamsToCopy }} tracks</Trans></HighlightedText>
            </td>
            <td>
              {renderNoticeIcon(notices.specific['problematicStreams'], rightIconStyle) ?? <HelpIcon onClick={onTracksHelpPress} />}
            </td>
          </tr>

          <tr>
            <td>
              {t('Save output to path:')}
            </td>
            <td>
              <HighlightedText role="button" onClick={changeOutDir} style={{ wordBreak: 'break-all', cursor: 'pointer' }}>{outputDir}</HighlightedText>
            </td>
            <td />
          </tr>

          {canEditSegTemplate && (
            <tr>
              <td colSpan={2}>
                <FileNameTemplateEditor mode="separate" template={cutFileTemplate} setTemplate={setCutFileTemplate} defaultTemplate={defaultCutFileTemplate} generateFileNames={generateCutFileNames} currentSegIndexSafe={currentSegIndexSafe} />
              </td>
              <td>
                <HelpIcon onClick={onCutFileTemplateHelpPress} />
              </td>
            </tr>
          )}

          {willMerge && (
            <tr>
              <td colSpan={2}>
                <FileNameTemplateEditor mode="merge-segments" template={cutMergedFileTemplate} setTemplate={setCutMergedFileTemplate} defaultTemplate={defaultCutMergedFileTemplate} generateFileNames={generateCutMergedFileNames} />
              </td>
              <td>
                <HelpIcon onClick={onCutMergedFileTemplateHelpPress} />
              </td>
            </tr>
          )}

          <tr>
            <td>
              {t('Overwrite existing files')}
              {renderNotice(notices.specific['overwriteOutput'], { style: { fontSize: '85%' } })}
            </td>
            <td>
              <Switch checked={enableOverwriteOutput} onCheckedChange={setEnableOverwriteOutput} />
            </td>
            <td>
              {renderNoticeIcon(notices.specific['overwriteOutput'], rightIconStyle) ?? <HelpIcon onClick={() => showHelpText({ text: t('Overwrite files when exporting, if a file with the same name as the output file name exists?') })} />}
            </td>
          </tr>
        </tbody>
      </table>

      <h3 style={{ marginBottom: '.5em' }}>{t('Advanced options')}</h3>

      <table className={styles['options']}>
        <tbody>
          <tr>
            <td style={{ paddingTop: '.5em', color: 'var(--gray-11)', fontSize: '.9em' }} colSpan={2}>
              {t('Depending on your specific file/player, you may have to try different options for best results.')}
            </td>
            <td />
          </tr>

          <tr>
            <td>
              {t('Show advanced options')}
            </td>
            <td>
              <Switch checked={showAdvanced} onCheckedChange={setShowAdvanced} />
            </td>
            <td />
          </tr>

          {showAdvanced && (
            <>
              {areWeCutting && (
                <>
                  <AnimatedTr>
                    <td>
                      {t('Shift all start times')}
                    </td>
                    <td>
                      <ShiftTimes values={adjustCutFromValues} num={cutFromAdjustmentFrames} setNum={setCutFromAdjustmentFrames} />
                    </td>
                    <td>
                      <HelpIcon onClick={onCutFromAdjustmentFramesHelpPress} />
                    </td>
                  </AnimatedTr>
                  <AnimatedTr>
                    <td>
                      {t('Shift all end times')}
                    </td>
                    <td>
                      <ShiftTimes values={adjustCutToValues} num={cutToAdjustmentFrames} setNum={setCutToAdjustmentFrames} />
                    </td>
                    <td />
                  </AnimatedTr>
                </>
              )}

              {isMov && (
                <>
                  <AnimatedTr>
                    <td>
                      {t('Enable MOV Faststart?')}
                    </td>
                    <td>
                      <Switch checked={movFastStart} onCheckedChange={toggleMovFastStart} />
                      {renderNotice(notices.specific['movFastStart'], { style: { fontSize: '85%' } })}
                    </td>
                    <td>
                      {renderNoticeIcon(notices.specific['movFastStart'], rightIconStyle) ?? <HelpIcon onClick={onMovFastStartHelpPress} />}
                    </td>
                  </AnimatedTr>

                  <AnimatedTr>
                    <td>
                      {t('Preserve all MP4/MOV metadata?')}
                      {renderNotice(notices.specific['preserveMovData'], { style: { fontSize: '85%' } })}
                    </td>
                    <td>
                      <Switch checked={preserveMovData} onCheckedChange={togglePreserveMovData} />
                    </td>
                    <td>
                      {renderNoticeIcon(notices.specific['preserveMovData'], rightIconStyle) ?? <HelpIcon onClick={onPreserveMovDataHelpPress} />}
                    </td>
                  </AnimatedTr>

                  <AnimatedTr>
                    <td>
                      {t('Fix video codec tag / ID')}
                    </td>
                    <td>
                      <Select value={fixCodecTag} onChange={(e) => setFixCodecTag(e.target.value as FixCodecTagOption)} style={{ height: 20, marginLeft: 5 }}>
                        <option value={'auto' satisfies FixCodecTagOption}>{t('Auto')}</option>
                        <option value={'always' satisfies FixCodecTagOption}>{t('Always')}</option>
                        <option value={'never' satisfies FixCodecTagOption}>{t('Never')}</option>
                      </Select>
                    </td>
                    <td>
                      <HelpIcon onClick={onFixCodecTagHelpPress} />
                    </td>
                  </AnimatedTr>
                </>
              )}

              <AnimatedTr>
                <td>
                  {t('Preserve chapters')}
                </td>
                <td>
                  <Switch checked={preserveChapters} onCheckedChange={togglePreserveChapters} />
                </td>
                <td>
                  <HelpIcon onClick={onPreserveChaptersPress} />
                </td>
              </AnimatedTr>

              <AnimatedTr>
                <td>
                  {t('Preserve metadata')}
                </td>
                <td>
                  <Select value={preserveMetadata} onChange={(e) => setPreserveMetadata(e.target.value as PreserveMetadata)} style={{ height: 20, marginLeft: 5 }}>
                    <option value={'default' satisfies PreserveMetadata}>{t('Default')}</option>
                    <option value={'none' satisfies PreserveMetadata}>{t('None')}</option>
                    <option value={'nonglobal' satisfies PreserveMetadata}>{t('Non-global')}</option>
                  </Select>
                </td>
                <td>
                  <HelpIcon onClick={onPreserveMetadataHelpPress} />
                </td>
              </AnimatedTr>

              {willMerge && (
                <>
                  <AnimatedTr>
                    <td>
                      {t('Create chapters from merged segments? (slow)')}
                    </td>
                    <td>
                      <Switch checked={segmentsToChapters} onCheckedChange={toggleSegmentsToChapters} />
                    </td>
                    <td>
                      <HelpIcon onClick={onSegmentsToChaptersHelpPress} />
                    </td>
                  </AnimatedTr>

                  <AnimatedTr>
                    <td>
                      {t('Preserve original metadata when merging? (slow)')}
                    </td>
                    <td>
                      <Switch checked={preserveMetadataOnMerge} onCheckedChange={togglePreserveMetadataOnMerge} />
                    </td>
                    <td>
                      <HelpIcon onClick={onPreserveMetadataOnMergeHelpPress} />
                    </td>
                  </AnimatedTr>
                </>
              )}

              {areWeCutting && (
                <>
                  <AnimatedTr>
                    <td>
                      {t('Smart cut (experimental):')}
                      {renderNotice(notices.specific['smartCut'], { style: { fontSize: '85%' } })}
                    </td>
                    <td>
                      <Switch checked={enableSmartCut} onCheckedChange={() => setEnableSmartCut((v) => !v)} />
                    </td>
                    <td>
                      {renderNoticeIcon(notices.specific['smartCut'], rightIconStyle) ?? <HelpIcon onClick={onSmartCutHelpPress} />}
                    </td>
                  </AnimatedTr>

                  {!isEncoding && (
                    <AnimatedTr>
                      <td>
                        {t('Keyframe cut mode')}
                        {renderNotice(notices.specific['cutMode'], { style: { fontSize: '85%' } })}
                      </td>
                      <td>
                        <Switch checked={keyframeCut} onCheckedChange={() => toggleKeyframeCut()} />
                      </td>
                      <td>
                        {renderNoticeIcon(notices.specific['cutMode'], rightIconStyle) ?? <HelpIcon onClick={onKeyframeCutHelpPress} />}
                      </td>
                    </AnimatedTr>
                  )}
                </>
              )}


              {isEncoding && (
                <AnimatedTr>
                  <td>
                    {t('Smart cut auto detect bitrate')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {encBitrate != null && (
                        <>
                          <TextInput value={encBitrate} onChange={handleEncBitrateChange} style={{ width: '4em', flexGrow: 0, marginRight: '.3em' }} />
                          <span style={{ marginRight: '.3em' }}>{t('kbit/s')}</span>
                        </>
                      )}
                      <span><Switch checked={encBitrate == null} onCheckedChange={handleEncBitrateToggle} /></span>
                    </div>
                  </td>
                  <td />
                </AnimatedTr>
              )}

              {lossyMode != null && (
                <AnimatedTr>
                  <td>
                    {t('Lossy mode')}
                  </td>
                  <td>
                    <Switch disabled checked={lossyMode != null} />
                    <div>{lossyMode.videoEncoder}</div>
                  </td>
                  <td />
                </AnimatedTr>
              )}

              {!isEncoding && (
                <AnimatedTr>
                  <td>
                    &quot;ffmpeg&quot; <code className="highlighted">avoid_negative_ts</code>
                    {renderNotice(notices.specific['avoidNegativeTs'], { style: { fontSize: '85%' } })}
                  </td>
                  <td>
                    <Select value={avoidNegativeTs} onChange={(e) => setAvoidNegativeTs(e.target.value as AvoidNegativeTs)} style={{ height: 20, marginLeft: 5 }}>
                      <option value={'auto' satisfies AvoidNegativeTs}>auto</option>
                      <option value={'make_zero' satisfies AvoidNegativeTs}>make_zero</option>
                      <option value={'make_non_negative' satisfies AvoidNegativeTs}>make_non_negative</option>
                      <option value={'disabled' satisfies AvoidNegativeTs}>disabled</option>
                    </Select>
                  </td>
                  <td>
                    {renderNoticeIcon(notices.specific['avoidNegativeTs'], rightIconStyle) ?? <HelpIcon onClick={onAvoidNegativeTsHelpPress} />}
                  </td>
                </AnimatedTr>
              )}

              <AnimatedTr>
                <td>
                  {t('"ffmpeg" experimental flag')}
                </td>
                <td>
                  <Switch checked={ffmpegExperimental} onCheckedChange={setFfmpegExperimental} />
                </td>
                <td>
                  <HelpIcon onClick={onFfmpegExperimentalHelpPress} />
                </td>
              </AnimatedTr>

              <AnimatedTr>
                <td>
                  {t('More settings')}
                </td>
                <td>
                  <IoIosSettings size={24} role="button" onClick={toggleSettings} style={{ marginLeft: 5 }} />
                </td>
                <td />
              </AnimatedTr>
            </>
          )}
        </tbody>
      </table>
    </ExportSheet>
  );
}

export default memo(ExportConfirm);
