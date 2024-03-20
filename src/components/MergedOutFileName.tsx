import { memo } from 'react';

import TextInput from './TextInput';


const MergedOutFileName = memo(({ mergedOutFileName, setMergedOutFileName }: { mergedOutFileName: string | undefined, setMergedOutFileName: (a: string) => void }) => (
  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
    <TextInput value={mergedOutFileName ?? ''} onChange={(e) => setMergedOutFileName(e.target.value)} style={{ textAlign: 'right' }} />
  </div>
));

export default MergedOutFileName;
