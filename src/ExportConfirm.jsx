import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Select } from 'evergreen-ui';
import i18n from 'i18next';
import { useTranslation, Trans } from 'react-i18next';
import { IoIosHelpCircle } from 'react-icons/io';

import KeyframeCutButton from './components/KeyframeCutButton';
import ExportButton from './components/ExportButton';
import MergeExportButton from './components/MergeExportButton';
import PreserveMovDataButton from './components/PreserveMovDataButton';

import { withBlur, toast } from './util';

const sheetStyle = {
  position: 'fixed',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  zIndex: 10,
  overflowY: 'scroll',
  background: 'rgba(105, 105, 105, 0.7)',
  backdropFilter: 'blur(10px)',
};

const boxStyle = { margin: 15, background: 'rgba(25, 25, 25, 0.6)', borderRadius: 10, padding: '10px 20px' };

const outDirStyle = { background: 'rgb(193, 98, 0)', borderRadius: '.4em', padding: '0 .3em', wordBreak: 'break-all', cursor: 'pointer' };

// eslint-disable-next-line react/jsx-props-no-spreading
const Highlight = ({ children, style, ...props }) => <span {...props} style={{ background: 'rgb(193, 98, 0)', borderRadius: '.4em', padding: '0 .3em', ...style }}>{children}</span>;

const HelpIcon = ({ onClick }) => <IoIosHelpCircle size={20} role="button" onClick={withBlur(onClick)} style={{ verticalAlign: 'middle', marginLeft: 5 }} />;

const ExportConfirm = memo(({
  autoMerge, areWeCutting, outSegments, visible, onClosePress, onCutPress, keyframeCut, toggleKeyframeCut,
  toggleAutoMerge, renderOutFmt, preserveMovData, togglePreserveMovData, avoidNegativeTs, setAvoidNegativeTs,
  changeOutDir, outputDir, numStreamsTotal, numStreamsToCopy, setStreamsSelectorShown,
}) => {
  const { t } = useTranslation();

  const isMov = true; // todo

  function onPreserveMovDataHelpPress() {
    toast.fire({ icon: 'info', timer: 10000, text: i18n.t('Preserve all MOV/MP4 metadata (e.g. EXIF, GPS position etc.) from source file? Note that some players have trouble playing back files where all metadata is preserved.') });
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
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={boxStyle}>
                <h2>{t('Export summary')}</h2>
                <ul>
                  {outSegments.length > 1 && <li>{t('Merge {{segments}} cut segments to one file?', { segments: outSegments.length })} <MergeExportButton autoMerge={autoMerge} outSegments={outSegments} toggleAutoMerge={toggleAutoMerge} /></li>}
                  <li>
                    <Trans>Input has {{ numStreamsTotal }} tracks - <Highlight style={{ cursor: 'pointer' }} onClick={() => setStreamsSelectorShown(true)}>Keeping {{ numStreamsToCopy }} tracks</Highlight></Trans>
                    <HelpIcon onClick={withBlur(onTracksHelpPress)} />
                  </li>
                  <li>
                    {t('Output container format:')} {renderOutFmt({ height: 20, maxWidth: 150 })}
                    <HelpIcon onClick={withBlur(onOutFmtHelpPress)} />
                  </li>
                  <li>
                    {t('Save output to path:')} <span role="button" onClick={changeOutDir} style={outDirStyle}>{outputDir}</span>
                  </li>
                </ul>

                <h3>{t('Advanced options')}</h3>
                <p>{t('Depending on your specific file, you may have to try different options for best results.')}</p>
                <ul>
                  <li>
                    {t('Cut mode:')} <KeyframeCutButton keyframeCut={keyframeCut} onClick={withBlur(() => toggleKeyframeCut(false))} />
                    <HelpIcon onClick={withBlur(onKeyframeCutHelpPress)} />
                  </li>

                  {isMov && (
                    <li>
                      {t('Preserve all MP4/MOV metadata?')} <PreserveMovDataButton preserveMovData={preserveMovData} togglePreserveMovData={togglePreserveMovData} />
                      <HelpIcon onClick={withBlur(onPreserveMovDataHelpPress)} />
                    </li>
                  )}
                  <li>
                    {t('Shift timestamps (avoid_negative_ts)')}
                    <Select height={20} value={avoidNegativeTs} onChange={(e) => setAvoidNegativeTs(e.target.value)} style={{ marginLeft: 5 }}>
                      <option value="make_zero">make_zero</option>
                      <option value="make_non_negative">make_non_negative</option>
                      <option value="auto">auto</option>
                      <option value="disabled">disabled</option>
                    </Select>
                    <HelpIcon onClick={withBlur(onAvoidNegativeTsHelpPress)} />
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>

          <div style={{ zIndex: 11, position: 'fixed', right: 0, bottom: 0, display: 'flex', alignItems: 'center', margin: 5 }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, easings: ['easeOut'] }}
            >
              <Button iconBefore="arrow-left" height={30} onClick={onClosePress} style={{ marginRight: 10 }}>
                {i18n.t('Back')}
              </Button>
            </motion.div>

            <motion.div
              style={{ transformOrigin: 'bottom right' }}
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.4, easings: ['easeOut'] }}
            >
              <ExportButton outSegments={outSegments} areWeCutting={areWeCutting} autoMerge={autoMerge} onClick={onCutPress} size={1.8} />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
});

export default ExportConfirm;
