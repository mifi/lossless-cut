import React, { memo, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WarningSignIcon, Button, Select, CrossIcon } from 'evergreen-ui';
import { FaRegCheckCircle } from 'react-icons/fa';
import i18n from 'i18next';
import { useTranslation, Trans } from 'react-i18next';
import { IoIosHelpCircle } from 'react-icons/io';

import KeyframeCutButton from './components/KeyframeCutButton';
import ExportButton from './components/ExportButton';
import ExportModeButton from './components/ExportModeButton';
import PreserveMovDataButton from './components/PreserveMovDataButton';
import MovFastStartButton from './components/MovFastStartButton';
import ToggleExportConfirm from './components/ToggleExportConfirm';
import OutSegTemplateEditor from './components/OutSegTemplateEditor';
import HighlightedText from './components/HighlightedText';

import { withBlur } from './util';
import { toast } from './swal';
import { isMov as ffmpegIsMov } from './util/streams';
import useUserSettings from './hooks/useUserSettings';

const sheetStyle = {
  position: 'fixed',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  zIndex: 10,
  background: 'rgba(105, 105, 105, 0.7)',
  backdropFilter: 'blur(10px)',
  overflowY: 'scroll',
  display: 'flex',
};

const boxStyle = { margin: '15px 15px 50px 15px', background: 'rgba(25, 25, 25, 0.6)', borderRadius: 10, padding: '10px 20px', minHeight: 500, position: 'relative' };

const outDirStyle = { background: 'rgb(193, 98, 0)', borderRadius: '.4em', padding: '0 .3em', wordBreak: 'break-all', cursor: 'pointer' };

const warningStyle = { color: '#faa', fontSize: '80%' };

const HelpIcon = ({ onClick, style }) => <IoIosHelpCircle size={20} role="button" onClick={withBlur(onClick)} style={{ cursor: 'pointer', verticalAlign: 'middle', marginLeft: 5, ...style }} />;

