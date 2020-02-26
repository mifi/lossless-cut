import React, { memo } from 'react';
import { Select } from 'evergreen-ui';
import { motion } from 'framer-motion';
import { FaYinYang } from 'react-icons/fa';

const { withBlur } = require('./util');


const LeftMenu = memo(({ zoom, setZoom, invertCutSegments, setInvertCutSegments }) => (
  <div className="no-user-select" style={{ position: 'absolute', left: 0, bottom: 0, padding: '.3em', display: 'flex', alignItems: 'center' }}>
    <div style={{ marginLeft: 5 }}>
      <motion.div
        animate={{ rotateX: invertCutSegments ? 0 : 180, width: 26, height: 26 }}
        transition={{ duration: 0.3 }}
      >
        <FaYinYang
          size={26}
          role="button"
          title={invertCutSegments ? 'Discard selected segments' : 'Keep selected segments'}
          onClick={withBlur(() => setInvertCutSegments(v => !v))}
        />
      </motion.div>
    </div>

    <div style={{ marginRight: 5, marginLeft: 10 }} title="Zoom">{Math.floor(zoom)}x</div>
    <Select height={20} style={{ width: 20 }} value={zoom.toString()} title="Zoom" onChange={withBlur(e => setZoom(parseInt(e.target.value, 10)))}>
      {Array(13).fill().map((unused, z) => {
        const val = 2 ** z;
        return (
          <option key={val} value={String(val)}>Zoom {val}x</option>
        );
      })}
    </Select>
  </div>
));

export default LeftMenu;
