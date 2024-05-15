import withReactContent from 'sweetalert2-react-content';
import i18n from 'i18next';
import { Trans } from 'react-i18next';
import { CSSProperties } from 'react';

import CopyClipboardButton from './components/CopyClipboardButton';
import { isStoreBuild, isMasBuild, isWindowsStoreBuild } from './util';
import Swal from './swal';

const electron = window.require('electron');

const remote = window.require('@electron/remote');

const { app } = remote;

const { platform } = remote.require('./index.js');


const ReactSwal = withReactContent(Swal);

const linkStyle: CSSProperties = { fontWeight: 'bold', cursor: 'pointer' };


// eslint-disable-next-line import/prefer-default-export
export function openSendReportDialog(err: unknown | undefined, state?: unknown) {
  const reportInstructions = isStoreBuild
    ? (
      <p><Trans>Please send an email to <span style={linkStyle} role="button" onClick={() => electron.shell.openExternal('mailto:losslesscut@mifi.no')}>losslesscut@mifi.no</span> where you describe what you were doing.</Trans></p>
    ) : (
      <Trans>
        <p>
          If you&apos;re having a problem or question about LosslessCut, please first check the links in the <b>Help</b> menu. If you cannot find any resolution, you may ask a question in <span style={linkStyle} role="button" onClick={() => electron.shell.openExternal('https://github.com/mifi/lossless-cut/discussions')}>GitHub discussions</span> or on <span style={linkStyle} role="button" onClick={() => electron.shell.openExternal('https://github.com/mifi/lossless-cut')}>Discord.</span>
        </p>
        <p>
          If you believe that you found a bug in LosslessCut, you may <span style={linkStyle} role="button" onClick={() => electron.shell.openExternal('https://github.com/mifi/lossless-cut/issues')}>report a bug</span>.
        </p>
      </Trans>
    );

  const version = app.getVersion();

  const text = `${err instanceof Error ? err.stack : 'No error occurred.'}\n\n${JSON.stringify({
    err: err instanceof Error && {
      code: err['code'],
      killed: err['killed'],
      failed: err['failed'],
      timedOut: err['timedOut'],
      isCanceled: err['isCanceled'],
      exitCode: err['exitCode'],
      signal: err['signal'],
      signalDescription: err['signalDescription'],
    },

    state,

    platform,
    version,
    isWindowsStoreBuild,
    isMasBuild,
  }, null, 2)}`;

  ReactSwal.fire({
    showCloseButton: true,
    title: i18n.t('Send problem report'),
    showConfirmButton: false,
    html: (
      <div style={{ textAlign: 'left', overflow: 'auto', maxHeight: 300, overflowY: 'auto' }}>
        {reportInstructions}

        <p><Trans>Include the following text:</Trans> <CopyClipboardButton text={text} /></p>

        {!isStoreBuild && <p style={{ fontSize: '.8em', color: 'rgba(0,0,0,0.5)' }}><Trans>You might want to redact any sensitive information like paths.</Trans></p>}

        <div style={{ fontWeight: 600, fontSize: 12, whiteSpace: 'pre-wrap', color: '#900' }} contentEditable suppressContentEditableWarning>
          {text}
        </div>
      </div>
    ),
  });
}
