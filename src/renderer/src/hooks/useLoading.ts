import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { abortFfmpegs } from '../ffmpeg';


export interface WorkingState {
  text: string,
  abortController?: AbortController | undefined,
}

export default function useLoading() {
  const { t } = useTranslation();

  const [working, setWorkingState] = useState<WorkingState | undefined>();

  // Store "working" in a ref so we can avoid race conditions
  const workingRef = useRef(!!working);

  const setWorking = useCallback((valOrBool?: WorkingState | true | undefined) => {
    workingRef.current = !!valOrBool;
    const val = valOrBool === true ? { text: t('Loading') } : valOrBool;
    setWorkingState(val);
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
}

export type SetWorking = ReturnType<typeof useLoading>['setWorking'];
