import { memo } from 'react';
import { Button, ButtonProps } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';
import { FaImage } from 'react-icons/fa';

import useUserSettings from '../hooks/useUserSettings';
import { withBlur } from '../util';

const CaptureFormatButton = memo(({ showIcon = false, ...props }: { showIcon?: boolean } & ButtonProps) => {
  const { t } = useTranslation();
  const { captureFormat, toggleCaptureFormat } = useUserSettings();
  return (
    <Button
      iconBefore={showIcon ? <FaImage /> : null}
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
