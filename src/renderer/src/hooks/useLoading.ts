import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { abortFfmpegs } from '../ffmpeg';


export default () => {
  const { t } = useTranslation();

  const [working, setWorkingState] = useState<{ text: string, abortController?: AbortController | undefined }>();

  // Store "working" in a ref so we can avoid race conditions
  const workingRef = useRef(!!working);
  const setWorking = useCallback((valOrBool?: { text: string, abortController?: AbortController } | true | undefined) => {
    workingRef.current = !!valOrBool;
    const val = valOrBool === true ? { text: t('Loading') } : valOrBool;
    setWorkingState(val ? { text: val.text, abortController: val.abortController } : undefined);
  }, [t]);

  const abortWorking = useCallback(() => {
    console.log('User clicked abort');
    abortFfmpegs(); // todo use abortcontroller for this also
    working?.abortController?.abort();
  }, [working?.abortController]);

  return {
    working,
    workingRef,
    setWorking,
    abortWorking,
  };
};
