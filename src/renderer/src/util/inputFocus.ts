import type { KeyboardEvent } from 'react';


type CutTimeInputKeyEvent = Pick<KeyboardEvent<HTMLInputElement>, 'code' | 'shiftKey' | 'preventDefault'> & {
  currentTarget: Pick<HTMLInputElement, 'blur'>,
};

export default function handleCutTimeInputKeyDown(e: CutTimeInputKeyEvent, isStart: boolean | undefined) {
  if (isStart || e.code !== 'Tab' || e.shiftKey) return;

  e.preventDefault();
  e.currentTarget.blur();
}
