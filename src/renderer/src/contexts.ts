import React, { useContext } from 'react';
import Color from 'color';
import invariant from 'tiny-invariant';

import { UserSettingsRoot } from './hooks/useUserSettingsRoot';
import { ExportMode, KeyboardLayoutMap, SegmentColorIndex } from './types';
import type useLoading from './hooks/useLoading';
import { GenericError } from './components/ErrorDialog';
import { ConfirmDialog, ShowGenericDialog } from './components/GenericDialog';


export type UserSettingsContextType = Omit<UserSettingsRoot, 'settings'> & UserSettingsRoot['settings'] & {
  toggleCaptureFormat: () => void,
  changeOutDir: () => Promise<void>,
  toggleKeyframeCut: (showMessage?: boolean) => void,
  toggleExportConfirmEnabled: () => void,
  toggleSimpleMode: () => void,
  toggleSafeOutputFileName: () => void,
  effectiveExportMode: ExportMode,
}

export interface SegColorsContextType {
  getSegColor: (seg: SegmentColorIndex | undefined) => Color,
  nextSegColorIndex: number,
}

export type HandleError = (error: GenericError) => void;

export interface AppContextType {
  setWorking: ReturnType<typeof useLoading>['setWorking'],
  working: ReturnType<typeof useLoading>['working'],
  handleError: HandleError,
  showGenericDialog: ShowGenericDialog,
  confirmDialog: ConfirmDialog,
  keyboardLayoutMap: KeyboardLayoutMap | undefined,
  updateKeyboardLayout: () => Promise<void>,
}


export const UserSettingsContext = React.createContext<UserSettingsContextType | undefined>(undefined);
export const SegColorsContext = React.createContext<SegColorsContextType | undefined>(undefined);
export const AppContext = React.createContext<AppContextType | undefined>(undefined);

export function useAppContext() {
  const context = useContext(AppContext);
  invariant(context != null);
  return context;
}

export const useSegColors = () => {
  const context = useContext(SegColorsContext);
  invariant(context != null);
  return context;
};
