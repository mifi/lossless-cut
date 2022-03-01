import React, { memo } from 'react';

import i18n from 'i18next';
import { useTranslation, Trans } from 'react-i18next';

import SetCutpointButton from './components/SetCutpointButton';
import SimpleModeButton from './components/SimpleModeButton';
import useUserSettings from './hooks/useUserSettings';

const electron = window.require('electron');

const NoFileLoaded = memo(({ mifiLink, toggleHelp, currentCutSeg }) => {
  const { t } = useTranslation();
  const { simpleMode, toggleSimpleMode } = useUserSettings();

  return (
    <div className="no-user-select" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, border: '2vmin dashed #252525', color: '#505050', margin: '5vmin', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }}>
      <div style={{ fontSize: '6vmin', textTransform: 'uppercase' }}>{t('DROP FILE(S)')}</div>

      <div style={{ fontSize: '4vmin', color: '#777', cursor: 'pointer' }} role="button" onClick={toggleHelp}>
        <Trans>Press <kbd>H</kbd> for help</Trans>
      </div>

      <div style={{ fontSize: '3vmin', color: '#ccc' }}>
        <Trans><SetCutpointButton currentCutSeg={currentCutSeg} side="start" style={{ verticalAlign: 'middle' }} /> <SetCutpointButton currentCutSeg={currentCutSeg} side="end" style={{ verticalAlign: 'middle' }} /> or <kbd>I</kbd> <kbd>O</kbd> to set cutpoints</Trans>
      </div>

      <div style={{ fontSize: '3vmin', color: '#ccc', cursor: 'pointer' }} role="button" onClick={toggleSimpleMode}>
        <SimpleModeButton style={{ verticalAlign: 'middle' }} size={16} /> {simpleMode ? i18n.t('to show advanced view') : i18n.t('to show simple view')}
      </div>


      {mifiLink && mifiLink.loadUrl && (
        <div style={{ position: 'relative', margin: '3vmin', width: '60vmin', height: '20vmin' }}>
          <iframe src={mifiLink.loadUrl} title="iframe" style={{ background: 'rgba(0,0,0,0)', border: 'none', pointerEvents: 'none', width: '100%', height: '100%', position: 'absolute' }} />
          {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
          <div style={{ width: '100%', height: '100%', position: 'absolute', cursor: 'pointer' }} role="button" onClick={() => electron.shell.openExternal(mifiLink.targetUrl)} />
        </div>
      )}
    </div>
  );
});

export default NoFileLoaded;
