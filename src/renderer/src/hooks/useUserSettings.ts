import { useContext } from 'react';

import { UserSettingsContext } from '../contexts';


export default () => {
  const context = useContext(UserSettingsContext);
  if (context == null) throw new Error('UserSettingsContext nullish');
  return context;
};
