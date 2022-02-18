import React, { memo } from 'react';
import { motion } from 'framer-motion';
import Lottie from 'react-lottie-player';

import { primaryColor } from '../colors';
import loadingLottie from '../7077-magic-flow.json';


const Loading = memo(({ text, cutProgress }) => (
  <div style={{ position: 'absolute', zIndex: 1, bottom: 0, top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
    <motion.div
      style={{ background: primaryColor, boxShadow: `${primaryColor} 0px 0px 20px 25px`, borderRadius: 20, paddingBottom: 15, color: 'white', textAlign: 'center', fontSize: 14 }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
    >
      <div style={{ width: 150, height: 150 }}>
        <Lottie
          loop
          animationData={loadingLottie}
          play
          style={{ width: '170%', height: '130%', marginLeft: '-35%', marginTop: '-29%', pointerEvents: 'none' }}
        />
      </div>

      <div style={{ marginTop: 10, width: 150 }}>
        {text}...
      </div>

      {(cutProgress != null) && (
        <div style={{ marginTop: 10 }}>
          {`${(cutProgress * 100).toFixed(1)} %`}
        </div>
      )}
    </motion.div>
  </div>
));

export default Loading;
