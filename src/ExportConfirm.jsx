import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Select, CrossIcon } from 'evergreen-ui';
import i18n from 'i18next';
import { useTranslation, Trans } from 'react-i18next';
import { IoIosHelpCircle } from 'react-icons/io';

import KeyframeCutButton from './components/KeyframeCutButton';
import ExportButton from './components/ExportButton';
import MergeExportButton from './components/MergeExportButton';
import PreserveMovDataButton from './components/PreserveMovDataButton';
import MovFastStartButton from './components/MovFastStartButton';
import ToggleExportConfirm from './components/ToggleExportConfirm';
import OutSegTemplateEditor from './components/OutSegTemplateEditor';
import HighlightedText from './components/HighlightedText';

import { withBlur, toast } from './util';
import { isMov as ffmpegIsMov } from './ffmpeg';

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

const boxStyle = { margin: '15px 15px 50px 15px', background: 'rgba(25, 25, 25, 0.6)', borderRadius: 10, padding: '10px 20px', minHeight: 450, position: 'relative' };

const outDirStyle = { background: 'rgb(193, 98, 0)', borderRadius: '.4em', padding: '0 .3em', wordBreak: 'break-all', cursor: 'pointer' };

const warningStyle = { color: '#faa', fontSize: '80%' };

const HelpIcon = ({ onClick }) => <IoIosHelpCircle size={20} role="button" onClick={withBlur(onClick)} style={{ cursor: 'pointer', verticalAlign: 'middle', marginLeft: 5 }} />;

