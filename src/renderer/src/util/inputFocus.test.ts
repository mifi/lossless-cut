import { expect, it, vi } from 'vitest';

import handleCutTimeInputKeyDown from './inputFocus';


function createKeyEvent({ code, shiftKey = false }: { code: string, shiftKey?: boolean }) {
  return {
    code,
    shiftKey,
    preventDefault: vi.fn(),
    currentTarget: { blur: vi.fn() },
  };
}

it('should release focus when tabbing forward from the end time input', () => {
  const event = createKeyEvent({ code: 'Tab' });

  handleCutTimeInputKeyDown(event, false);

  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(event.currentTarget.blur).toHaveBeenCalledOnce();
});

it.each([
  { name: 'the start time input', code: 'Tab', shiftKey: false, isStart: true },
  { name: 'backwards tabbing', code: 'Tab', shiftKey: true, isStart: false },
  { name: 'enter', code: 'Enter', shiftKey: false, isStart: false },
  { name: 'escape', code: 'Escape', shiftKey: false, isStart: false },
  { name: 'text editing', code: 'Digit1', shiftKey: false, isStart: false },
])('should preserve focus for $name', ({ code, shiftKey, isStart }) => {
  const event = createKeyEvent({ code, shiftKey });

  handleCutTimeInputKeyDown(event, isStart);

  expect(event.preventDefault).not.toHaveBeenCalled();
  expect(event.currentTarget.blur).not.toHaveBeenCalled();
});
