import SyntaxHighlighter from 'react-syntax-highlighter';
import { tomorrow as lightSyntaxStyle, tomorrowNight as darkSyntaxStyle } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import JSON5 from 'json5';

import * as Dialog from './Dialog';
import useUserSettings from '../hooks/useUserSettings';


export default function Json5Dialog({ title, json, children }: {
  title: string;
  json: unknown;
  children: React.ReactNode;
}) {
  const { darkMode } = useUserSettings();

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        {children}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content aria-describedby={undefined}>
          <Dialog.Title>
            {title}
          </Dialog.Title>

          <SyntaxHighlighter language="javascript" style={darkMode ? darkSyntaxStyle : lightSyntaxStyle} customStyle={{ textAlign: 'left', maxHeight: '50vh', overflowY: 'auto', fontSize: 14 }}>
            {JSON5.stringify(json, null, 2)}
          </SyntaxHighlighter>

          <Dialog.CloseButton />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
