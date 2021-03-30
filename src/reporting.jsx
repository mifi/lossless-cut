import React from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import i18n from 'i18next';
import { Trans } from 'react-i18next';

import CopyClipboardButton from './components/CopyClipboardButton';
import { isStoreBuild, isMasBuild, isWindowsStoreBuild } from './util';


const ReactSwal = withReactContent(Swal);

// eslint-disable-next-line import/prefer-default-export
export function openSendReportDialog(err, state) {
  const reportInstructions = isStoreBuild
    ? <p><Trans>Please send an email to <span style={{ fontWeight: 'bold' }} role="button" onClick={() => window.util.openExternal('mailto:losslesscut@yankee.no')}>losslesscut@yankee.no</span> where you describe what you were doing.</Trans></p>
    : <p><Trans>Please create an issue at <span style={{ fontWeight: 'bold' }} role="button" onClick={() => window.util.openExternal('https://github.com/mifi/lossless-cut/issues')}>https://github.com/mifi/lossless-cut/issues</span> where you describe what you were doing.</Trans></p>;

  const { platform } = window.util;
  const version = window.util.getAppVersion();

  const text = `${err ? err.stack : 'No error'}\n\n${JSON.stringify({
    err: err && {
      code: err.code,
      killed: err.killed,
      failed: err.failed,
      timedOut: err.timedOut,
      isCanceled: err.isCanceled,
      exitCode: err.exitCode,
      signal: err.signal,
      signalDescription: err.signalDescription,
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
    html: (
      <div style={{ textAlign: 'left', overflow: 'auto', maxHeight: 300, overflowY: 'auto' }}>
        {reportInstructions}

        <p><Trans>Include the following text:</Trans> <CopyClipboardButton text={text} /></p>

        <div style={{ fontWeight: 600, fontSize: 12, whiteSpace: 'pre-wrap' }} contentEditable suppressContentEditableWarning>
          {text}
        </div>
      </div>
    ),
  });
}
