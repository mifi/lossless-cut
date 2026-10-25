import { LuZap } from 'react-icons/lu';
import type { KeyboardAction } from '../../../common/types';


export default function Action({ name }: { name: KeyboardAction }) {
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <LuZap style={{ verticalAlign: 'middle', marginRight: '.2em' }} />
      <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '.2em', cursor: 'alias' }}>{name}</span>
    </span>
  );
}
