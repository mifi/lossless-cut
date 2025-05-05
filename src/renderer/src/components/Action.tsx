import { TakeActionIcon } from 'evergreen-ui';

import { KeyboardAction } from '../../../../types';


export default function Action({ name }: { name: KeyboardAction }) {
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <TakeActionIcon verticalAlign="middle" style={{ marginRight: '.2em' }} />
      <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '.2em', cursor: 'alias' }}>{name}</span>
    </span>
  );
}
