import React, { useContext } from 'react';

export const UserSettingsContext = React.createContext();
export const SegColorsContext = React.createContext();

export const useSegColors = () => useContext(SegColorsContext);
