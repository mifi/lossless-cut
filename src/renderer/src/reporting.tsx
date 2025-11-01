import i18n from 'i18next';
import { Trans } from 'react-i18next';

import CopyClipboardButton from './components/CopyClipboardButton';
import { isStoreBuild, isMasBuild, isWindowsStoreBuild, isExecaError, appVersion } from './util';
import { ReactSwal } from './swal';

const electron = window.require('electron');

const remote = window.require('@electron/remote');

const { platform, arch } = remote.require('./index.js');


// eslint-disable-next-line import/prefer-default-export
export function openSendReportDialog({ err, message, state }: {
  err?: unknown | undefined,
  message?: string,
  state?: unknown,
}) {
  const reportInstructions = isStoreBuild
    ? (
      <p><Trans>Please send an email to <span className="link-button" role="button" onClick={() => electron.shell.openExternal('mailto:losslesscut@mifi.no')}>losslesscut@mifi.no</span> where you describe what you were doing.</Trans></p>
    ) : (
      <Trans>
        <p>
          If you&apos;re having a problem or question about LosslessCut, please first check the links in the <b>Help</b> menu. If you cannot find any resolution, you may ask a question in <span className="link-button" role="button" onClick={() => electron.shell.openExternal('https://github.com/mifi/lossless-cut/discussions')}>GitHub discussions</span> or on <span className="link-button" role="button" onClick={() => electron.shell.openExternal('https://github.com/mifi/lossless-cut')}>Discord.</span>
        </p>
        <p>
          If you believe that you found a bug in LosslessCut, you may <span className="link-button" role="button" onClick={() => electron.shell.openExternal('https://github.com/mifi/lossless-cut/issues')}>report a bug</span>.
        </p>
      </Trans>
    );

  const errorText = (() => {
    if (err == null) return 'No error occurred.';
    return err instanceof Error ? err.stack : String(err);
  })();

  const jsonReport = JSON.stringify({
    err: isExecaError(err) && {
      code: err.code,
      isTerminated: err.isTerminated,
      failed: err.failed,
      timedOut: err.timedOut,
      isCanceled: err.isCanceled,
      exitCode: err.exitCode,
      signal: err.signal,
      signalDescription: err.signalDescription,
    },

    state,

    platform,
    arch,
    version: appVersion,
    isWindowsStoreBuild,
    isMasBuild,
  }, null, 2);

  const lines = [
    ...(message != null ? [message] : []),
    errorText,
    '',
    'App state:',
    jsonReport,
  ];

  const text = lines.join('\n');

  ReactSwal.fire({
    showCloseButton: true,
    title: i18n.t('Send problem report'),
    showConfirmButton: false,
    html: (
      <div style={{ textAlign: 'left', overflow: 'auto', maxHeight: 300, overflowY: 'auto' }}>
        {reportInstructions}

        <p style={{ marginBottom: 0 }}><Trans>Include the following text:</Trans> <CopyClipboardButton text={text} /></p>

        {!isStoreBuild && <p style={{ marginTop: '.2em', fontSize: '.8em', opacity: 0.7 }}><Trans>You might want to redact any sensitive information like paths.</Trans></p>}

        <div style={{ fontWeight: 600, fontSize: '.75em', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--gray-11)', backgroundColor: 'var(--gray-3)', padding: '.3em' }} contentEditable suppressContentEditableWarning>
          {text}
        </div>
      </div>
    ),
  });
}
