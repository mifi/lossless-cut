import { use } from 'react';
import invariant from 'tiny-invariant';

import { UserSettingsContext } from '../contexts';


export default () => {
  const context = use(UserSettingsContext);
  invariant(context != null);
  return context;
};
