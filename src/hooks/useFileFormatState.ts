import { useState } from 'react';

export default () => {
  const [detectedFileFormat, setDetectedFileFormat] = useState<string>();
  const [fileFormat, setFileFormat] = useState<string>();

  const isCustomFormatSelected = fileFormat !== detectedFileFormat;

  return { fileFormat, setFileFormat, detectedFileFormat, setDetectedFileFormat, isCustomFormatSelected };
};
