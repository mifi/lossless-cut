import type { ChangeEventHandler, KeyboardEventHandler } from 'react';
import { memo, useState, useEffect, useCallback, useLayoutEffect, useReducer, useRef, useMemo } from 'react';
import { useDebounce } from 'use-debounce';
import { useTranslation } from 'react-i18next';
import { IoIosHelpCircle } from 'react-icons/io';
import { motion, AnimatePresence } from 'motion/react';
import { FaCaretUp, FaEdit, FaExclamationTriangle, FaEye, FaFile, FaRedoAlt, FaUndo, FaUndoAlt } from 'react-icons/fa';

import HighlightedText from './HighlightedText';
import type { GenerateOutFileNames, GeneratedOutFileNames } from '../util/outputNameTemplate';
import { segNumVariable, segSuffixVariable, extVariable, segTagsVariable, segNumIntVariable, selectedSegNumVariable, selectedSegNumIntVariable } from '../util/outputNameTemplate';
import useUserSettings from '../hooks/useUserSettings';
import Switch from './Switch';
import Select from './Select';
import TextInput from './TextInput';
import Button from './Button';
import * as Dialog from './Dialog';
import { dangerColor, warningColor } from '../colors';
import { exportedFileNameTemplateHelpUrl } from '../../../common/constants';
import mainApi from '../mainApi';
import { canRedo, canUndo, createTextHistory, getTextHistoryValue, textHistoryReducer } from '../util/textHistory';


const formatVariable = (variable: string) => `\${${variable}}`;

const extVariableFormatted = formatVariable(extVariable);
const segTagsExample = `${segTagsVariable}.XX`;

