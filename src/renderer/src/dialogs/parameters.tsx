import { useState, useCallback, useRef, useEffect, FormEvent } from 'react';
import i18n from 'i18next';
import { FaLink } from 'react-icons/fa';

import Swal, { ReactSwal } from '../swal';
import Button from '../components/Button';
import TextInput from '../components/TextInput';
import { FfmpegDialog, getHint, getLabel } from '../ffmpegParameters';


const { shell } = window.require('electron');


export type ParameterDialogParameters = Record<string, string>;

const ParametersInput = ({ description, dialogType, parameters: parametersIn, onChange, onSubmit, docUrl }: {
  description?: string | undefined,
  dialogType: FfmpegDialog,
  parameters: ParameterDialogParameters,
  onChange: (a: ParameterDialogParameters) => void,
  onSubmit: () => void,
  docUrl?: string | undefined,
}) => {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [parameters, setParameters] = useState(parametersIn);

  const getParameter = (key: string) => parameters[key];

  const handleChange = (key: string, value: string) => setParameters((existing) => {
    const newParameters = { ...existing, [key]: value };
    onChange(newParameters);
    return newParameters;
  });

  const handleSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  }, [onSubmit]);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  return (
    <div style={{ textAlign: 'left', padding: '.5em', borderRadius: '.3em' }}>
      {description && <p>{description}</p>}

      {docUrl && <p><Button onClick={() => shell.openExternal(docUrl)}><FaLink style={{ fontSize: '.8em' }} /> Read more</Button></p>}

      <form onSubmit={handleSubmit}>
        {Object.entries(parametersIn).map(([key, parameter], i) => {
          const id = `parameter-${key}`;
          return (
            <div key={key} style={{ marginBottom: '.5em' }}>
              <label htmlFor={id} style={{ display: 'block', fontFamily: 'monospace', marginBottom: '.3em' }}>{getLabel(dialogType, parameter) || key}</label>
              <TextInput
                id={id}
                ref={i === 0 ? firstInputRef : undefined}
                value={getParameter(key)}
                onChange={(e) => handleChange(key, e.target.value)}
                style={{ marginBottom: '.2em' }}
              />
              {getHint(dialogType, key) && <div style={{ opacity: 0.6, fontSize: '0.8em' }}>{getHint(dialogType, key)}</div>}
            </div>
          );
        })}

        <input type="submit" value="submit" style={{ display: 'none' }} />
      </form>
    </div>
  );
};

export async function showParametersDialog({ title, description, dialogType, parameters: parametersIn, docUrl }: {
  title?: string,
  description?: string,
  dialogType: FfmpegDialog,
  parameters: ParameterDialogParameters,
  docUrl?: string,
}) {
  let parameters = parametersIn;
  let resolve1: (value: boolean) => void;

  const promise1 = new Promise<boolean>((resolve) => {
    resolve1 = resolve;
  });
  const handleSubmit = () => {
    Swal.close();
    resolve1(true);
  };

  const promise2 = (async () => {
    const { isConfirmed } = await ReactSwal.fire({
      title,
      html: (
        <ParametersInput
          description={description}
          dialogType={dialogType}
          parameters={parameters}
          onChange={(newParameters) => { parameters = newParameters; }}
          onSubmit={handleSubmit}
          docUrl={docUrl}
        />
      ),
      confirmButtonText: i18n.t('Confirm'),
      showCancelButton: true,
      cancelButtonText: i18n.t('Cancel'),
    });
    return isConfirmed;
  })();

  const isConfirmed = await Promise.race([promise1, promise2]);
  if (!isConfirmed) return undefined;

  return parameters;
}
