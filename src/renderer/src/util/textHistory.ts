// Undo/redo history for a single text value, e.g. the export file name template.
// Kept as a pure reducer so it can be unit tested without rendering a component.

export interface TextHistory {
  readonly stack: readonly string[],
  readonly index: number,
}

export type TextHistoryAction =
  | { type: 'set', value: string }
  | { type: 'undo' }
  | { type: 'redo' };

// don't grow unbounded if the user keeps editing for a long time
export const maxTextHistoryLength = 100;

export const createTextHistory = (value: string): TextHistory => ({ stack: [value], index: 0 });

export const getTextHistoryValue = (history: TextHistory) => history.stack[history.index]!;

export const canUndo = (history: TextHistory) => history.index > 0;

export const canRedo = (history: TextHistory) => history.index < history.stack.length - 1;

export function textHistoryReducer(history: TextHistory, action: TextHistoryAction): TextHistory {
  switch (action.type) {
    case 'set': {
      // ignore no-op changes, e.g. when the debounced value catches up after an undo
      if (action.value === getTextHistoryValue(history)) return history;
      // a new edit discards anything that could have been redone
      const stack = [...history.stack.slice(0, history.index + 1), action.value];
      const overflow = Math.max(0, stack.length - maxTextHistoryLength);
      return { stack: stack.slice(overflow), index: stack.length - overflow - 1 };
    }
    case 'undo': {
      return canUndo(history) ? { ...history, index: history.index - 1 } : history;
    }
    case 'redo': {
      return canRedo(history) ? { ...history, index: history.index + 1 } : history;
    }
    default: {
      return history;
    }
  }
}
