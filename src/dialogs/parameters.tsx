import { useState, useCallback, useRef, useEffect } from 'react';
import { Button, TextInputField, LinkIcon } from 'evergreen-ui';
import i18n from 'i18next';
import withReactContent from 'sweetalert2-react-content';

import Swal from '../swal';


const { shell } = window.require('electron');

const ReactSwal = withReactContent(Swal);

export interface ParameterDialogParameter { value: string, label?: string, hint?: string }
export type ParameterDialogParameters = Record<string, ParameterDialogParameter>;

const ParametersInput = ({ description, parameters: parametersIn, onChange, onSubmit, docUrl }: {
  description?: string, parameters: ParameterDialogParameters, onChange: (a: ParameterDialogParameters) => void, onSubmit: () => void, docUrl?: string,
}) => {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [parameters, setParameters] = useState(parametersIn);

  const getParameter = (key: string) => parameters[key]?.value;

  const handleChange = (key: string, value: string) => setParameters((existing) => {
    const newParameters = { ...existing, [key]: { ...existing[key], value } };
    onChange(newParameters);
    return newParameters;
  });

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    onSubmit();
  }, [onSubmit]);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  return (
    <div style={{ textAlign: 'left' }}>
      {description && <p>{description}</p>}

      {docUrl && <p><Button iconBefore={LinkIcon} onClick={() => shell.openExternal(docUrl)}>Read more</Button></p>}

      <form onSubmit={handleSubmit}>
        {Object.entries(parametersIn).map(([key, parameter], i) => (
          <TextInputField ref={i === 0 ? firstInputRef : undefined} key={key} label={parameter.label || key} value={getParameter(key)} onChange={(e) => handleChange(key, e.target.value)} hint={parameter.hint} />
        ))}

        <input type="submit" value="submit" style={{ display: 'none' }} />
      </form>
    </div>
  );
};

// eslint-disable-next-line import/prefer-default-export
export async function showParametersDialog({ title, description, parameters: parametersIn, docUrl }: { title?: string, description?: string, parameters: ParameterDialogParameters, docUrl?: string }) {
  let parameters = parametersIn;
  let resolve1;

  const promise1 = new Promise((resolve) => {
    resolve1 = resolve;
  });
  const handleSubmit = () => {
    Swal.close();
    resolve1(true);
  };

  const promise2 = (async () => {
    const { isConfirmed } = await ReactSwal.fire({
      title,
      html: <ParametersInput description={description} parameters={parameters} onChange={(newParameters) => { parameters = newParameters; }} onSubmit={handleSubmit} docUrl={docUrl} />,
      confirmButtonText: i18n.t('Confirm'),
      showCancelButton: true,
      cancelButtonText: i18n.t('Cancel'),
    });
    return isConfirmed;
  })();

  const isConfirmed = await Promise.race([promise1, promise2]);
  if (!isConfirmed) return undefined;

  return Object.fromEntries(Object.entries(parameters).map(([key, parameter]) => [key, parameter.value]));
}
