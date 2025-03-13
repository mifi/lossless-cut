import { CSSProperties, Dispatch, SetStateAction, memo, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WarningSignIcon, CrossIcon, InfoSignIcon } from 'evergreen-ui';
import { FaRegCheckCircle } from 'react-icons/fa';
import i18n from 'i18next';
import { useTranslation, Trans } from 'react-i18next';
import { IoIosHelpCircle, IoIosSettings } from 'react-icons/io';
import type { SweetAlertIcon } from 'sweetalert2';

import ExportButton from './ExportButton';
import ExportModeButton from './ExportModeButton';
import ToggleExportConfirm from './ToggleExportConfirm';
import FileNameTemplateEditor from './FileNameTemplateEditor';
import HighlightedText, { highlightedTextStyle } from './HighlightedText';
import Select from './Select';
import Switch from './Switch';

import { primaryTextColor } from '../colors';
import { withBlur } from '../util';
import { toast } from '../swal';
import { isMov as ffmpegIsMov } from '../util/streams';
import useUserSettings from '../hooks/useUserSettings';
import styles from './ExportConfirm.module.css';
import { SegmentToExport } from '../types';
import { defaultMergedFileTemplate, defaultOutSegTemplate, GenerateOutFileNames } from '../util/outputNameTemplate';
import { FFprobeStream } from '../../../../ffprobe';
import { AvoidNegativeTs, PreserveMetadata } from '../../../../types';
import TextInput from './TextInput';
import { UseSegments } from '../hooks/useSegments';


const boxStyle: CSSProperties = { margin: '15px 15px 50px 15px', borderRadius: 10, padding: '10px 20px', minHeight: 500, position: 'relative' };

const outDirStyle: CSSProperties = { ...highlightedTextStyle, wordBreak: 'break-all', cursor: 'pointer' };

const warningStyle: CSSProperties = { color: 'var(--orange8)', fontSize: '80%', marginBottom: '.5em' };

const infoStyle: CSSProperties = { color: 'var(--grey12)', fontSize: '80%', marginBottom: '.5em' };

