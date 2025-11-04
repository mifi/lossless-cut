import { useContext } from 'react';
import invariant from 'tiny-invariant';

import { UserSettingsContext } from '../contexts';


export default () => {
  const context = useContext(UserSettingsContext);
  invariant(context != null);
  return context;
};