const ExportConfirm = memo(({
  autoMerge, areWeCutting, enabledOutSegments, visible, onClosePress, onExportConfirm, keyframeCut, toggleKeyframeCut,
  setAutoMerge, renderOutFmt, preserveMovData, togglePreserveMovData, movFastStart, toggleMovFastStart, avoidNegativeTs, setAvoidNegativeTs,
  changeOutDir, outputDir, numStreamsTotal, numStreamsToCopy, setStreamsSelectorShown,
  exportConfirmEnabled, toggleExportConfirmEnabled, segmentsToChapters, toggleSegmentsToChapters, outFormat,
  preserveMetadataOnMerge, togglePreserveMetadataOnMerge, outSegTemplate, setOutSegTemplate, generateOutSegFileNames,
  filePath, currentSegIndexSafe, isOutSegFileNamesValid, autoDeleteMergedSegments, setAutoDeleteMergedSegments,
  safeOutputFileName, toggleSafeOutputFileName,
}) => {
  const { t } = useTranslation();

  const isMov = ffmpegIsMov(outFormat);
  const isIpod = outFormat === 'ipod';

  function onPreserveMovDataHelpPress() {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('Preserve all MOV/MP4 metadata tags (e.g. EXIF, GPS position etc.) from source file? Note that some players have trouble playing back files where all metadata is preserved, like iTunes and other Apple software') });
  }

  function onMovFastStartHelpPress() {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('Enable this to allow faster playback of the resulting file. This may cause processing to take a little longer') });
  }

  function onOutFmtHelpPress() {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('Defaults to same format as input file. You can losslessly change the file format (container) of the file with this option. Not all formats support all codecs. Matroska/MP4/MOV support the most common codecs. Sometimes it\'s even impossible to export to the same output format as input.') });
  }

  function onKeyframeCutHelpPress() {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('With "keyframe cut", we will cut at the nearest keyframe before the desired start cutpoint. This is recommended for most files. With "Normal cut" you may have to manually set the cutpoint a few frames before the next keyframe to achieve a precise cut') });
  }

  function onTracksHelpPress() {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('Not all formats support all track types, and LosslessCut is unable to properly cut some track types, so you may have to sacrifice some tracks by disabling them in order to get correct result.') });
  }

  function onSegmentsToChaptersHelpPress() {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('When merging, do you want to create chapters in the merged file, according to the cut segments? NOTE: This may dramatically increase processing time') });
  }

  function onPreserveMetadataOnMergeHelpPress() {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('When merging, do you want to preserve metadata from your original file? NOTE: This may dramatically increase processing time') });
  }

  function onOutSegTemplateHelpPress() {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('You can customize the file name of the output segment(s) using special variables.') });
  }

  function onAvoidNegativeTsHelpPress() {
    // https://ffmpeg.org/ffmpeg-all.html#Format-Options
    const texts = {
      make_non_negative: i18n.t('Shift timestamps to make them non-negative. Also note that this affects only leading negative timestamps, and not non-monotonic negative timestamps.'),
      make_zero: i18n.t('Shift timestamps so that the first timestamp is 0. (LosslessCut default)'),
      auto: i18n.t('Enables shifting when required by the target format.'),
      disabled: i18n.t('Disables shifting of timestamp.'),
    };
    toast.fire({ icon: 'info', timer: 10000, text: `${avoidNegativeTs}: ${texts[avoidNegativeTs]}` });
  }

  const outSegTemplateHelpIcon = <HelpIcon onClick={onOutSegTemplateHelpPress} />;

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

                <h2 style={{ marginTop: 0 }}>{t('Export options')}</h2>
                <ul>
                  {enabledOutSegments.length >= 2 && <li>{t('Merge {{segments}} cut segments to one file?', { segments: enabledOutSegments.length })} <MergeExportButton autoMerge={autoMerge} enabledOutSegments={enabledOutSegments} setAutoMerge={setAutoMerge} autoDeleteMergedSegments={autoDeleteMergedSegments} setAutoDeleteMergedSegments={setAutoDeleteMergedSegments} /></li>}
                  <li>
                    {t('Output container format:')} {renderOutFmt({ height: 20, maxWidth: 150 })}
                    <HelpIcon onClick={onOutFmtHelpPress} />
                  </li>
                  <li>
                    <Trans>Input has {{ numStreamsTotal }} tracks - <HighlightedText style={{ cursor: 'pointer' }} onClick={() => setStreamsSelectorShown(true)}>Keeping {{ numStreamsToCopy }} tracks</HighlightedText></Trans>
                    <HelpIcon onClick={onTracksHelpPress} />
                  </li>
                  <li>
                    {t('Save output to path:')} <span role="button" onClick={changeOutDir} style={outDirStyle}>{outputDir}</span>
                  </li>
                  {(enabledOutSegments.length === 1 || !autoMerge) && (
                    <li>
                      <OutSegTemplateEditor filePath={filePath} helpIcon={outSegTemplateHelpIcon} outSegTemplate={outSegTemplate} setOutSegTemplate={setOutSegTemplate} generateOutSegFileNames={generateOutSegFileNames} currentSegIndexSafe={currentSegIndexSafe} isOutSegFileNamesValid={isOutSegFileNamesValid} safeOutputFileName={safeOutputFileName} toggleSafeOutputFileName={toggleSafeOutputFileName} />
                    </li>
                  )}
                </ul>

                <h3>{t('Advanced options')}</h3>

                {autoMerge && enabledOutSegments.length >= 2 && (
                  <ul>
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

                <p>{t('Depending on your specific file/player, you may have to try different options for best results.')}</p>

                <ul>
                  <li>
                    {t('Cut mode:')} <KeyframeCutButton keyframeCut={keyframeCut} onClick={withBlur(() => toggleKeyframeCut(false))} />
                    <HelpIcon onClick={onKeyframeCutHelpPress} /> {!keyframeCut && <span style={warningStyle}>{t('Note: Keyframe cut is recommended for most common files')}</span>}
                  </li>

                  {isMov && (
                    <>
                      <li>
                        {t('Enable MOV Faststart?')} <MovFastStartButton movFastStart={movFastStart} toggleMovFastStart={toggleMovFastStart} />
                        <HelpIcon onClick={onMovFastStartHelpPress} /> {isIpod && !movFastStart && <span style={warningStyle}>{t('For the ipod format, it is recommended to activate this option')}</span>}
                      </li>
                      <li>
                        {t('Preserve all MP4/MOV metadata?')} <PreserveMovDataButton preserveMovData={preserveMovData} togglePreserveMovData={togglePreserveMovData} />
                        <HelpIcon onClick={onPreserveMovDataHelpPress} /> {isIpod && preserveMovData && <span style={warningStyle}>{t('For the ipod format, it is recommended to deactivate this option')}</span>}
                      </li>
                    </>
                  )}
                  <li>
                    {t('Shift timestamps (avoid_negative_ts)')}
                    <Select height={20} value={avoidNegativeTs} onChange={(e) => setAvoidNegativeTs(e.target.value)} style={{ marginLeft: 5 }}>
                      <option value="make_zero">make_zero</option>
                      <option value="make_non_negative">make_non_negative</option>
                      <option value="auto">auto</option>
                      <option value="disabled">disabled</option>
                    </Select>
                    <HelpIcon onClick={onAvoidNegativeTsHelpPress} />
                  </li>
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
              <ToggleExportConfirm size={25} exportConfirmEnabled={exportConfirmEnabled} toggleExportConfirmEnabled={toggleExportConfirmEnabled} />
              <div style={{ fontSize: 13, marginLeft: 3, marginRight: 7, maxWidth: 120, lineHeight: '100%', color: exportConfirmEnabled ? 'white' : 'rgba(255,255,255,0.3)', cursor: 'pointer' }} role="button" onClick={toggleExportConfirmEnabled}>{t('Show this page before exporting?')}</div>
            </motion.div>

            <motion.div
              style={{ transformOrigin: 'bottom right' }}
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.4, easings: ['easeOut'] }}
            >
              <ExportButton enabledOutSegments={enabledOutSegments} areWeCutting={areWeCutting} autoMerge={autoMerge} onClick={() => onExportConfirm()} size={1.7} />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
});

export default ExportConfirm;
