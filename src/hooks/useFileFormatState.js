import { useState } from 'react';

export default () => {
  const [detectedFileFormat, setDetectedFileFormat] = useState();
  const [fileFormat, setFileFormat] = useState();

  const isCustomFormatSelected = fileFormat !== detectedFileFormat;

  return { fileFormat, setFileFormat, detectedFileFormat, setDetectedFileFormat, isCustomFormatSelected };
};
