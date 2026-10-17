import { it, expect } from 'vitest';

import type { TextHistory } from './textHistory';
import { canRedo, canUndo, createTextHistory, getTextHistoryValue, maxTextHistoryLength, textHistoryReducer } from './textHistory';

const set = (history: TextHistory, value: string) => textHistoryReducer(history, { type: 'set', value });
const undo = (history: TextHistory) => textHistoryReducer(history, { type: 'undo' });
const redo = (history: TextHistory) => textHistoryReducer(history, { type: 'redo' });

it('should start with a single entry that cannot be undone or redone', () => {
  const history = createTextHistory('a');
  expect(getTextHistoryValue(history)).toBe('a');
  expect(canUndo(history)).toBe(false);
  expect(canRedo(history)).toBe(false);
});

it('should undo and redo edits', () => {
  let history = set(set(createTextHistory('a'), 'ab'), 'abc');
  expect(getTextHistoryValue(history)).toBe('abc');

  history = undo(history);
  expect(getTextHistoryValue(history)).toBe('ab');
  expect(canUndo(history)).toBe(true);
  expect(canRedo(history)).toBe(true);

  history = undo(history);
  expect(getTextHistoryValue(history)).toBe('a');
  expect(canUndo(history)).toBe(false);

  history = redo(redo(history));
  expect(getTextHistoryValue(history)).toBe('abc');
  expect(canRedo(history)).toBe(false);
});

it('should ignore no-op sets, so a debounced value catching up after an undo does nothing', () => {
  const history = set(createTextHistory('a'), 'ab');
  const undone = undo(history);
  // the debounced value arrives after the undo already restored 'a'
  expect(set(undone, 'a')).toBe(undone);
  expect(getTextHistoryValue(redo(set(undone, 'a')))).toBe('ab');
});

it('should not undo or redo past the ends', () => {
  const history = createTextHistory('a');
  expect(undo(history)).toBe(history);
  expect(redo(history)).toBe(history);
});

it('should discard redo entries when editing after an undo', () => {
  const history = undo(set(set(createTextHistory('a'), 'ab'), 'abc'));
  expect(canRedo(history)).toBe(true);

  const edited = set(history, 'abX');
  expect(canRedo(edited)).toBe(false);
  expect(getTextHistoryValue(edited)).toBe('abX');
  expect(getTextHistoryValue(undo(edited))).toBe('ab');
});

it('should drop the oldest entries once the maximum length is exceeded', () => {
  let history = createTextHistory('0');
  for (let i = 1; i < maxTextHistoryLength + 10; i += 1) history = set(history, String(i));

  expect(history.stack).toHaveLength(maxTextHistoryLength);
  expect(getTextHistoryValue(history)).toBe(String(maxTextHistoryLength + 9));
  expect(history.stack[0]).toBe('10');

  // undoing all the way back lands on the oldest retained entry, not on '0'
  while (canUndo(history)) history = undo(history);
  expect(getTextHistoryValue(history)).toBe('10');
});