function FileNameTemplateEditor(opts: {
  template: string,
  setTemplate: (text: string) => void,
  defaultTemplate: string,
  generateFileNames: GenerateOutFileNames,
  ignoreMissingExtensionWarning?: boolean,
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
  const [history, dispatchHistory] = useReducer(textHistoryReducer, templateIn, createTextHistory);
  const [generated, setGenerated] = useState<GeneratedOutFileNames>();

  const isSimpleMergeFilesMode = simpleMode && mode === 'merge-files';

  const haveImportantMessage = generated != null && (generated.problems.error != null || generated.problems.sameAsInputFileNameWarning);
  const [open, setOpen] = useState(haveImportantMessage || isSimpleMergeFilesMode);

  useEffect(() => {
    // if an important message appears, make sure we don't auto-close after it's resolved
    // https://github.com/mifi/lossless-cut/issues/2567
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (haveImportantMessage) setOpen(true);
  }, [haveImportantMessage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(templateIn);
  }, [templateIn]);

  const inputRef = useRef<HTMLInputElement>(null);
  // caret position to restore after we replace the whole value (undo/redo), because the browser would put it at the end
  const caretRef = useRef<number>(undefined);

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

  // record into the undo history only once typing settles, so a burst of keystrokes becomes a single undo step.
  // it's a no-op when the value is already the current entry, e.g. when the debounce catches up after an undo
  useEffect(() => {
    dispatchHistory({ type: 'set', value: debouncedText });
  }, [debouncedText]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useLayoutEffect(() => {
    if (caretRef.current == null) return;
    inputRef.current?.setSelectionRange(caretRef.current, caretRef.current);
    caretRef.current = undefined;
  }, [text]);

  // typing that the debounce hasn't recorded yet still needs to be undoable
  const hasPendingEdit = text !== getTextHistoryValue(history);
  const undoEnabled = hasPendingEdit || canUndo(history);
  const redoEnabled = !hasPendingEdit && canRedo(history);

  const applyValue = useCallback((value: string) => {
    caretRef.current = value.length;
    setText(value);
  }, []);

  // records a discrete edit (variable insertion, reset) as its own undo step right away,
  // first committing any typing that the debounce hasn't recorded yet
  const recordEdit = useCallback((value: string) => {
    if (text !== getTextHistoryValue(history)) dispatchHistory({ type: 'set', value: text });
    dispatchHistory({ type: 'set', value });
  }, [history, text]);

  const undo = useCallback(() => {
    if (hasPendingEdit) {
      dispatchHistory({ type: 'set', value: text });
      dispatchHistory({ type: 'undo' });
      applyValue(getTextHistoryValue(history));
      return;
    }
    if (!canUndo(history)) return;
    dispatchHistory({ type: 'undo' });
    applyValue(history.stack[history.index - 1]!);
  }, [applyValue, hasPendingEdit, history, text]);

  const redo = useCallback(() => {
    if (!redoEnabled) return;
    dispatchHistory({ type: 'redo' });
    applyValue(history.stack[history.index + 1]!);
  }, [applyValue, history, redoEnabled]);

  const reset = useCallback(() => {
    setTemplate(defaultTemplate);
    recordEdit(defaultTemplate);
    applyValue(defaultTemplate);
  }, [applyValue, defaultTemplate, recordEdit, setTemplate]);

  const handleSampleClick = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  const onTextChange = useCallback<ChangeEventHandler<HTMLInputElement>>((e) => setText(e.target.value), []);

  // the browser's own undo can't restore programmatic edits (variable insertion, reset), so handle it ourselves
  const onTextKeyDown = useCallback<KeyboardEventHandler<HTMLInputElement>>((e) => {
    if (e.altKey || !(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault();
      redo();
    }
  }, [redo, undo]);

  const onVariableClick = useCallback((variable: string) => {
    const input = inputRef.current;
    const startPos = input!.selectionStart;
    const endPos = input!.selectionEnd;
    if (startPos == null || endPos == null) return;

    const toInsert = variable === segTagsExample ? `${segTagsExample} ?? ''` : variable;

    const newValue = `${text.slice(0, startPos)}${`${formatVariable(toInsert)}${text.slice(endPos)}`}`;
    recordEdit(newValue);
    setText(newValue);
  }, [recordEdit, text]);

  function formatCurrentSegFileOrFirst(names: string[]) {
    if (mode === 'separate') {
      const { currentSegIndexSafe } = opts;
      const fileName = names[currentSegIndexSafe];
      if (fileName != null) {
        return fileName;
      }
    }

    return names[0];
  }

  return (
    <>
      {generated != null && (
        <div>
          {(mode === 'merge-files' || mode === 'merge-segments')
            ? t('Merged output file name:')
            : t('Output name(s):', { count: generated.fileNames.length })}
        </div>
      )}

      <div>
        {generated != null && (
          <div style={{ marginBottom: '.3em' }}>
            <HighlightedText title={open ? t('Close') : t('Edit')} role="button" onClick={handleSampleClick} style={{ wordBreak: 'break-word', cursor: 'pointer' }}>
              {generated.problems.error != null && <FaExclamationTriangle style={{ color: dangerColor, marginRight: '.2em', verticalAlign: 'middle' }} />}
              {generated.originalFileNames != null && formatCurrentSegFileOrFirst(generated.fileNames)}
              <span style={generated.originalFileNames != null ? { textDecoration: 'line-through', marginLeft: '.3em', color: dangerColor } : undefined}>
                {formatCurrentSegFileOrFirst(generated.originalFileNames ?? generated.fileNames)}
              </span>
              {open ? (
                <FaCaretUp style={{ fontSize: '.9em', marginLeft: '.4em', verticalAlign: 'middle' }} />
              ) : (
                <FaEdit style={{ fontSize: '.9em', marginLeft: '.4em', verticalAlign: 'middle' }} />
              )}
            </HighlightedText>
          </div>
        )}

        <AnimatePresence>
          {open && (
            <motion.div
              key="1"
              style={{ border: '.1em solid var(--gray-5)', padding: '.5em .7em', borderRadius: '.3em' }}
              initial={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: '.7em', marginBottom: '1em' }}
              exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
            >
              {!isSimpleMergeFilesMode && (
                <div style={{ color: 'var(--gray-11)', fontSize: '.8em' }}>{t('Output file name template')}:</div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '.2em', gap: '.5em' }}>
                <TextInput ref={inputRef} onChange={onTextChange} onKeyDown={onTextKeyDown} value={text} autoComplete="off" autoCapitalize="off" autoCorrect="off" style={{ padding: '.3em' }} />

                {generated != null && generated.fileNames.length > 1 && (
                  <Dialog.Root>
                    <Dialog.Trigger asChild>
                      <Button style={{ marginLeft: '.3em', padding: '.3em' }} title={t('Preview')}><FaEye /></Button>
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

                {!isSimpleMergeFilesMode && (
                  <>
                    <Button onClick={undo} disabled={!undoEnabled} title={t('Undo')} style={{ marginLeft: '.3em', padding: '.3em' }}><FaUndoAlt style={{ fontSize: '.8em' }} /></Button>
                    <Button onClick={redo} disabled={!redoEnabled} title={t('Redo')} style={{ padding: '.3em' }}><FaRedoAlt style={{ fontSize: '.8em' }} /></Button>

                    <Button onClick={reset} style={{ marginLeft: '.3em', padding: '.3em' }}><FaUndo style={{ fontSize: '.8em', color: dangerColor, marginRight: '.5em' }} />{t('Reset')}</Button>
                  </>
                )}
              </div>

              <div style={{ fontSize: '.9em', color: 'var(--gray-11)', display: 'flex', gap: '.3em', flexWrap: 'wrap', alignItems: 'center', marginBottom: '.7em' }}>
                {`${t('Variables')}:`}

                <IoIosHelpCircle fontSize="1.3em" color="var(--gray-12)" role="button" cursor="pointer" onClick={() => mainApi.openExternal(exportedFileNameTemplateHelpUrl)} />
                {availableVariables.map((variable) => (
                  <span key={variable} role="button" style={{ cursor: 'copy', marginRight: '.2em', textDecoration: 'underline', textDecorationStyle: 'dashed', fontSize: '.9em' }} onClick={() => onVariableClick(variable)}>{variable}</span>
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

              {!simpleMode && (
                <div title={t('Whether or not to sanitize output file names (sanitizing removes special characters)')} style={{ marginBottom: '.3em' }}>
                  <Switch checked={safeOutputFileName} onCheckedChange={toggleSafeOutputFileName} style={{ verticalAlign: 'middle', marginRight: '.5em' }} />
                  <span>{t('Sanitize file names')}</span>

                  {!safeOutputFileName && <FaExclamationTriangle color={warningColor} style={{ marginLeft: '.5em', verticalAlign: 'middle' }} />}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {generated?.problems.error != null ? (
          <div style={{ marginBottom: '1em' }}>
            <FaExclamationTriangle color={dangerColor} style={{ verticalAlign: 'middle', marginRight: '.3em' }} />{generated.problems.error}
          </div>
        ) : (
          generated != null && (
            <>
              {generated.problems.sameAsInputFileNameWarning && (
                <div style={{ marginBottom: '1em' }}>
                  <FaExclamationTriangle style={{ verticalAlign: 'middle', marginRight: '.3em' }} color={warningColor} />
                  {t('Output file name is the same as the source file name. This increases the risk of accidentally overwriting or deleting source files!')}
                </div>
              )}

              {/* In simple mode for merge-files, we auto generate file name, so there might be no ${EXT} variable */}
              {!isSimpleMergeFilesMode && isMissingExtension && (
                <div style={{ marginBottom: '1em' }}>
                  <FaExclamationTriangle style={{ verticalAlign: 'middle', marginRight: '.3em' }} color={warningColor} />
                  {t('The file name template is missing {{ext}} and will result in a file without the suggested extension. This may result in an unplayable output file.', { ext: extVariableFormatted })}
                </div>
              )}
            </>
          )
        )}
      </div>
    </>
  );
}

export default memo(FileNameTemplateEditor);
