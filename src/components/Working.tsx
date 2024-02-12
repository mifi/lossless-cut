import { memo } from 'react';
import { motion } from 'framer-motion';
import Lottie from 'react-lottie-player/dist/LottiePlayerLight';
import { Button } from 'evergreen-ui';
import { Trans } from 'react-i18next';

import { primaryColor } from '../colors';
import loadingLottie from '../7077-magic-flow.json';


const Working = memo(({ text, cutProgress, onAbortClick }: {
  text: string, cutProgress?: number, onAbortClick: () => void
}) => (
  <div style={{ position: 'absolute', bottom: 0, top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
    <motion.div
      style={{ background: primaryColor, boxShadow: `${primaryColor} 0px 0px 20px 25px`, borderRadius: 60, paddingBottom: 5, color: 'white', fontSize: 14, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
    >
      <div style={{ width: 150, height: 80 }}>
        <Lottie
          loop
          animationData={loadingLottie}
          play
          style={{ width: '170%', height: '210%', marginLeft: '-40%', marginTop: '-35%', pointerEvents: 'none' }}
        />
      </div>

      <div style={{ marginTop: 5 }}>
        {text}...
      </div>

      {(cutProgress != null) && (
        <div style={{ marginTop: 5 }}>
          {`${(cutProgress * 100).toFixed(1)} %`}
        </div>
      )}

      <div style={{ marginTop: 5 }}>
        <Button intent="danger" onClick={onAbortClick} height={20}><Trans>Abort</Trans></Button>
      </div>
    </motion.div>
  </div>
));

export default Working;
