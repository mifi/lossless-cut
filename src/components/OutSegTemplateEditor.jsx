import React, { memo, useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { Button, Alert, IconButton, TickIcon, ResetIcon } from 'evergreen-ui';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

import HighlightedText from './HighlightedText';
import { defaultOutSegTemplate } from '../util';

const ReactSwal = withReactContent(Swal);


const OutSegTemplateEditor = memo(({ helpIcon, outSegTemplate, setOutSegTemplate, generateOutSegFileNames, currentSegIndexSafe, isOutSegFileNamesValid, safeOutputFileName, toggleSafeOutputFileName }) => {
  const [text, setText] = useState(outSegTemplate);
  const [debouncedText] = useDebounce(text, 500);
  const [validText, setValidText] = useState();
  const [error, setError] = useState();
  const [outSegFileNames, setOutSegFileNames] = useState();
  const [shown, setShown] = useState();

  const { t } = useTranslation();

  useEffect(() => {
    if (debouncedText == null) return;

    try {
      const generatedOutSegFileNames = generateOutSegFileNames({ template: debouncedText });
      setOutSegFileNames(generatedOutSegFileNames);
      const isOutSegTemplateValid = isOutSegFileNamesValid(generatedOutSegFileNames);
      if (!isOutSegTemplateValid) {
        setError(t('This template will result in invalid file names'));
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
  }, [debouncedText, generateOutSegFileNames, isOutSegFileNamesValid, t]);

  const onAllSegmentsPreviewPress = () => ReactSwal.fire({ title: t('Resulting segment file names'), html: <div style={{ textAlign: 'left', overflowY: 'auto', maxHeight: 400 }}>{outSegFileNames.map((f) => <div key={f} style={{ marginBottom: 7 }}>{f}</div>)}</div> });

  useEffect(() => {
    if (validText != null) setOutSegTemplate(validText);
  }, [validText, setOutSegTemplate]);

  function reset() {
    setOutSegTemplate(defaultOutSegTemplate);
    setText(defaultOutSegTemplate);
  }

  function onToggleClick() {
    if (!shown) setShown(true);
    else if (error == null) setShown(false);
  }

  return (
    <>
      <div>
        <span role="button" onClick={onToggleClick} style={{ cursor: 'pointer' }}>
          {t('Output name(s):')} {outSegFileNames != null && <HighlightedText style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{outSegFileNames[currentSegIndexSafe] || outSegFileNames[0]}</HighlightedText>}
        </span>
        {helpIcon}
      </div>

      {shown && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5, marginTop: 5 }}>
            <input type="text" style={{ flexGrow: 1, fontFamily: 'inherit', fontSize: '.8em' }} onChange={(e) => setText(e.target.value)} value={text} autoComplete="off" autoCapitalize="off" autoCorrect="off" />
            {outSegFileNames && <Button height={20} onClick={onAllSegmentsPreviewPress} marginLeft={5}>{t('Preview')}</Button>}
            <Button title={t('Whether or not to sanitize output file names (sanitizing removes special characters)')} marginLeft={5} height={20} onClick={toggleSafeOutputFileName} intent={safeOutputFileName ? 'success' : 'danger'}>{safeOutputFileName ? t('Sanitize') : t('No sanitize')}</Button>
            <IconButton title={t('Reset')} icon={ResetIcon} height={20} onClick={reset} marginLeft={5} intent="danger" />
            <IconButton title={t('Close')} icon={TickIcon} height={20} onClick={onToggleClick} marginLeft={5} intent="success" />
          </div>
          <div>
            {error != null && <Alert intent="danger" appearance="card">{`${i18n.t('There is an error in the file name template:')} ${error}`}</Alert>}
            {/* eslint-disable-next-line no-template-curly-in-string */}
            <div style={{ fontSize: '.8em', color: 'rgba(255,255,255,0.7)' }}>{`${i18n.t('Variables')}`} {'${FILENAME} ${CUT_FROM} ${CUT_TO} ${SEG_NUM} ${SEG_LABEL} ${SEG_SUFFIX} ${EXT} ${SEG_TAGS.XX}'}</div>
          </div>
        </>
      )}
    </>
  );
});

export default OutSegTemplateEditor;