const ExportConfirm = memo(({
  areWeCutting, selectedSegments, segmentsToExport, willMerge, visible, onClosePress, onExportConfirm,
  outFormat, renderOutFmt, outputDir, numStreamsTotal, numStreamsToCopy, setStreamsSelectorShown, outSegTemplate,
  setOutSegTemplate, generateOutSegFileNames, filePath, currentSegIndexSafe, getOutSegError, nonFilteredSegments,
  mainCopiedThumbnailStreams,
}) => {
  const { t } = useTranslation();

  const { changeOutDir, keyframeCut, preserveMovData, movFastStart, avoidNegativeTs, setAvoidNegativeTs, autoDeleteMergedSegments, exportConfirmEnabled, toggleExportConfirmEnabled, segmentsToChapters, toggleSegmentsToChapters, preserveMetadataOnMerge, togglePreserveMetadataOnMerge, enableSmartCut, setEnableSmartCut, effectiveExportMode } = useUserSettings();

  const isMov = ffmpegIsMov(outFormat);
  const isIpod = outFormat === 'ipod';

  // some thumbnail streams (png,jpg etc) cannot always be cut correctly, so we warn if they try to.
  const areWeCuttingProblematicStreams = areWeCutting && mainCopiedThumbnailStreams.length > 0;

  const exportModeDescription = useMemo(() => ({
    sesgments_to_chapters: t('Don\'t cut the file, but instead export an unmodified original which has chapters generated from segments'),
    merge: t('Auto merge segments to one file after export'),
    'merge+separate': t('Auto merge segments to one file after export, but keep segments too'),
    separate: t('Export to separate files'),
  })[effectiveExportMode], [effectiveExportMode, t]);

  const onPreserveMovDataHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('Preserve all MOV/MP4 metadata tags (e.g. EXIF, GPS position etc.) from source file? Note that some players have trouble playing back files where all metadata is preserved, like iTunes and other Apple software') });
  }, []);

  const onMovFastStartHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('Enable this to allow faster playback of the resulting file. This may cause processing to take a little longer') });
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
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('You can customize the file name of the output segment(s) using special variables.') });
  }, []);

  const onExportModeHelpPress = useCallback(() => {
    toast.fire({ icon: 'info', timer: 10000, text: exportModeDescription });
  }, [exportModeDescription]);

  const onAvoidNegativeTsHelpPress = useCallback(() => {
    // https://ffmpeg.org/ffmpeg-all.html#Format-Options
    const texts = {
      make_non_negative: i18n.t('Shift timestamps to make them non-negative. Also note that this affects only leading negative timestamps, and not non-monotonic negative timestamps.'),
      make_zero: i18n.t('Shift timestamps so that the first timestamp is 0. (LosslessCut default)'),
      auto: i18n.t('Enables shifting when required by the target format.'),
      disabled: i18n.t('Disables shifting of timestamp.'),
    };
    toast.fire({ icon: 'info', timer: 10000, text: `${avoidNegativeTs}: ${texts[avoidNegativeTs]}` });
  }, [avoidNegativeTs]);

  const outSegTemplateHelpIcon = <HelpIcon onClick={onOutSegTemplateHelpPress} />;

  const canEditTemplate = !willMerge || !autoDeleteMergedSegments;

  // https://stackoverflow.com/questions/33454533/cant-scroll-to-top-of-flex-item-that-is-overflowing-container
  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={sheetStyle}
            transition={{ duration: 0.3, easings: ['easeOut'] }}
          >
            <div style={{ margin: 'auto' }}>
              <div style={boxStyle}>
                <CrossIcon size={24} style={{ position: 'absolute', right: 0, top: 0, padding: 15, boxSizing: 'content-box', cursor: 'pointer' }} role="button" onClick={onClosePress} />

                <h2 style={{ marginTop: 0, marginBottom: '.5em' }}>{t('Export options')}</h2>
                <ul style={{ margin: 0 }}>
                  {selectedSegments.length !== nonFilteredSegments.length && <li><FaRegCheckCircle size={12} style={{ marginRight: 3 }} />{t('{{selectedSegments}} of {{nonFilteredSegments}} segments selected', { selectedSegments: selectedSegments.length, nonFilteredSegments: nonFilteredSegments.length })}</li>}
                  <li>
                    {t('Merge {{segments}} cut segments to one file?', { segments: selectedSegments.length })} <ExportModeButton selectedSegments={selectedSegments} />
                    <HelpIcon onClick={onExportModeHelpPress} />
                    {effectiveExportMode === 'sesgments_to_chapters' && <WarningSignIcon verticalAlign="middle" color="warning" marginLeft=".3em" title={i18n.t('Chapters only')} />}
                  </li>
                  <li>
                    {t('Output container format:')} {renderOutFmt({ height: 20, maxWidth: 150 })}
                    <HelpIcon onClick={onOutFmtHelpPress} />
                  </li>
                  <li>
                    <Trans>Input has {{ numStreamsTotal }} tracks - <HighlightedText style={{ cursor: 'pointer' }} onClick={() => setStreamsSelectorShown(true)}>Keeping {{ numStreamsToCopy }} tracks</HighlightedText></Trans>
                    <HelpIcon onClick={onTracksHelpPress} />
                    {areWeCuttingProblematicStreams && <WarningSignIcon verticalAlign="middle" color="warning" marginLeft=".3em" />}
                    {areWeCuttingProblematicStreams && <div style={warningStyle}><Trans>Warning: Cutting thumbnail tracks is known to cause problems. Consider disabling track {{ trackNumber: mainCopiedThumbnailStreams[0].index + 1 }}.</Trans></div>}
                  </li>
                  <li>
                    {t('Save output to path:')} <span role="button" onClick={changeOutDir} style={outDirStyle}>{outputDir}</span>
                  </li>
                  {canEditTemplate && (
                    <li>
                      <OutSegTemplateEditor filePath={filePath} helpIcon={outSegTemplateHelpIcon} outSegTemplate={outSegTemplate} setOutSegTemplate={setOutSegTemplate} generateOutSegFileNames={generateOutSegFileNames} currentSegIndexSafe={currentSegIndexSafe} getOutSegError={getOutSegError} />
                    </li>
                  )}
                </ul>

                <h3 style={{ marginBottom: '.5em' }}>{t('Advanced options')}</h3>

                {willMerge && (
                  <ul style={{ marginTop: 0, marginBottom: '1em' }}>
                    <li>
                      {t('Create chapters from merged segments? (slow)')} <Button height={20} onClick={toggleSegmentsToChapters}>{segmentsToChapters ? t('Yes') : t('No')}</Button>
                      <HelpIcon onClick={onSegmentsToChaptersHelpPress} />
                    </li>
                    <li>
                      {t('Preserve original metadata when merging? (slow)')} <Button height={20} onClick={togglePreserveMetadataOnMerge}>{preserveMetadataOnMerge ? t('Yes') : t('No')}</Button>
                      <HelpIcon onClick={onPreserveMetadataOnMergeHelpPress} />
                    </li>
                  </ul>
                )}

                <p style={{ margin: '.5em 0' }}>{t('Depending on your specific file/player, you may have to try different options for best results.')}</p>

                <ul style={{ margin: 0 }}>
                  {areWeCutting && (
                    <>
                      <li>
                        {t('Smart cut (experimental):')} <Button height={20} onClick={() => setEnableSmartCut((v) => !v)}>{enableSmartCut ? t('Yes') : t('No')}</Button>
                        <HelpIcon onClick={onSmartCutHelpPress} />
                        {enableSmartCut && <WarningSignIcon verticalAlign="middle" color="warning" marginLeft=".3em" title={i18n.t('Experimental functionality has been activated!')} />}
                      </li>
                      {!enableSmartCut && (
                        <li>
                          {t('Cut mode:')} <KeyframeCutButton />
                          <HelpIcon onClick={onKeyframeCutHelpPress} /> {!keyframeCut && <span style={warningStyle}>{t('Note: Keyframe cut is recommended for most common files')}</span>}
                        </li>
                      )}
                    </>
                  )}

                  {isMov && (
                    <>
                      <li>
                        {t('Enable MOV Faststart?')} <MovFastStartButton />
                        <HelpIcon onClick={onMovFastStartHelpPress} /> {isIpod && !movFastStart && <span style={warningStyle}>{t('For the ipod format, it is recommended to activate this option')}</span>}
                      </li>
                      <li>
                        {t('Preserve all MP4/MOV metadata?')} <PreserveMovDataButton />
                        <HelpIcon onClick={onPreserveMovDataHelpPress} /> {isIpod && preserveMovData && <span style={warningStyle}>{t('For the ipod format, it is recommended to deactivate this option')}</span>}
                      </li>
                    </>
                  )}

                  {!enableSmartCut && (
                    <li>
                      &quot;avoid_negative_ts&quot;
                      <Select height={20} value={avoidNegativeTs} onChange={(e) => setAvoidNegativeTs(e.target.value)} style={{ marginLeft: 5 }}>
                        <option value="auto">auto</option>
                        <option value="make_zero">make_zero</option>
                        <option value="make_non_negative">make_non_negative</option>
                        <option value="disabled">disabled</option>
                      </Select>
                      <HelpIcon onClick={onAvoidNegativeTsHelpPress} />
                      {!['make_zero', 'auto'].includes(avoidNegativeTs) && <div style={warningStyle}>{t('It\'s generally recommended to set this to one of: {{values}}', { values: '"auto", "make_zero"' })}</div>}
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </motion.div>

          <div style={{ zIndex: 11, position: 'fixed', right: 0, bottom: 0, display: 'flex', alignItems: 'center', margin: 5 }}>
            <motion.div
              initial={{ opacity: 0, translateX: 50 }}
              animate={{ opacity: 1, translateX: 0 }}
              exit={{ opacity: 0, translateX: 50 }}
              transition={{ duration: 0.4, easings: ['easeOut'] }}
              style={{ display: 'flex', alignItems: 'flex-end' }}
            >
              <ToggleExportConfirm size={25} />
              <div style={{ fontSize: 13, marginLeft: 3, marginRight: 7, maxWidth: 120, lineHeight: '100%', color: exportConfirmEnabled ? 'white' : 'rgba(255,255,255,0.3)', cursor: 'pointer' }} role="button" onClick={toggleExportConfirmEnabled}>{t('Show this page before exporting?')}</div>
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
});

export default ExportConfirm;
