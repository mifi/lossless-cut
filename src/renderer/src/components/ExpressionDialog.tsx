import { useTranslation } from 'react-i18next';
import { FormEventHandler, forwardRef, ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import * as AlertDialog from './AlertDialog';
import { DialogButton } from './Button';
import TextInput from './TextInput';
import { useGenericDialogContext } from './GenericDialog';
import { ButtonRow } from './Dialog';
import { dangerColor } from '../colors';


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
    <AlertDialog.Content ref={ref as any} aria-describedby={undefined} style={{ width: '80vw' }}>
      <AlertDialog.Title>{title}</AlertDialog.Title>

      {description && <AlertDialog.Description>{description}</AlertDialog.Description>}

      {variables && (
        <div style={{ marginBottom: '1em' }}>{t('Variables')}: {variables.map((v) => <code style={{ display: 'inline-block', marginRight: '.3em' }} key={v} className="highlighted">{v}</code>)}</div>
      )}

      <div><b>{t('Examples')}:</b></div>

      {examples.map(({ name, code }) => (
        <button key={code} type="button" onClick={() => onExampleClick(code)} className="link-button" style={{ display: 'block', marginBottom: '.1em' }}>
          {name}
        </button>
      ))}

      <form onSubmit={handleSubmit}>
        <TextInput
          ref={valueRef}
          placeholder={t('Enter JavaScript expression')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ margin: '1em 0', padding: '1em', width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }}
        />

        {error != null && (
          <div style={{ color: dangerColor, fontWeight: 'bold' }}>
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
