import React, { memo } from 'react';
import { Table } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

import Sheet from './Sheet';

const SettingsSheet = memo(({ visible, onTogglePress, renderSettings }) => {
  const { t } = useTranslation();

  return (
    <Sheet visible={visible} onClosePress={onTogglePress} style={{ background: 'white', color: 'black' }}>
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
    </Sheet>
  );
});

export default SettingsSheet;
