import React, { useContext } from 'react';
import Color from 'color';

import useUserSettingsRoot from './hooks/useUserSettingsRoot';
import { SegmentColorIndex } from './types';

type UserSettingsContextType = ReturnType<typeof useUserSettingsRoot> & {
  toggleCaptureFormat: () => void,
  changeOutDir: () => Promise<void>,
  toggleKeyframeCut: (showMessage?: boolean) => void,
  togglePreserveMovData: () => void,
  toggleMovFastStart: () => void,
  toggleExportConfirmEnabled: () => void,
  toggleSegmentsToChapters: () => void,
  togglePreserveMetadataOnMerge: () => void,
  toggleSimpleMode: () => void,
  toggleSafeOutputFileName: () => void,
  effectiveExportMode: string,
}

interface SegColorsContextType {
  getSegColor: (seg: SegmentColorIndex) => Color
}

export const UserSettingsContext = React.createContext<UserSettingsContextType | undefined>(undefined);
export const SegColorsContext = React.createContext<SegColorsContextType | undefined>(undefined);

export const useSegColors = () => {
  const context = useContext(SegColorsContext);
  if (context == null) throw new Error('SegColorsContext nullish');
  return context;
};
