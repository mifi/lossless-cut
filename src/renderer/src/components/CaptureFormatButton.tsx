import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaImage } from 'react-icons/fa';

import useUserSettings from '../hooks/useUserSettings';
import { withBlur } from '../util';
import Button from './Button';


function CaptureFormatButton({ showIcon = false, ...props }: { showIcon?: boolean } & Parameters<typeof Button>[0]) {
  const { t } = useTranslation();
  const { captureFormat, toggleCaptureFormat } = useUserSettings();
  return (
    <Button
      title={t('Capture frame format')}
      onClick={withBlur(toggleCaptureFormat)}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    >
      {showIcon && <FaImage style={{ verticalAlign: 'middle', fontSize: '1.3em', marginRight: '.7em' }} />}
      {captureFormat.toUpperCase()}
    </Button>
  );
}

export default memo(CaptureFormatButton);
