import { Fragment, memo, useMemo } from 'react';

import { useTranslation, Trans } from 'react-i18next';

import SetCutpointButton from './components/SetCutpointButton';
import SimpleModeButton from './components/SimpleModeButton';
import useUserSettings from './hooks/useUserSettings';
import { StateSegment } from './types';
import { KeyBinding, KeyboardAction } from '../../../types';
import { splitKeyboardKeys } from './util';

const electron = window.require('electron');

function Keys({ keys }: { keys: string }) {
  const split = splitKeyboardKeys(keys);
  return split.map((key, i) => (
    <Fragment key={key}><kbd>{key.toUpperCase()}</kbd>{i < split.length - 1 && <span style={{ fontSize: '.7em', marginLeft: '-.2em', marginRight: '-.2em' }}>{' + '}</span>}</Fragment>
  ));
}

function NoFileLoaded({ mifiLink, currentCutSeg, onClick, darkMode, keyBindingByAction }: {
  mifiLink: unknown,
  currentCutSeg: StateSegment | undefined,
  onClick: () => void,
  darkMode?: boolean,
  keyBindingByAction: Record<KeyboardAction, KeyBinding>,
}) {
  const { t } = useTranslation();
  const { simpleMode } = useUserSettings();

  const currentCutSegOrDefault = useMemo(() => currentCutSeg ?? { segColorIndex: 0 }, [currentCutSeg]);

  return (
    <div
      className="no-user-select"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, border: '.7em dashed var(--gray3)', color: 'var(--gray12)', margin: '2em', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }}
      role="button"
      onClick={onClick}
    >
      <div style={{ fontSize: '2em', textTransform: 'uppercase', color: 'var(--gray11)', marginBottom: '.2em' }}>{t('DROP FILE(S)')}</div>

      <div style={{ fontSize: '1.3em', color: 'var(--gray11)', marginBottom: '.1em' }}>
        <Trans>See <b>Help</b> menu for help</Trans>
      </div>

      <div style={{ fontSize: '1.3em', color: 'var(--gray11)' }}>
        <Trans><SetCutpointButton currentCutSeg={currentCutSegOrDefault} side="start" style={{ verticalAlign: 'middle' }} /> <SetCutpointButton currentCutSeg={currentCutSegOrDefault} side="end" style={{ verticalAlign: 'middle' }} /> or <Keys keys={keyBindingByAction.setCutStart.keys} /> <Keys keys={keyBindingByAction.setCutEnd.keys} /> to set cutpoints</Trans>
      </div>

      <div style={{ fontSize: '1.3em', color: 'var(--gray11)' }} role="button" onClick={(e) => e.stopPropagation()}>
        {simpleMode ? (
          <Trans><SimpleModeButton style={{ verticalAlign: 'middle' }} size={16} /> to show advanced view</Trans>
        ) : (
          <Trans><SimpleModeButton style={{ verticalAlign: 'middle' }} size={16} /> to show simple view</Trans>
        )}
      </div>

      {mifiLink && typeof mifiLink === 'object' && 'loadUrl' in mifiLink && typeof mifiLink.loadUrl === 'string' && mifiLink.loadUrl ? (
        <div style={{ position: 'relative', margin: '.3em', width: '24em', height: '8em' }}>
          <iframe src={`${mifiLink.loadUrl}#dark=${darkMode ? 'true' : 'false'}`} title="iframe" style={{ background: 'rgba(0,0,0,0)', border: 'none', pointerEvents: 'none', width: '100%', height: '100%', position: 'absolute', colorScheme: 'initial' }} />
          {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
          <div style={{ width: '100%', height: '100%', position: 'absolute', cursor: 'pointer' }} role="button" onClick={(e) => { e.stopPropagation(); if ('targetUrl' in mifiLink && typeof mifiLink.targetUrl === 'string') electron.shell.openExternal(mifiLink.targetUrl); }} />
        </div>
      ) : undefined}
    </div>
  );
}

export default memo(NoFileLoaded);
