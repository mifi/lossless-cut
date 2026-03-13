import { useTranslation } from 'react-i18next';
import type { FormEventHandler, ReactNode } from 'react';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';

import * as AlertDialog from './AlertDialog';
import { DialogButton } from './Button';
import TextInput from './TextInput';
import { useGenericDialogContext } from './GenericDialog';
import { ButtonRow } from './Dialog';
import styles from './ExpressionDialog.module.css';


interface Props {
  onSubmit: (value: string) => Promise<{ error: string } | undefined>,
  examples: { name: string, code: string }[],
  title: string,
  description: ReactNode,
  variables?: string[],
  inputValue?: string | undefined,
  confirmButtonText?: string,
}

// eslint-disable-next-line react/display-name
const ExpressionDialog = forwardRef<HTMLDivElement, Props>(({ onSubmit, examples, title, description, variables, inputValue, confirmButtonText }, ref) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(inputValue ?? '');
  const [error, setError] = useState<string | undefined>();

  const { onOpenChange } = useGenericDialogContext();

  const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>(async (e) => {
    e.preventDefault();
    const resp = await onSubmit(value);
    setError(resp?.error);

    if (resp == null) {
      // success
      onOpenChange(false);
    }
  }, [onOpenChange, onSubmit, value]);

  const valueRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    valueRef.current?.focus();
  }, []);

  const onExampleClick = useCallback((code: string) => {
    setValue(code);
    valueRef.current?.focus();
  }, []);

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <AlertDialog.Content ref={ref as any} aria-describedby={undefined} className={styles['content']}>
      <AlertDialog.Title>{title}</AlertDialog.Title>

      {description && <AlertDialog.Description className={styles['description']}>{description}</AlertDialog.Description>}

      {variables && (
        <div className={styles['variables']}>{t('Variables')}: {variables.map((v) => <code key={v} className="highlighted">{v}</code>)}</div>
      )}

      <div className={styles['examplesTitle']}>{t('Examples')}:</div>

      <div className={styles['examples']}>
        {examples.map(({ name, code }) => (
          <button key={code} type="button" onClick={() => onExampleClick(code)} className={styles['exampleButton']}>
            {name}
          </button>
        ))}
      </div>

      {/* Keep the expression input full-width and visually dominant; it is the only required action in this dialog. */}
      <form className={styles['form']} onSubmit={handleSubmit}>
        <TextInput
          ref={valueRef}
          placeholder={t('Enter JavaScript expression')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={styles['input']}
          style={{ padding: '0 1rem' }}
        />

        {error != null && (
          <div className={styles['error']}>
            {error}
          </div>
        )}

        <ButtonRow>
          <AlertDialog.Cancel asChild>
            <DialogButton>{t('Cancel')}</DialogButton>
          </AlertDialog.Cancel>

          <DialogButton type="submit" primary>{confirmButtonText ?? t('Confirm')}</DialogButton>
        </ButtonRow>
      </form>
    </AlertDialog.Content>
  );
});

export default ExpressionDialog;
