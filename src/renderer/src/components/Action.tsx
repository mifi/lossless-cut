import { FaBolt } from 'react-icons/fa';
import { KeyboardAction } from '../../../common/types';


export default function Action({ name }: { name: KeyboardAction }) {
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <FaBolt style={{ verticalAlign: 'middle', marginRight: '.2em' }} />
      <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '.2em', cursor: 'alias' }}>{name}</span>
    </span>
  );
}
