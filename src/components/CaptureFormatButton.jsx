import React, { memo } from 'react';
import { Button } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';
import { FaImage } from 'react-icons/fa';

import useUserSettings from '../hooks/useUserSettings';
import { withBlur } from '../util';

const CaptureFormatButton = memo(({ showIcon = false, ...props }) => {
  const { t } = useTranslation();
  const { captureFormat, toggleCaptureFormat } = useUserSettings();
  return (
    <Button
      iconBefore={showIcon ? <FaImage /> : undefined}
      title={t('Capture frame format')}
      onClick={withBlur(toggleCaptureFormat)}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    >
      {captureFormat}
    </Button>
  );
});

export default CaptureFormatButton;
