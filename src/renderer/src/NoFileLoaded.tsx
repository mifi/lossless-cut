import type { CSSProperties } from 'react';
import { Fragment, memo, useState } from 'react';
import type { MotionStyle } from 'motion/react';
import { motion } from 'motion/react';
import { FaMouse } from 'react-icons/fa';
import { LuArrowLeftToLine, LuArrowRightToLine, LuFilm } from 'react-icons/lu';
import { useTranslation, Trans } from 'react-i18next';

import SimpleModeButton from './components/SimpleModeButton';
import useUserSettings from './hooks/useUserSettings';
import type { KeyBinding } from '../../common/types';
import { splitKeyboardKeys } from './util';
import { getModifier } from './hooks/useTimelineScroll';
import Kbd from './components/Kbd';
import mainApi from './mainApi';


function Keys({ keys }: { keys: string | undefined }) {
  if (keys == null || keys === '') {
    return <kbd>UNBOUND</kbd>;
  }
  const split = splitKeyboardKeys(keys);
  return split.map((key, i) => (
    <Fragment key={key}><Kbd code={key} />{i < split.length - 1 && <span style={{ fontSize: '.7em', marginLeft: '-.2em', marginRight: '-.2em' }}>{' + '}</span>}</Fragment>
  ));
}

// Mirrors the Start/End buttons in the bottom bar. Must stay a leaf element, so that the translation key doesn't change
function CutpointIcon({ side }: { side: 'start' | 'end' }) {
  const Icon = side === 'start' ? LuArrowRightToLine : LuArrowLeftToLine;
  return <span className="llc-chip" style={{ verticalAlign: 'middle' }}><Icon /></span>;
}

const dropzoneStyle: MotionStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  color: 'var(--llc-text-1)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '.7em',
  whiteSpace: 'nowrap',
  borderWidth: 2,
  borderStyle: 'dashed',
  borderRadius: 'var(--llc-radius-panel)',
  borderColor: 'var(--llc-control-border)',
  background: 'var(--llc-panel-bg)',
  cursor: 'pointer',
};

const hintStyle: CSSProperties = { fontSize: '.85em', color: 'var(--llc-text-2)' };

function NoFileLoaded({ mifiLink, onClick, darkMode, keyBindingByAction }: {
  mifiLink: unknown,
  onClick: () => void,
  darkMode?: boolean,
  keyBindingByAction: Record<string, KeyBinding>,
}) {
  const { t } = useTranslation();
  const { simpleMode, segmentMouseModifierKey } = useUserSettings();
  const [dragging, setDragging] = useState(false);

  return (
    <motion.div
      className="no-user-select"
      style={dropzoneStyle}
      animate={{ borderColor: dragging ? 'var(--llc-accent-border)' : 'var(--llc-control-border)' }}
      onDragOver={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      role="button"
      onClick={onClick}
    >
      <div style={{ width: '3.6em', height: '3.6em', borderRadius: '1.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--llc-accent-gradient)', boxShadow: 'var(--llc-accent-glow)', color: '#fff', marginBottom: '.4em' }}>
        <LuFilm size={26} />
      </div>

      <div style={{ fontSize: '1.4em', fontWeight: 600, letterSpacing: '.02em' }}>{t('DROP FILE(S)')}</div>

      <div style={hintStyle}>
        <Trans>See <b>Help</b> menu for help</Trans>
      </div>

      <div style={{ ...hintStyle, marginTop: '1em' }}>
        <Trans><CutpointIcon side="start" /> <CutpointIcon side="end" />, <Keys keys={keyBindingByAction['setCutStart']?.keys} /> <Keys keys={keyBindingByAction['setCutEnd']?.keys} /> or <span><kbd style={{ marginRight: '.1em' }}>{getModifier(segmentMouseModifierKey)}</kbd></span>+<FaMouse style={{ marginRight: '.1em', verticalAlign: 'middle' }} /> to set cutpoints</Trans>
      </div>

      <div style={hintStyle} role="button" onClick={(e) => e.stopPropagation()}>
        {simpleMode ? (
          <Trans><SimpleModeButton style={{ verticalAlign: 'middle' }} /> to show advanced view</Trans>
        ) : (
          <Trans><SimpleModeButton style={{ verticalAlign: 'middle' }} /> to show simple view</Trans>
        )}
      </div>

      {mifiLink && typeof mifiLink === 'object' && 'loadUrl' in mifiLink && typeof mifiLink.loadUrl === 'string' && mifiLink.loadUrl ? (
        <div style={{ position: 'relative', margin: '.3em', width: '24em', height: '8em' }}>
          <iframe src={`${mifiLink.loadUrl}#dark=${darkMode ? 'true' : 'false'}`} title="iframe" style={{ background: 'rgba(0,0,0,0)', border: 'none', pointerEvents: 'none', width: '100%', height: '100%', position: 'absolute', colorScheme: 'initial' }} />
          {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
          <div style={{ width: '100%', height: '100%', position: 'absolute', cursor: 'pointer' }} title={t('Open link in browser')} role="button" onClick={(e) => { e.stopPropagation(); if ('targetUrl' in mifiLink && typeof mifiLink.targetUrl === 'string') mainApi.openExternal(mifiLink.targetUrl); }} />
        </div>
      ) : undefined}
    </motion.div>
  );
}

export default memo(NoFileLoaded);
