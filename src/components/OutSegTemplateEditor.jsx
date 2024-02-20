import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDebounce } from 'use-debounce';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { WarningSignIcon, ErrorIcon, Button, IconButton, TickIcon, ResetIcon } from 'evergreen-ui';
import withReactContent from 'sweetalert2-react-content';
import { IoIosHelpCircle } from 'react-icons/io';
import { motion, AnimatePresence } from 'framer-motion';

import Swal from '../swal';
import HighlightedText from './HighlightedText';
import { defaultOutSegTemplate, segNumVariable, segSuffixVariable } from '../util/outputNameTemplate';
import useUserSettings from '../hooks/useUserSettings';
import Switch from './Switch';
import Select from './Select';
import TextInput from './TextInput';

const ReactSwal = withReactContent(Swal);

const electron = window.require('electron');

const formatVariable = (variable) => `\${${variable}}`;

const extVar = formatVariable('EXT');

const OutSegTemplateEditor = memo(({ outSegTemplate, setOutSegTemplate, generateOutSegFileNames, currentSegIndexSafe }) => {
  const { safeOutputFileName, toggleSafeOutputFileName, outputFileNameMinZeroPadding, setOutputFileNameMinZeroPadding } = useUserSettings();

  const [text, setText] = useState(outSegTemplate);
  const [debouncedText] = useDebounce(text, 500);
  const [validText, setValidText] = useState();
  const [outSegProblems, setOutSegProblems] = useState({ error: undefined, sameAsInputFileNameWarning: false });
  const [outSegFileNames, setOutSegFileNames] = useState();
  const [shown, setShown] = useState();
  const inputRef = useRef();

  const { t } = useTranslation();

  const hasTextNumericPaddedValue = useMemo(() => [segNumVariable, segSuffixVariable].some((v) => debouncedText.includes(formatVariable(v))), [debouncedText]);

  useEffect(() => {
    if (debouncedText == null) return;

    try {
      const outSegs = generateOutSegFileNames({ template: debouncedText });
      setOutSegFileNames(outSegs.outSegFileNames);
      setOutSegProblems(outSegs.outSegProblems);
      setValidText(outSegs.outSegProblems.error == null ? debouncedText : undefined);
    } catch (err) {
      console.error(err);
      setValidText();
      setOutSegProblems({ error: err.message });
    }
  }, [debouncedText, generateOutSegFileNames, t]);

  // eslint-disable-next-line no-template-curly-in-string
  const isMissingExtension = validText != null && !validText.endsWith(extVar);

  const onAllSegmentsPreviewPress = () => ReactSwal.fire({
    title: t('Resulting segment file names', { count: outSegFileNames.length }),
    html: (
      <div style={{ textAlign: 'left', overflowY: 'auto', maxHeight: 400 }}>
        {outSegFileNames.map((f) => <div key={f} style={{ marginBottom: 7 }}>{f}</div>)}
      </div>
    ) });

  useEffect(() => {
    if (validText != null) setOutSegTemplate(validText);
  }, [validText, setOutSegTemplate]);

  const reset = useCallback(() => {
    setOutSegTemplate(defaultOutSegTemplate);
    setText(defaultOutSegTemplate);
  }, [setOutSegTemplate]);

  const onHideClick = useCallback(() => {
    if (outSegProblems.error == null) setShown(false);
  }, [outSegProblems.error]);

  const onShowClick = useCallback(() => {
    if (!shown) setShown(true);
  }, [shown]);

  const onTextChange = useCallback((e) => setText(e.target.value), []);

  const needToShow = shown || outSegProblems.error != null || outSegProblems.sameAsInputFileNameWarning;

  const onVariableClick = useCallback((variable) => {
    const input = inputRef.current;
    const startPos = input.selectionStart;
    const endPos = input.selectionEnd;

    const newValue = `${text.slice(0, startPos)}${`${formatVariable(variable)}${text.slice(endPos)}`}`;
    setText(newValue);
  }, [text]);

  return (
    <motion.div style={{ maxWidth: 600 }} animate={{ margin: needToShow ? '1.5em 0' : 0 }}>
      <div>{outSegFileNames != null && t('Output name(s):', { count: outSegFileNames.length })}</div>

      {outSegFileNames != null && <HighlightedText role="button" onClick={onShowClick} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: needToShow ? undefined : 'pointer' }}>{outSegFileNames[currentSegIndexSafe] || outSegFileNames[0] || '-'}</HighlightedText>}

      <AnimatePresence>
        {needToShow && (
          <motion.div
            key="1"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: '1em' }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '.2em' }}>
              <TextInput ref={inputRef} onChange={onTextChange} value={text} autoComplete="off" autoCapitalize="off" autoCorrect="off" />

              {outSegFileNames != null && <Button height={20} onClick={onAllSegmentsPreviewPress} marginLeft={5}>{t('Preview')}</Button>}

              <IconButton title={t('Reset')} icon={ResetIcon} height={20} onClick={reset} marginLeft={5} intent="danger" />
              <IconButton title={t('Close')} icon={TickIcon} height={20} onClick={onHideClick} marginLeft={5} intent="success" appearance="primary" />
            </div>

            <div style={{ fontSize: '.8em', color: 'var(--gray11)', display: 'flex', gap: '.3em', flexWrap: 'wrap', alignItems: 'center', marginBottom: '.7em' }}>
              {`${i18n.t('Variables')}:`}

              <IoIosHelpCircle fontSize="1.3em" color="var(--gray12)" role="button" cursor="pointer" onClick={() => electron.shell.openExternal('https://github.com/mifi/lossless-cut/blob/master/import-export.md#customising-exported-file-names')} />
              {['FILENAME', 'CUT_FROM', 'CUT_TO', segNumVariable, 'SEG_LABEL', segSuffixVariable, 'EXT', 'SEG_TAGS.XX', 'EPOCH_MS'].map((variable) => (
                <span key={variable} role="button" style={{ cursor: 'pointer', marginRight: '.2em', textDecoration: 'underline', textDecorationStyle: 'dashed', fontSize: '.9em' }} onClick={() => onVariableClick(variable)}>{variable}</span>
              ))}
            </div>

            {outSegProblems.error != null && (
              <div style={{ marginBottom: '1em' }}>
                <ErrorIcon color="var(--red9)" size={14} verticalAlign="baseline" /> {outSegProblems.error}
              </div>
            )}

            {outSegProblems.error == null && outSegProblems.sameAsInputFileNameWarning && (
              <div style={{ marginBottom: '1em' }}>
                <WarningSignIcon verticalAlign="middle" color="var(--amber9)" />{' '}
                {i18n.t('Output file name is the same as the source file name. This increases the risk of accidentally overwriting or deleting source files!')}
              </div>
            )}

            {isMissingExtension && (
              <div style={{ marginBottom: '1em' }}>
                <WarningSignIcon verticalAlign="middle" color="var(--amber9)" />{' '}
                {i18n.t('The file name template is missing {{ext}} and will result in a file without the suggested extension. This may result in an unplayable output file.', { ext: extVar })}
              </div>
            )}

            {hasTextNumericPaddedValue && (
              <div style={{ marginBottom: '.3em' }}>
                <Select value={outputFileNameMinZeroPadding} onChange={(e) => setOutputFileNameMinZeroPadding(parseInt(e.target.value, 10))} style={{ marginRight: '1em', fontSize: '1em' }}>
                  {Array.from({ length: 10 }).map((v, i) => i + 1).map((v) => <option key={v} value={v}>{v}</option>)}
                </Select>
                Minimum numeric padded length
              </div>
            )}

            <div title={t('Whether or not to sanitize output file names (sanitizing removes special characters)')} style={{ marginBottom: '.3em' }}>
              <Switch checked={safeOutputFileName} onCheckedChange={toggleSafeOutputFileName} style={{ verticalAlign: 'middle', marginRight: '.5em' }} />
              <span>{t('Sanitize file names')}</span>

              {!safeOutputFileName && <WarningSignIcon color="var(--amber9)" style={{ marginLeft: '.5em', verticalAlign: 'middle' }} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default OutSegTemplateEditor;
