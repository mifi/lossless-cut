import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDebounce } from 'use-debounce';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { WarningSignIcon, ErrorIcon, Button, IconButton, TickIcon, ResetIcon } from 'evergreen-ui';
import { IoIosHelpCircle } from 'react-icons/io';
import { motion, AnimatePresence } from 'framer-motion';
import { FaEdit } from 'react-icons/fa';

import { ReactSwal } from '../swal';
import HighlightedText from './HighlightedText';
import { defaultOutSegTemplate, segNumVariable, segSuffixVariable, GenerateOutSegFileNames, extVariable, segTagsVariable, segNumIntVariable } from '../util/outputNameTemplate';
import useUserSettings from '../hooks/useUserSettings';
import Switch from './Switch';
import Select from './Select';
import TextInput from './TextInput';

const electron = window.require('electron');

const formatVariable = (variable) => `\${${variable}}`;

const extVariableFormatted = formatVariable(extVariable);
const segTagsExample = `${segTagsVariable}.XX`;

function OutSegTemplateEditor({ outSegTemplate, setOutSegTemplate, generateOutSegFileNames, currentSegIndexSafe }: {
  outSegTemplate: string, setOutSegTemplate: (text: string) => void, generateOutSegFileNames: GenerateOutSegFileNames, currentSegIndexSafe: number,
}) {
  const { safeOutputFileName, toggleSafeOutputFileName, outputFileNameMinZeroPadding, setOutputFileNameMinZeroPadding } = useUserSettings();

  const [text, setText] = useState(outSegTemplate);
  const [debouncedText] = useDebounce(text, 500);
  const [validText, setValidText] = useState<string>();
  const [outSegProblems, setOutSegProblems] = useState<{ error?: string | undefined, sameAsInputFileNameWarning?: boolean | undefined }>({ error: undefined, sameAsInputFileNameWarning: false });
  const [outSegFileNames, setOutSegFileNames] = useState<string[]>();
  const [shown, setShown] = useState<boolean>();
  const inputRef = useRef<HTMLInputElement>(null);

  const { t } = useTranslation();

  const hasTextNumericPaddedValue = useMemo(() => [segNumVariable, segSuffixVariable].some((v) => debouncedText.includes(formatVariable(v))), [debouncedText]);

  useEffect(() => {
    if (debouncedText == null) {
      return undefined;
    }

    const abortController = new AbortController();

    (async () => {
      try {
        // console.time('generateOutSegFileNames')
        const outSegs = await generateOutSegFileNames({ template: debouncedText });
        // console.timeEnd('generateOutSegFileNames')
        if (abortController.signal.aborted) return;
        setOutSegFileNames(outSegs.outSegFileNames);
        setOutSegProblems(outSegs.outSegProblems);
        setValidText(outSegs.outSegProblems.error == null ? debouncedText : undefined);
      } catch (err) {
        console.error(err);
        setValidText(undefined);
        setOutSegProblems({ error: err instanceof Error ? err.message : String(err) });
      }
    })();

    return () => abortController.abort();
  }, [debouncedText, generateOutSegFileNames, t]);

  // eslint-disable-next-line no-template-curly-in-string
  const isMissingExtension = validText != null && !validText.endsWith(extVariableFormatted);

  const onAllSegmentsPreviewPress = useCallback(() => {
    if (outSegFileNames == null) return;
    ReactSwal.fire({
      title: t('Resulting segment file names', { count: outSegFileNames.length }),
      html: (
        <div style={{ textAlign: 'left', overflowY: 'auto', maxHeight: 400 }}>
          {outSegFileNames.map((f) => <div key={f} style={{ marginBottom: 7 }}>{f}</div>)}
        </div>
      ),
    });
  }, [outSegFileNames, t]);

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

  const gotImportantMessage = outSegProblems.error != null || outSegProblems.sameAsInputFileNameWarning;
  const needToShow = shown || gotImportantMessage;

  const onVariableClick = useCallback((variable: string) => {
    const input = inputRef.current;
    const startPos = input!.selectionStart;
    const endPos = input!.selectionEnd;
    if (startPos == null || endPos == null) return;

    const toInsert = variable === segTagsExample ? `${segTagsExample} ?? ''` : variable;

    const newValue = `${text.slice(0, startPos)}${`${formatVariable(toInsert)}${text.slice(endPos)}`}`;
    setText(newValue);
  }, [text]);

  return (
    <motion.div style={{ maxWidth: 600 }} animate={{ margin: needToShow ? '1.5em 0' : 0 }}>
      <div>{outSegFileNames != null && t('Output name(s):', { count: outSegFileNames.length })}</div>

      {outSegFileNames != null && (
        <HighlightedText role="button" onClick={onShowClick} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: needToShow ? undefined : 'pointer' }}>
          {outSegFileNames[currentSegIndexSafe] || outSegFileNames[0] || '-'}
          {!needToShow && <FaEdit style={{ fontSize: '.9em', marginLeft: '.4em', verticalAlign: 'middle' }} />}
        </HighlightedText>
      )}

      <AnimatePresence>
        {needToShow && (
          <motion.div
            key="1"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: '1em' }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
          >
            <div style={{ color: 'var(--gray11)', fontSize: '.8em' }}>{t('Output file name template')}:</div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '.2em' }}>
              <TextInput ref={inputRef} onChange={onTextChange} value={text} autoComplete="off" autoCapitalize="off" autoCorrect="off" />

              {outSegFileNames != null && <Button height={20} onClick={onAllSegmentsPreviewPress} marginLeft={5}>{t('Preview')}</Button>}

              <IconButton title={t('Reset')} icon={ResetIcon} height={20} onClick={reset} marginLeft={5} intent="danger" />
              {!gotImportantMessage && <IconButton title={t('Close')} icon={TickIcon} height={20} onClick={onHideClick} marginLeft={5} intent="success" appearance="primary" />}
            </div>

            <div style={{ fontSize: '.8em', color: 'var(--gray11)', display: 'flex', gap: '.3em', flexWrap: 'wrap', alignItems: 'center', marginBottom: '.7em' }}>
              {`${i18n.t('Variables')}:`}

              <IoIosHelpCircle fontSize="1.3em" color="var(--gray12)" role="button" cursor="pointer" onClick={() => electron.shell.openExternal('https://github.com/mifi/lossless-cut/blob/master/import-export.md#customising-exported-file-names')} />
              {['FILENAME', 'CUT_FROM', 'CUT_TO', segNumVariable, segNumIntVariable, 'SEG_LABEL', segSuffixVariable, extVariable, segTagsExample, 'EPOCH_MS'].map((variable) => (
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
                {i18n.t('The file name template is missing {{ext}} and will result in a file without the suggested extension. This may result in an unplayable output file.', { ext: extVariableFormatted })}
              </div>
            )}

            {hasTextNumericPaddedValue && (
              <div style={{ marginBottom: '.3em' }}>
                <Select value={outputFileNameMinZeroPadding} onChange={(e) => setOutputFileNameMinZeroPadding(parseInt(e.target.value, 10))} style={{ marginRight: '1em', fontSize: '1em' }}>
                  {Array.from({ length: 10 }).map((_v, i) => i + 1).map((v) => <option key={v} value={v}>{v}</option>)}
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
}

export default memo(OutSegTemplateEditor);
