import React, { memo } from 'react';

import { useTranslation, Trans } from 'react-i18next';

import SetCutpointButton from './components/SetCutpointButton';
import SimpleModeButton from './components/SimpleModeButton';
import useUserSettings from './hooks/useUserSettings';

const electron = window.require('electron');

const NoFileLoaded = memo(({ mifiLink, currentCutSeg, onClick }) => {
  const { t } = useTranslation();
  const { simpleMode } = useUserSettings();

  return (
    <div
      className="no-user-select"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, border: '1.5vmin dashed var(--gray3)', color: 'var(--gray12)', margin: '5vmin', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }}
      role="button"
      onClick={onClick}
    >
      <div style={{ fontSize: '6vmin', textTransform: 'uppercase', color: 'var(--gray11)' }}>{t('DROP FILE(S)')}</div>

      <div style={{ fontSize: '2.5vmin', color: 'var(--gray11)', marginBottom: '.3em' }}>
        <Trans>See <b>Help</b> menu for help</Trans>
      </div>

      <div style={{ fontSize: '2.5vmin', color: 'var(--gray11)' }}>
        <Trans><SetCutpointButton currentCutSeg={currentCutSeg} side="start" style={{ verticalAlign: 'middle' }} /> <SetCutpointButton currentCutSeg={currentCutSeg} side="end" style={{ verticalAlign: 'middle' }} /> or <kbd>I</kbd> <kbd>O</kbd> to set cutpoints</Trans>
      </div>

      <div style={{ fontSize: '2.5vmin', color: 'var(--gray11)' }} role="button" onClick={(e) => e.stopPropagation()}>
        {simpleMode ? (
          <Trans><SimpleModeButton style={{ verticalAlign: 'middle' }} size={16} /> to show advanced view</Trans>
        ) : (
          <Trans><SimpleModeButton style={{ verticalAlign: 'middle' }} size={16} /> to show simple view</Trans>
        )}
      </div>


      {mifiLink && mifiLink.loadUrl && (
        <div style={{ position: 'relative', margin: '3vmin', width: '60vmin', height: '20vmin' }}>
          <iframe src={mifiLink.loadUrl} title="iframe" style={{ background: 'rgba(0,0,0,0)', border: 'none', pointerEvents: 'none', width: '100%', height: '100%', position: 'absolute' }} />
          {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
          <div style={{ width: '100%', height: '100%', position: 'absolute', cursor: 'pointer' }} role="button" onClick={(e) => { e.stopPropagation(); electron.shell.openExternal(mifiLink.targetUrl); }} />
        </div>
      )}
    </div>
  );
});

export default NoFileLoaded;
