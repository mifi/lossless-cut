import i18n from 'i18next';
import { useCallback, useState } from 'react';

import { DirectoryAccessDeclinedError, UnsupportedFileError } from '../../errors';
import { isAbortedError } from '../util';
import { GenericError } from '../components/ErrorDialog';


export default function useErrorHandling() {
  const [genericError, setGenericError] = useState<GenericError | undefined>();

  const handleError = useCallback(({ title, err }: { title?: string | undefined, err?: unknown | undefined }) => {
    console.error('handleError', title, err);
    setGenericError({ title, err });
  }, []);

  /**
   * Run an operation with error handling
   */
  async function withErrorHandling(operation: () => Promise<void>, errorMsgOrFn?: string | ((err: unknown) => string)) {
    try {
      await operation();
    } catch (err) {
      if (err instanceof DirectoryAccessDeclinedError || isAbortedError(err)) return;

      if (err instanceof UnsupportedFileError) {
        handleError({ err: i18n.t('Unsupported file') });
        return;
      }

      let errorMsg: string | undefined;
      if (typeof errorMsgOrFn === 'string') errorMsg = errorMsgOrFn;
      if (typeof errorMsgOrFn === 'function') errorMsg = errorMsgOrFn(err);
      if (errorMsg != null) {
        console.error(errorMsg, err);
        handleError({ err, title: errorMsg });
      } else {
        handleError({ err });
      }
    }
  }

  return {
    withErrorHandling,
    handleError,
    genericError,
    setGenericError,
  };
}

export type WithErrorHandling = ReturnType<typeof useErrorHandling>['withErrorHandling'];
