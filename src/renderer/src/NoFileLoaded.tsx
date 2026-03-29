import { Fragment, memo, useMemo, useState } from 'react';
import type { MotionStyle } from 'motion/react';
import { motion } from 'motion/react';
import { FaMouse } from 'react-icons/fa';
import { useTranslation, Trans } from 'react-i18next';

import SetCutpointButton from './components/SetCutpointButton';
import SimpleModeButton from './components/SimpleModeButton';
import useUserSettings from './hooks/useUserSettings';
import type { StateSegment } from './types';
import type { KeyBinding } from '../../common/types';
import { splitKeyboardKeys } from './util';
import { getModifier } from './hooks/useTimelineScroll';
import Kbd from './components/Kbd';
import styles from './NoFileLoaded.module.css';

const electron = window.require('electron');

function Keys({ keys }: { keys: string | undefined }) {
  if (keys == null || keys === '') {
    return <kbd>UNBOUND</kbd>;
  }
  const split = splitKeyboardKeys(keys);
  return split.map((key, i) => (
    <Fragment key={key}><Kbd code={key} />{i < split.length - 1 && <span style={{ fontSize: '.7em', marginLeft: '-.2em', marginRight: '-.2em' }}>{' + '}</span>}</Fragment>
  ));
}

const dropzoneStyle: MotionStyle = {
  borderColor: 'rgba(255, 255, 255, 0.12)',
};

function NoFileLoaded({ mifiLink, currentCutSeg, onClick, darkMode, keyBindingByAction }: {
  mifiLink: unknown,
  currentCutSeg: StateSegment | undefined,
  onClick: () => void,
  darkMode?: boolean,
  keyBindingByAction: Record<string, KeyBinding>,
}) {
  const { t } = useTranslation();
  const { simpleMode, segmentMouseModifierKey } = useUserSettings();
  const [dragging, setDragging] = useState(false);

  const currentCutSegOrDefault = useMemo(() => currentCutSeg ?? { segColorIndex: 0 }, [currentCutSeg]);

  return (
    <motion.div
      className={['no-user-select', styles['dropzone']].join(' ')}
      style={dropzoneStyle}
      animate={{ borderColor: dragging ? 'var(--player-accent-border)' : 'rgba(255, 255, 255, 0.12)' }}
      onDragOver={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      role="button"
      onClick={onClick}
    >
      <div className={styles['inner']}>
        <div className={styles['title']}>{t('DROP FILE(S)')}</div>

        <div className={styles['subtitle']}>
          <Trans>See <b>Help</b> menu for help</Trans>
        </div>

        <div className={styles['hintCard']}>
          <div className={styles['hintLabel']}>{t('Quick start')}</div>
          <div className={styles['hintRow']}>
            <Trans><SetCutpointButton currentCutSeg={currentCutSegOrDefault} side="start" style={{ verticalAlign: 'middle' }} /> <SetCutpointButton currentCutSeg={currentCutSegOrDefault} side="end" style={{ verticalAlign: 'middle' }} />, <Keys keys={keyBindingByAction['setCutStart']?.keys} /> <Keys keys={keyBindingByAction['setCutEnd']?.keys} /> or <span><kbd style={{ marginRight: '.1em' }}>{getModifier(segmentMouseModifierKey)}</kbd></span>+<FaMouse style={{ marginRight: '.1em', verticalAlign: 'middle' }} /> to set cutpoints</Trans>
          </div>

          <div className={styles['simpleMode']} role="button" onClick={(e) => e.stopPropagation()}>
            {simpleMode ? (
              <Trans><SimpleModeButton style={{ verticalAlign: 'middle' }} /> to show advanced view</Trans>
            ) : (
              <Trans><SimpleModeButton style={{ verticalAlign: 'middle' }} /> to show simple view</Trans>
            )}
          </div>
        </div>

        {mifiLink && typeof mifiLink === 'object' && 'loadUrl' in mifiLink && typeof mifiLink.loadUrl === 'string' && mifiLink.loadUrl ? (
          <div className={styles['promo']}>
            <iframe src={`${mifiLink.loadUrl}#dark=${darkMode ? 'true' : 'false'}`} title="iframe" className={styles['promoFrame']} />
            {/* Keep the promo clickable without letting the embedded content steal pointer events. */}
            <div className={styles['promoClickTarget']} role="button" onClick={(e) => { e.stopPropagation(); if ('targetUrl' in mifiLink && typeof mifiLink.targetUrl === 'string') electron.shell.openExternal(mifiLink.targetUrl); }} />
          </div>
        ) : undefined}
      </div>
    </motion.div>
  );
}

export default memo(NoFileLoaded);
