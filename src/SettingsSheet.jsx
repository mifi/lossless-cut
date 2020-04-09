import React, { memo } from 'react';
import { IoIosCloseCircleOutline } from 'react-icons/io';
import { motion, AnimatePresence } from 'framer-motion';
import { Table } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

const SettingsSheet = memo(({
  visible, onTogglePress, renderSettings,
}) => {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="settings-sheet"
        >
          <IoIosCloseCircleOutline role="button" onClick={onTogglePress} size={30} style={{ position: 'fixed', right: 0, top: 0, padding: 20 }} />

          <Table style={{ marginTop: 40 }}>
            <Table.Head>
              <Table.TextHeaderCell>
                {t('Settings')}
              </Table.TextHeaderCell>
              <Table.TextHeaderCell>
                {t('Current setting')}
              </Table.TextHeaderCell>
            </Table.Head>
            <Table.Body>
              {renderSettings()}
            </Table.Body>
          </Table>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default SettingsSheet;
