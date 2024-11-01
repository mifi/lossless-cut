import React, { useContext } from 'react';
import Color from 'color';

import useUserSettingsRoot from './hooks/useUserSettingsRoot';
import { ExportMode, SegmentColorIndex } from './types';


export type UserSettingsContextType = ReturnType<typeof useUserSettingsRoot> & {
  toggleCaptureFormat: () => void,
  changeOutDir: () => Promise<void>,
  toggleKeyframeCut: (showMessage?: boolean) => void,
  toggleExportConfirmEnabled: () => void,
  toggleSimpleMode: () => void,
  toggleSafeOutputFileName: () => void,
  effectiveExportMode: ExportMode,
}

interface SegColorsContextType {
  getSegColor: (seg: SegmentColorIndex | undefined) => Color
}

export const UserSettingsContext = React.createContext<UserSettingsContextType | undefined>(undefined);
export const SegColorsContext = React.createContext<SegColorsContextType | undefined>(undefined);

export const useSegColors = () => {
  const context = useContext(SegColorsContext);
  if (context == null) throw new Error('SegColorsContext nullish');
  return context;
};
