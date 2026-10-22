import { memo, useState } from 'react';
import { motion } from 'motion/react';
import Lottie from 'react-lottie-player/dist/LottiePlayerLight';
import { Trans, useTranslation } from 'react-i18next';
import useInterval from 'react-use/lib/useInterval';

import loadingLottie from '../7077-magic-flow.json';
import Button from './Button';
import styles from './Working.module.css';


function Working({ text, progress, onAbortClick }: {
  text: string,
  progress?: number | undefined,
  onAbortClick: () => void
}) {
  const { t } = useTranslation();

  const [startedAt] = useState(() => new Date());
  const [elapsedMs, setElapsedMs] = useState(0);

  // Reassure the user that the app is not frozen
  // This is because some ffmpeg operations can take a long time without giving any progress updates, which might make the user think that the app is frozen
  // https://github.com/mifi/lossless-cut/issues/2746

  useInterval(() => {
    setElapsedMs(Date.now() - startedAt.getTime());
  }, 100);

  return (
    <div className={styles['wrapper']} style={{ position: 'absolute', bottom: 0, top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <motion.div
        className={styles['loader-box']}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0 }}
      >
        <div style={{ width: '10em', height: '5em', marginBottom: '.5em' }}>
          <Lottie
            loop
            animationData={loadingLottie}
            play
            style={{ width: '170%', height: '210%', marginLeft: '-40%', marginTop: '-35%', pointerEvents: 'none' }}
          />
        </div>

        <div style={{ marginBottom: '.2em', textAlign: 'center', fontWeight: 600 }}>
          {text}...
        </div>

        <div style={{ marginBottom: '.5em', fontSize: '.85em', color: 'var(--llc-text-2)', textAlign: 'center' }}>
          {t('Elapsed: {{seconds}} seconds', { seconds: (elapsedMs / 1000).toFixed(1) })}
        </div>

        {(progress != null) && (
          <div className="llc-mono" style={{ marginBottom: '.6em', fontSize: '1.3em', color: 'var(--llc-accent-text)' }}>
            {`${(progress * 100).toFixed(1)} %`}
          </div>
        )}

        <div>
          <Button onClick={onAbortClick} style={{ fontSize: '1em', padding: '.45em 1.4em', borderRadius: 'var(--llc-radius-pill)' }}><Trans>Abort</Trans></Button>
        </div>
      </motion.div>
    </div>
  );
}

export default memo(Working);
