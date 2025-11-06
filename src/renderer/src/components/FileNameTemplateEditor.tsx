import { memo, useState, useEffect, useCallback, useRef, useMemo, ChangeEventHandler } from 'react';
import { useDebounce } from 'use-debounce';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { IoIosHelpCircle } from 'react-icons/io';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheck, FaEdit, FaExclamationTriangle, FaFile, FaUndo } from 'react-icons/fa';

import HighlightedText from './HighlightedText';
import { segNumVariable, segSuffixVariable, GenerateOutFileNames, extVariable, segTagsVariable, segNumIntVariable, selectedSegNumVariable, selectedSegNumIntVariable, GeneratedOutFileNames } from '../util/outputNameTemplate';
import useUserSettings from '../hooks/useUserSettings';
import Switch from './Switch';
import Select from './Select';
import TextInput from './TextInput';
import Button from './Button';
import * as Dialog from './Dialog';
import { dangerColor, saveColor } from '../colors';

const electron = window.require('electron');


const formatVariable = (variable: string) => `\${${variable}}`;

const extVariableFormatted = formatVariable(extVariable);
const segTagsExample = `${segTagsVariable}.XX`;

function FileNameTemplateEditor(opts: {
  template: string,
  setTemplate: (text: string) => void,
  defaultTemplate: string,
  generateFileNames: GenerateOutFileNames,
} & ({
  currentSegIndexSafe: number,
  mode: 'separate'
} | {
  mode: 'merge-segments' | 'merge-files'
})) {
  const { template: templateIn, setTemplate, defaultTemplate, generateFileNames, mode } = opts;

  const { safeOutputFileName, toggleSafeOutputFileName, outputFileNameMinZeroPadding, setOutputFileNameMinZeroPadding, simpleMode } = useUserSettings();

  const [text, setText] = useState(templateIn);
  const [debouncedText] = useDebounce(text, 500);
  const [generated, setGenerated] = useState<GeneratedOutFileNames>();

  const haveImportantMessage = generated != null && (generated.problems.error != null || generated.problems.sameAsInputFileNameWarning);
  const [shown, setShown] = useState(haveImportantMessage);
  useEffect(() => {
    // if an important message appears, make sure we don't auto-close after it's resolved
    // https://github.com/mifi/lossless-cut/issues/2567
    if (haveImportantMessage) setShown(true);
  }, [haveImportantMessage]);

  const needToShow = shown || haveImportantMessage;

  const inputRef = useRef<HTMLInputElement>(null);

  const { t } = useTranslation();

  const hasTextNumericPaddedValue = useMemo(() => [segNumVariable, selectedSegNumVariable, segSuffixVariable].some((v) => debouncedText.includes(formatVariable(v))), [debouncedText]);

  useEffect(() => {
    if (debouncedText == null) {
      return undefined;
    }

    const abortController = new AbortController();

    (async () => {
      try {
        // console.time('generateFileNames')
        const newGenerated = await generateFileNames(debouncedText);
        // console.timeEnd('generateCutFileNames')
        if (abortController.signal.aborted) return;
        setGenerated(newGenerated);
      } catch (err) {
        console.error(err); // shouldn't really happen
      }
    })();

    return () => abortController.abort();
  }, [debouncedText, generateFileNames, t]);

  const availableVariables = useMemo(() => {
    const common = ['FILENAME', extVariable, 'EPOCH_MS', 'SEG_LABEL', 'EXPORT_COUNT'];
    if (mode === 'merge-segments') {
      return [...common, 'FILE_EXPORT_COUNT'];
    }
    if (mode === 'separate') {
      return [
        ...common,
        'CUT_FROM',
        ...(!simpleMode ? ['CUT_FROM_NUM'] : []),
        'CUT_TO',
        ...(!simpleMode ? ['CUT_TO_NUM'] : []),
        'CUT_DURATION',
        segNumVariable,
        ...(!simpleMode ? [segNumIntVariable] : []),
        selectedSegNumVariable,
        ...(!simpleMode ? [selectedSegNumIntVariable] : []),
        segSuffixVariable, segTagsExample,
      ];
    }
    // merge-files
    return common;
  }, [mode, simpleMode]);

  const isMissingExtension = !debouncedText.endsWith(extVariableFormatted);

  useEffect(() => {
    setTemplate(debouncedText);
  }, [debouncedText, setTemplate]);

  const reset = useCallback(() => {
    setTemplate(defaultTemplate);
    setText(defaultTemplate);
  }, [defaultTemplate, setTemplate]);

  const onHideClick = useCallback(() => {
    if (generated != null && generated.problems.error == null) setShown(false);
  }, [generated]);

  const onShowClick = useCallback(() => {
    if (!shown) setShown(true);
  }, [shown]);

  const onTextChange = useCallback<ChangeEventHandler<HTMLInputElement>>((e) => setText(e.target.value), []);

  const onVariableClick = useCallback((variable: string) => {
    const input = inputRef.current;
    const startPos = input!.selectionStart;
    const endPos = input!.selectionEnd;
    if (startPos == null || endPos == null) return;

    const toInsert = variable === segTagsExample ? `${segTagsExample} ?? ''` : variable;

    const newValue = `${text.slice(0, startPos)}${`${formatVariable(toInsert)}${text.slice(endPos)}`}`;
    setText(newValue);
  }, [text]);

  function formatCurrentSegFileOrFirst(names: string[]) {
    if (mode === 'separate') {
      const { currentSegIndexSafe } = opts;
      const fileName = names[currentSegIndexSafe];
      if (fileName != null) {
        return fileName;
      }
    }
    return names[0] ?? '-';
  }

  return (
    <>
      {generated != null && (
        <div>{
          (mode === 'merge-files' || mode === 'merge-segments')
            ? t('Merged output file name:')
            : t('Output name(s):', { count: generated.fileNames.length })
          }
        </div>
      )}

      <motion.div animate={{ marginBottom: needToShow ? '1.5em' : '.3em' }}>
        {generated != null && (
          <div style={{ marginBottom: '.3em' }}>
            <HighlightedText role="button" onClick={onShowClick} tabIndex={0} style={{ wordBreak: 'break-word', cursor: needToShow ? undefined : 'pointer' }}>
              {generated.originalFileNames != null && formatCurrentSegFileOrFirst(generated.fileNames)}
              <span style={generated.originalFileNames != null ? { textDecoration: 'line-through', marginLeft: '.3em', color: dangerColor } : undefined}>{formatCurrentSegFileOrFirst(generated.originalFileNames ?? generated.fileNames)}</span>
              {!needToShow && <FaEdit style={{ fontSize: '.9em', marginLeft: '.4em', verticalAlign: 'middle' }} />}
            </HighlightedText>
          </div>
        )}

        <AnimatePresence>
          {needToShow && (
            <motion.div
              key="1"
              style={{ background: 'var(--gray-1)', padding: '.3em .5em', borderRadius: '.3em', margin: '0 -.5em' }}
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: '.7em' }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
            >
              <div style={{ color: 'var(--gray-11)', fontSize: '.8em' }}>{t('Output file name template')}:</div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '.2em' }}>
                <TextInput ref={inputRef} onChange={onTextChange} value={text} autoComplete="off" autoCapitalize="off" autoCorrect="off" />

                {generated != null && generated.fileNames.length > 1 && (
                  <Dialog.Root>
                    <Dialog.Trigger asChild>
                      <Button style={{ marginLeft: '.3em' }}>{t('Preview')}</Button>
                    </Dialog.Trigger>

                    <Dialog.Portal>
                      <Dialog.Overlay />
                      <Dialog.Content aria-describedby={undefined}>
                        <Dialog.Title>{t('Resulting segment file names', { count: generated.fileNames.length })}</Dialog.Title>

                        <div style={{ overflowY: 'auto', maxHeight: 400 }}>
                          {generated.fileNames.map((f) => <div key={f} style={{ marginBottom: '.5em' }}><FaFile style={{ verticalAlign: 'middle', marginRight: '.5em' }} />{f}</div>)}
                        </div>

                        <Dialog.CloseButton />
                      </Dialog.Content>
                    </Dialog.Portal>
                  </Dialog.Root>
                )}

                <Button title={t('Reset')} onClick={reset} style={{ marginLeft: '.3em' }}><FaUndo style={{ fontSize: '.8em', color: dangerColor }} /></Button>
                {!haveImportantMessage && (
                  <Button title={t('Close')} onClick={onHideClick} style={{ marginLeft: '.3em', color: saveColor }}><FaCheck style={{ fontSize: '.8em' }} /></Button>
                )}
              </div>

              <div style={{ fontSize: '.8em', color: 'var(--gray-11)', display: 'flex', gap: '.3em', flexWrap: 'wrap', alignItems: 'center', marginBottom: '.7em' }}>
                {`${i18n.t('Variables')}:`}

                <IoIosHelpCircle fontSize="1.3em" color="var(--gray-12)" role="button" cursor="pointer" onClick={() => electron.shell.openExternal('https://github.com/mifi/lossless-cut/blob/master/docs.md#custom-exported-file-names')} />
                {availableVariables.map((variable) => (
                  <span key={variable} role="button" style={{ cursor: 'pointer', marginRight: '.2em', textDecoration: 'underline', textDecorationStyle: 'dashed', fontSize: '.9em' }} onClick={() => onVariableClick(variable)}>{variable}</span>
                ))}
              </div>

              {hasTextNumericPaddedValue && (
                <div style={{ marginBottom: '.3em' }}>
                  <Select value={outputFileNameMinZeroPadding} onChange={(e) => setOutputFileNameMinZeroPadding(parseInt(e.target.value, 10))} style={{ marginRight: '.5em', fontSize: '1em' }}>
                    {Array.from({ length: 10 }).map((_v, i) => i + 1).map((v) => <option key={v} value={v}>{v}</option>)}
                  </Select>
                  {t('Minimum numeric padded length')}
                </div>
              )}

              <div title={t('Whether or not to sanitize output file names (sanitizing removes special characters)')} style={{ marginBottom: '.3em' }}>
                <Switch checked={safeOutputFileName} onCheckedChange={toggleSafeOutputFileName} style={{ verticalAlign: 'middle', marginRight: '.5em' }} />
                <span>{t('Sanitize file names')}</span>

                {!safeOutputFileName && <FaExclamationTriangle color="var(--amber-9)" style={{ marginLeft: '.5em', verticalAlign: 'middle' }} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {generated?.problems.error != null ? (
          <div style={{ marginBottom: '1em', fontSize: '.9em' }}>
            <FaExclamationTriangle color={dangerColor} style={{ verticalAlign: 'middle', fontSize: '1.1em' }} /> {generated.problems.error}
          </div>
        ) : (
          generated != null && (
            <>
              {generated.problems.sameAsInputFileNameWarning && (
                <div style={{ marginBottom: '1em' }}>
                  <FaExclamationTriangle style={{ verticalAlign: 'middle', marginRight: '.3em' }} color="var(--amber-9)" />
                  {i18n.t('Output file name is the same as the source file name. This increases the risk of accidentally overwriting or deleting source files!')}
                </div>
              )}

              {isMissingExtension && (
                <div style={{ marginBottom: '1em' }}>
                  <FaExclamationTriangle style={{ verticalAlign: 'middle', marginRight: '.3em' }} color="var(--amber-9)" />
                  {i18n.t('The file name template is missing {{ext}} and will result in a file without the suggested extension. This may result in an unplayable output file.', { ext: extVariableFormatted })}
                </div>
              )}
            </>
          )
        )}
      </motion.div>
    </>
  );
}

export default memo(FileNameTemplateEditor);