const adjustCutFromValues = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const adjustCutToValues = [-10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const HelpIcon = ({ onClick, style }: { onClick: () => void, style?: CSSProperties }) => <IoIosHelpCircle size={20} role="button" onClick={withBlur(onClick)} style={{ cursor: 'pointer', color: primaryTextColor, verticalAlign: 'middle', ...style }} />;

function ShiftTimes({ values, num, setNum }: { values: number[], num: number, setNum: (n: number) => void }) {
  const { t } = useTranslation();
  return (
    <Select value={num} onChange={(e) => setNum(Number(e.target.value))} style={{ height: 20, marginLeft: 5 }}>
      {values.map((v) => <option key={v} value={v}>{t('{{numFrames}} frames', { numFrames: v >= 0 ? `+${v}` : v, count: v })}</option>)}
    </Select>
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
  outSegTemplate,
  setOutSegTemplate,
  mergedFileTemplate,
  setMergedFileTemplate,
  generateOutSegFileNames,
  generateMergedFileNames,
  currentSegIndexSafe,
  segmentsOrInverse,
  mainCopiedThumbnailStreams,
  needSmartCut,
  smartCutBitrate,
  setSmartCutBitrate,
  toggleSettings,
  outputPlaybackRate,
} : {
  areWeCutting: boolean,
  segmentsToExport: SegmentToExport[],
  willMerge: boolean,
  visible: boolean,
  onClosePress: () => void,
  onExportConfirm: () => void,
  outFormat: string | undefined,
  renderOutFmt: (style: CSSProperties) => JSX.Element,
  outputDir: string,
  numStreamsTotal: number,
  numStreamsToCopy: number,
  onShowStreamsSelectorClick: () => void,
  outSegTemplate: string,
  setOutSegTemplate: (a: string) => void,
  mergedFileTemplate: string,
  setMergedFileTemplate: (a: string) => void,
  generateOutSegFileNames: GenerateOutFileNames,
  generateMergedFileNames: GenerateOutFileNames,
  currentSegIndexSafe: number,
  segmentsOrInverse: UseSegments['segmentsOrInverse'],
  mainCopiedThumbnailStreams: FFprobeStream[],
  needSmartCut: boolean,
  smartCutBitrate: number | undefined,
  setSmartCutBitrate: Dispatch<SetStateAction<number | undefined>>,
  toggleSettings: () => void,
  outputPlaybackRate: number,
}) {
  const { t } = useTranslation();

  const { changeOutDir, keyframeCut, toggleKeyframeCut, preserveMovData, setPreserveMovData, preserveMetadata, setPreserveMetadata, preserveChapters, setPreserveChapters, movFastStart, setMovFastStart, avoidNegativeTs, setAvoidNegativeTs, autoDeleteMergedSegments, exportConfirmEnabled, toggleExportConfirmEnabled, segmentsToChapters, setSegmentsToChapters, preserveMetadataOnMerge, setPreserveMetadataOnMerge, enableSmartCut, setEnableSmartCut, effectiveExportMode, enableOverwriteOutput, setEnableOverwriteOutput, ffmpegExperimental, setFfmpegExperimental, cutFromAdjustmentFrames, setCutFromAdjustmentFrames, cutToAdjustmentFrames, setCutToAdjustmentFrames } = useUserSettings();

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
    const ret: { warning?: true, text: string }[] = [];
    if (!areWeCutting) {
      ret.push({ text: t('Exporting whole file without cutting, because there are no segments to export.') });
    }
    // https://github.com/mifi/lossless-cut/issues/1809
    if (areWeCutting && outFormat === 'flac') {
      ret.push({ warning: true, text: t('There is a known issue in FFmpeg with cutting FLAC files. The file will be re-encoded, which is still lossless, but the export may be slower.') });
    }
    if (areWeCutting && outputPlaybackRate !== 1) {
      ret.push({ warning: true, text: t('Adjusting the output FPS and cutting at the same time will cause incorrect cuts. Consider instead doing it in two separate steps.') });
    }
    return ret;
  }, [areWeCutting, outFormat, outputPlaybackRate, t]);

  const exportModeDescription = useMemo(() => ({
    segments_to_chapters: t('Don\'t cut the file, but instead export an unmodified original which has chapters generated from segments'),
    merge: t('Auto merge segments to one file after export'),
    'merge+separate': t('Auto merge segments to one file after export, but keep segments too'),
    separate: t('Export to separate files'),
  })[effectiveExportMode], [effectiveExportMode, t]);

  const showHelpText = useCallback(({ icon = 'info', timer = 10000, text }: { icon?: SweetAlertIcon, timer?: number, text: string }) => toast.fire({ icon, timer, text }), []);

  const onPreserveChaptersPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('Whether to preserve chapters from source file.') });
  }, []);

  const onPreserveMovDataHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('Preserve all MOV/MP4 metadata tags (e.g. EXIF, GPS position etc.) from source file? Note that some players have trouble playing back files where all metadata is preserved, like iTunes and other Apple software') });
  }, []);

  const onPreserveMetadataHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('Whether to preserve metadata from source file. Default: Global (file metadata), per-track and per-chapter metadata will be copied. Non-global: Only per-track and per-chapter metadata will be copied. None: No metadata will be copied') });
  }, []);

  const onMovFastStartHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('Enabling this will allow faster playback of the exported file. This makes processing use 3 times as much export I/O, which is negligible for small files but might slow down exporting of large files.') });
  }, []);

  const onOutFmtHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('Defaults to same format as input file. You can losslessly change the file format (container) of the file with this option. Not all formats support all codecs. Matroska/MP4/MOV support the most common codecs. Sometimes it\'s even impossible to export to the same output format as input.') });
  }, []);

  const onKeyframeCutHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('With "keyframe cut", we will cut at the nearest keyframe before the desired start cutpoint. This is recommended for most files. With "Normal cut" you may have to manually set the cutpoint a few frames before the next keyframe to achieve a precise cut') });
  }, []);

  const onSmartCutHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('This experimental feature will re-encode the part of the video from the cutpoint until the next keyframe in order to attempt to make a 100% accurate cut. Only works on some files. I\'ve had success with some h264 files, and only a few h265 files. See more here: {{url}}', { url: 'https://github.com/mifi/lossless-cut/issues/126' }) });
  }, []);

  const onTracksHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('Not all formats support all track types, and LosslessCut is unable to properly cut some track types, so you may have to sacrifice some tracks by disabling them in order to get correct result.') });
  }, []);

  const onSegmentsToChaptersHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('When merging, do you want to create chapters in the merged file, according to the cut segments? NOTE: This may dramatically increase processing time') });
  }, []);

  const onPreserveMetadataOnMergeHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('When merging, do you want to preserve metadata from your original file? NOTE: This may dramatically increase processing time') });
  }, []);

  const onOutSegTemplateHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('You can customize the file name of the output segment(s) using special variables.', { count: segmentsToExport.length }) });
  }, [segmentsToExport.length]);

  const onMergedFileTemplateHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('You can customize the file name of the merged file using special variables.') });
  }, []);

  const onExportModeHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: exportModeDescription });
  }, [exportModeDescription]);

  const onAvoidNegativeTsHelpPress = useCallback(() => {
    // https://ffmpeg.org/ffmpeg-all.html#Format-Options
    // https://github.com/mifi/lossless-cut/issues/1206
    const texts = {
      make_non_negative: i18n.t('Shift timestamps to make them non-negative. Also note that this affects only leading negative timestamps, and not non-monotonic negative timestamps.'),
      make_zero: i18n.t('Shift timestamps so that the first timestamp is 0. (LosslessCut default)'),
      auto: i18n.t('Enables shifting when required by the target format.'),
      disabled: i18n.t('Disables shifting of timestamp.'),
    };
    toast.fire({ icon: 'info', timer: 10000, text: `${avoidNegativeTs}: ${texts[avoidNegativeTs]}` });
  }, [avoidNegativeTs]);

  const onCutFromAdjustmentFramesHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('This option allows you to shift all segment start times forward by one or more frames before cutting. This can be useful if the output video starts from the wrong (preceding) keyframe.') });
  }, []);

  const onFfmpegExperimentalHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: t('Enable experimental ffmpeg features flag?') });
  }, [t]);

  const canEditSegTemplate = !willMerge || !autoDeleteMergedSegments;

  const handleSmartCutBitrateToggle = useCallback((checked: boolean) => {
    setSmartCutBitrate(() => (checked ? undefined : 10000));
  }, [setSmartCutBitrate]);

  const handleSmartCutBitrateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (Number.isNaN(v) || v <= 0) return;
    setSmartCutBitrate(v);
  }, [setSmartCutBitrate]);

  // https://stackoverflow.com/questions/33454533/cant-scroll-to-top-of-flex-item-that-is-overflowing-container
  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles['sheet']}
            transition={{ duration: 0.3, easings: ['easeOut'] }}
          >
            <div style={{ margin: 'auto' }}>
              <div style={boxStyle} className={styles['box']}>
                <CrossIcon size={24} style={{ position: 'absolute', right: 0, top: 0, padding: 15, boxSizing: 'content-box', cursor: 'pointer' }} role="button" onClick={onClosePress} />

                <h2 style={{ marginTop: 0, marginBottom: '.5em' }}>{t('Export options')}</h2>

                <table className={styles['options']}>
                  <tbody>
                    {notices.map(({ warning, text }) => (
                      <tr key={text}>
                        <td colSpan={2}>
                          <div style={{ ...(warning ? warningStyle : infoStyle), display: 'flex', alignItems: 'center', gap: '0 .5em' }}>
                            {warning ? (
                              <WarningSignIcon verticalAlign="middle" color="warning" flexShrink="0" />
                            ) : (
                              <InfoSignIcon verticalAlign="middle" color="info" flexShrink="0" />
                            )} {text}
                          </div>
                        </td>
                        <td />
                      </tr>
                    ))}

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
                      </td>
                      <td>
                        <ExportModeButton selectedSegments={segmentsOrInverse.selected} />
                      </td>
                      <td>
                        {effectiveExportMode === 'segments_to_chapters' ? (
                          <WarningSignIcon verticalAlign="middle" color="warning" title={i18n.t('Segments to chapters mode is active, this means that the file will not be cut. Instead chapters will be created from the segments.')} />
                        ) : (
                          <HelpIcon onClick={onExportModeHelpPress} />
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td>
                        {t('Output container format:')}
                      </td>
                      <td>
                        {renderOutFmt({ height: 20, maxWidth: 150 })}
                      </td>
                      <td>
                        <HelpIcon onClick={onOutFmtHelpPress} />
                      </td>
                    </tr>

                    <tr>
                      <td>
                        <Trans>Input has {{ numStreamsTotal }} tracks</Trans>
                        {areWeCuttingProblematicStreams && (
                          <div style={warningStyle}><Trans>Warning: Cutting thumbnail tracks is known to cause problems. Consider disabling track {{ trackNumber: mainCopiedThumbnailStreams[0] ? mainCopiedThumbnailStreams[0].index + 1 : 0 }}.</Trans></div>
                        )}
                      </td>
                      <td>
                        <HighlightedText style={{ cursor: 'pointer' }} onClick={onShowStreamsSelectorClick}><Trans>Keeping {{ numStreamsToCopy }} tracks</Trans></HighlightedText>
                      </td>
                      <td>
                        {areWeCuttingProblematicStreams ? (
                          <WarningSignIcon verticalAlign="middle" color="warning" />
                        ) : (
                          <HelpIcon onClick={onTracksHelpPress} />
                        )}
                      </td>
                    </tr>

                    <tr>
                      <td>
                        {t('Save output to path:')}
                      </td>
                      <td>
                        <span role="button" onClick={changeOutDir} style={outDirStyle}>{outputDir}</span>
                      </td>
                      <td />
                    </tr>

                    {canEditSegTemplate && (
                      <tr>
                        <td colSpan={2}>
                          <FileNameTemplateEditor template={outSegTemplate} setTemplate={setOutSegTemplate} defaultTemplate={defaultOutSegTemplate} generateFileNames={generateOutSegFileNames} currentSegIndexSafe={currentSegIndexSafe} />
                        </td>
                        <td>
                          <HelpIcon onClick={onOutSegTemplateHelpPress} />
                        </td>
                      </tr>
                    )}

                    {willMerge && (
                      <tr>
                        <td colSpan={2}>
                          <FileNameTemplateEditor template={mergedFileTemplate} setTemplate={setMergedFileTemplate} defaultTemplate={defaultMergedFileTemplate} generateFileNames={generateMergedFileNames} mergeMode />
                        </td>
                        <td>
                          <HelpIcon onClick={onMergedFileTemplateHelpPress} />
                        </td>
                      </tr>
                    )}

                    <tr>
                      <td>
                        {t('Overwrite existing files')}
                      </td>
                      <td>
                        <Switch checked={enableOverwriteOutput} onCheckedChange={setEnableOverwriteOutput} />
                      </td>
                      <td>
                        <HelpIcon onClick={() => showHelpText({ text: t('Overwrite files when exporting, if a file with the same name as the output file name exists?') })} />
                      </td>
                    </tr>
                  </tbody>
                </table>

                <h3 style={{ marginBottom: '.5em' }}>{t('Advanced options')}</h3>

                <table className={styles['options']}>
                  <tbody>

                    {areWeCutting && (
                      <>
                        <tr>
                          <td>
                            {t('Shift all start times')}
                          </td>
                          <td>
                            <ShiftTimes values={adjustCutFromValues} num={cutFromAdjustmentFrames} setNum={setCutFromAdjustmentFrames} />
                          </td>
                          <td>
                            <HelpIcon onClick={onCutFromAdjustmentFramesHelpPress} />
                          </td>
                        </tr>
                        <tr>
                          <td>
                            {t('Shift all end times')}
                          </td>
                          <td>
                            <ShiftTimes values={adjustCutToValues} num={cutToAdjustmentFrames} setNum={setCutToAdjustmentFrames} />
                          </td>
                          <td />
                        </tr>
                      </>
                    )}

                    {isMov && (
                      <>
                        <tr>
                          <td>
                            {t('Enable MOV Faststart?')}
                          </td>
                          <td>
                            <Switch checked={movFastStart} onCheckedChange={toggleMovFastStart} />
                            {isIpod && !movFastStart && <div style={warningStyle}>{t('For the ipod format, it is recommended to activate this option')}</div>}
                          </td>
                          <td>
                            {isIpod && !movFastStart ? (
                              <WarningSignIcon verticalAlign="middle" color="warning" />
                            ) : (
                              <HelpIcon onClick={onMovFastStartHelpPress} />
                            )}
                          </td>
                        </tr>

                        <tr>
                          <td>
                            {t('Preserve all MP4/MOV metadata?')}
                            {isIpod && preserveMovData && <div style={warningStyle}>{t('For the ipod format, it is recommended to deactivate this option')}</div>}
                          </td>
                          <td>
                            <Switch checked={preserveMovData} onCheckedChange={togglePreserveMovData} />
                          </td>
                          <td>
                            {isIpod && preserveMovData ? (
                              <WarningSignIcon verticalAlign="middle" color="warning" />
                            ) : (
                              <HelpIcon onClick={onPreserveMovDataHelpPress} />
                            )}
                          </td>
                        </tr>
                      </>
                    )}

                    <tr>
                      <td>
                        {t('Preserve chapters')}
                      </td>
                      <td>
                        <Switch checked={preserveChapters} onCheckedChange={togglePreserveChapters} />
                      </td>
                      <td>
                        <HelpIcon onClick={onPreserveChaptersPress} />
                      </td>
                    </tr>

                    <tr>
                      <td>
                        {t('Preserve metadata')}
                      </td>
                      <td>
                        <Select value={preserveMetadata} onChange={(e) => setPreserveMetadata(e.target.value as PreserveMetadata)} style={{ height: 20, marginLeft: 5 }}>
                          <option value={'default' as PreserveMetadata}>{t('Default')}</option>
                          <option value={'none' satisfies PreserveMetadata}>{t('None')}</option>
                          <option value={'nonglobal' satisfies PreserveMetadata}>{t('Non-global')}</option>
                        </Select>
                      </td>
                      <td>
                        <HelpIcon onClick={onPreserveMetadataHelpPress} />
                      </td>
                    </tr>

                    {willMerge && (
                      <>
                        <tr>
                          <td>
                            {t('Create chapters from merged segments? (slow)')}
                          </td>
                          <td>
                            <Switch checked={segmentsToChapters} onCheckedChange={toggleSegmentsToChapters} />
                          </td>
                          <td>
                            <HelpIcon onClick={onSegmentsToChaptersHelpPress} />
                          </td>
                        </tr>

                        <tr>
                          <td>
                            {t('Preserve original metadata when merging? (slow)')}
                          </td>
                          <td>
                            <Switch checked={preserveMetadataOnMerge} onCheckedChange={togglePreserveMetadataOnMerge} />
                          </td>
                          <td>
                            <HelpIcon onClick={onPreserveMetadataOnMergeHelpPress} />
                          </td>
                        </tr>
                      </>
                    )}

                    <tr>
                      <td style={{ paddingTop: '.5em', color: 'var(--gray11)', fontSize: '.9em' }} colSpan={2}>
                        {t('Depending on your specific file/player, you may have to try different options for best results.')}
                      </td>
                      <td />
                    </tr>

                    {areWeCutting && (
                      <>
                        <tr>
                          <td>
                            {t('Smart cut (experimental):')}
                            {needSmartCut && <div style={warningStyle}>{t('Smart cut is experimental and will not work on all files.')}</div>}
                          </td>
                          <td>

                            <Switch checked={enableSmartCut} onCheckedChange={() => setEnableSmartCut((v) => !v)} />
                          </td>
                          <td>
                            {needSmartCut ? (
                              <WarningSignIcon verticalAlign="middle" color="warning" title={i18n.t('Experimental functionality has been activated!')} />
                            ) : (
                              <HelpIcon onClick={onSmartCutHelpPress} />
                            )}
                          </td>
                        </tr>

                        {needSmartCut && (
                          <tr>
                            <td>
                              {t('Smart cut auto detect bitrate')}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                {smartCutBitrate != null && (
                                  <>
                                    <TextInput value={smartCutBitrate} onChange={handleSmartCutBitrateChange} style={{ width: '4em', flexGrow: 0, marginRight: '.3em' }} />
                                    <span style={{ marginRight: '.3em' }}>{t('kbit/s')}</span>
                                  </>
                                )}
                                <span><Switch checked={smartCutBitrate == null} onCheckedChange={handleSmartCutBitrateToggle} /></span>
                              </div>
                            </td>
                            <td />
                          </tr>
                        )}

                        {!needSmartCut && (
                          <tr>
                            <td>
                              {t('Keyframe cut mode')}
                              {!keyframeCut && <div style={warningStyle}>{t('Note: Keyframe cut is recommended for most common files')}</div>}
                            </td>
                            <td>
                              <Switch checked={keyframeCut} onCheckedChange={() => toggleKeyframeCut()} />
                            </td>
                            <td>
                              {!keyframeCut ? (
                                <WarningSignIcon verticalAlign="middle" color="warning" />
                              ) : (
                                <HelpIcon onClick={onKeyframeCutHelpPress} />
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    )}

                    {!needSmartCut && (() => {
                      const avoidNegativeTsWarn = (() => {
                        if (willMerge) {
                          if (avoidNegativeTs !== 'make_non_negative') {
                            return t('When merging, it\'s generally recommended to set this to "make_non_negative"');
                          }
                          return undefined;
                        }
                        if (!['make_zero', 'auto'].includes(avoidNegativeTs)) {
                          return t('It\'s generally recommended to set this to one of: {{values}}', { values: '"auto", "make_zero"' });
                        }
                        return undefined;
                      })();

                      return (
                        <tr>
                          <td>
                            &quot;ffmpeg&quot; <code className="highlighted">avoid_negative_ts</code>
                            {avoidNegativeTsWarn != null && <div style={warningStyle}>{avoidNegativeTsWarn}</div>}
                          </td>
                          <td>
                            <Select value={avoidNegativeTs} onChange={(e) => setAvoidNegativeTs(e.target.value as AvoidNegativeTs)} style={{ height: 20, marginLeft: 5 }}>
                              <option value={'auto' as AvoidNegativeTs}>auto</option>
                              <option value={'make_zero' satisfies AvoidNegativeTs}>make_zero</option>
                              <option value={'make_non_negative' satisfies AvoidNegativeTs}>make_non_negative</option>
                              <option value={'disabled' satisfies AvoidNegativeTs}>disabled</option>
                            </Select>
                          </td>
                          <td>
                            {avoidNegativeTsWarn != null ? (
                              <WarningSignIcon verticalAlign="middle" color="warning" />
                            ) : (
                              <HelpIcon onClick={onAvoidNegativeTsHelpPress} />
                            )}
                          </td>
                        </tr>
                      );
                    })()}

                    <tr>
                      <td>
                        {t('"ffmpeg" experimental flag')}
                      </td>
                      <td>
                        <Switch checked={ffmpegExperimental} onCheckedChange={setFfmpegExperimental} />
                      </td>
                      <td>
                        <HelpIcon onClick={onFfmpegExperimentalHelpPress} />
                      </td>
                    </tr>

                    <tr>
                      <td>
                        {t('More settings')}
                      </td>
                      <td>
                        <IoIosSettings size={24} role="button" onClick={toggleSettings} style={{ marginLeft: 5 }} />
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>

          <div style={{ position: 'fixed', right: 0, bottom: 0, display: 'flex', alignItems: 'center', margin: 5 }}>
            <motion.div
              initial={{ opacity: 0, translateX: 50 }}
              animate={{ opacity: 1, translateX: 0 }}
              exit={{ opacity: 0, translateX: 50 }}
              transition={{ duration: 0.4, easings: ['easeOut'] }}
              style={{ display: 'flex', alignItems: 'flex-end', background: 'var(--gray2)' }}
            >
              <ToggleExportConfirm size={25} />
              <div style={{ fontSize: 13, marginLeft: 3, marginRight: 7, maxWidth: 120, lineHeight: '100%', color: exportConfirmEnabled ? 'var(--gray12)' : 'var(--gray11)', cursor: 'pointer' }} role="button" onClick={toggleExportConfirmEnabled}>{t('Show this page before exporting?')}</div>
            </motion.div>

            <motion.div
              style={{ transformOrigin: 'bottom right' }}
              initial={{ scale: 0.7, opacity: 1 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.4, easings: ['easeOut'] }}
            >
              <ExportButton segmentsToExport={segmentsToExport} areWeCutting={areWeCutting} onClick={() => onExportConfirm()} size={1.7} />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default memo(ExportConfirm);
