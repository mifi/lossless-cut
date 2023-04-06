import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from 'use-debounce';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { WarningSignIcon, ErrorIcon, Button, IconButton, TickIcon, ResetIcon } from 'evergreen-ui';
import withReactContent from 'sweetalert2-react-content';

import Swal from '../swal';
import HighlightedText from './HighlightedText';
import { defaultOutSegTemplate } from '../util/outputNameTemplate';
import useUserSettings from '../hooks/useUserSettings';

const ReactSwal = withReactContent(Swal);

// eslint-disable-next-line no-template-curly-in-string
const extVar = '${EXT}';

const inputStyle = { flexGrow: 1, fontFamily: 'inherit', fontSize: '.8em', backgroundColor: 'var(--gray3)', color: 'var(--gray12)', border: '1px solid var(--gray7)', appearance: 'none' };

const OutSegTemplateEditor = memo(({ outSegTemplate, setOutSegTemplate, generateOutSegFileNames, currentSegIndexSafe, getOutSegError }) => {
  const { safeOutputFileName, toggleSafeOutputFileName } = useUserSettings();

  const [text, setText] = useState(outSegTemplate);
  const [debouncedText] = useDebounce(text, 500);
  const [validText, setValidText] = useState();
  const [error, setError] = useState();
  const [outSegFileNames, setOutSegFileNames] = useState();
  const [shown, setShown] = useState();
  const inputRef = useRef(null);

  const { t } = useTranslation();

  useEffect(() => {
    if (debouncedText == null) return;

    try {
      const newOutSegFileNames = generateOutSegFileNames({ template: debouncedText });
      setOutSegFileNames(newOutSegFileNames);
      const outSegError = getOutSegError(newOutSegFileNames);
      if (outSegError) {
        setError(outSegError);
        setValidText();
        return;
      }

      setValidText(debouncedText);
      setError();
    } catch (err) {
      console.error(err);
      setValidText();
      setError(err.message);
    }
  }, [debouncedText, generateOutSegFileNames, getOutSegError, t]);

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
    if (error == null) setShown(false);
  }, [error]);

  const onShowClick = useCallback(() => {
    if (!shown) setShown(true);
  }, [shown]);

  const onTextChange = useCallback((e) => setText(e.target.value), []);

  const needToShow = shown || error != null;

  const onTextClick = useCallback(() => {
    inputRef.current.focus();
  }, []);
  
  const onVariableClick = useCallback((variable) => {
    const input = inputRef.current;
    const startPos = input.selectionStart;
    const endPos = input.selectionEnd;
  
    const newValue = `${text.slice(0, startPos)}${'${' + variable + '}' + text.slice(endPos)}`;
    setText(newValue);
  
    // Move the cursor to after the inserted variable
    const newPos = startPos + variable.length + 2;
    input.selectionStart = newPos;
    input.selectionEnd = newPos;
  }, [text]);

  return (
    <>
      <div>
        <div>{outSegFileNames != null && t('Output name(s):', { count: outSegFileNames.length })}</div>

        {outSegFileNames != null && <HighlightedText role="button" onClick={onShowClick} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: needToShow ? undefined : 'pointer' }}>{outSegFileNames[currentSegIndexSafe] || outSegFileNames[0] || '-'}</HighlightedText>}
      </div>

      {needToShow && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5, marginTop: 10 }}>
          <input type="text" ref={inputRef} style={inputStyle} onChange={onTextChange} onClick={onTextClick} value={text} autoComplete="off" autoCapitalize="off" autoCorrect="off" />

            {outSegFileNames != null && <Button height={20} onClick={onAllSegmentsPreviewPress} marginLeft={5}>{t('Preview')}</Button>}
            <Button title={t('Whether or not to sanitize output file names (sanitizing removes special characters)')} marginLeft={5} height={20} onClick={toggleSafeOutputFileName} intent={safeOutputFileName ? 'success' : 'danger'}>{safeOutputFileName ? t('Sanitize') : t('No sanitize')}</Button>
            <IconButton title={t('Reset')} icon={ResetIcon} height={20} onClick={reset} marginLeft={5} intent="danger" />
            <IconButton title={t('Close')} icon={TickIcon} height={20} onClick={onHideClick} marginLeft={5} intent="success" />
          </div>
          <div style={{ maxWidth: 600 }}>
            {error != null && <div style={{ marginBottom: '1em' }}><ErrorIcon color="var(--red9)" /> {i18n.t('There is an error in the file name template:')} {error}</div>}
            {isMissingExtension && <div style={{ marginBottom: '1em' }}><WarningSignIcon color="var(--amber9)" /> {i18n.t('The file name template is missing {{ext}} and will result in a file without the suggested extension. This may result in an unplayable output file.', { ext: extVar })}</div>}
            <div style={{ fontSize: '.8em', color: 'var(--gray11)' }}>
              {`${i18n.t('Variables')}`}{': '}
              {['FILENAME', 'TIMESTAMP', 'CUT_FROM', 'CUT_TO', 'SEG_NUM', 'SEG_LABEL', 'SEG_SUFFIX', 'EXT', 'SEG_TAGS.XX'].map((variable) => (
                <span key={variable} role="button" style={{ cursor: 'pointer', marginRight: '.2em' }} onClick={() => onVariableClick(variable)}>{variable}</span>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
});

export default OutSegTemplateEditor;
