import React, { memo } from 'react';
import { IoIosCloseCircleOutline } from 'react-icons/io';
import { motion, AnimatePresence } from 'framer-motion';
import { Table } from 'evergreen-ui';

const SettingsSheet = memo(({
  visible, onTogglePress, renderSettings,
}) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="help-sheet"
      >
        <IoIosCloseCircleOutline role="button" onClick={onTogglePress} size={30} style={{ position: 'fixed', right: 0, top: 0, padding: 20 }} />

        <Table style={{ marginTop: 40 }}>
          <Table.Head>
            <Table.TextHeaderCell>
              Settings
            </Table.TextHeaderCell>
            <Table.TextHeaderCell>
              Current setting
            </Table.TextHeaderCell>
          </Table.Head>
          <Table.Body>
            {renderSettings()}
          </Table.Body>
        </Table>
      </motion.div>
    )}
  </AnimatePresence>
));

export default SettingsSheet;
