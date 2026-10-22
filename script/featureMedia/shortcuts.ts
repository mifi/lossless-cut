// The keys of the app's default keyboard shortcuts, for showing them as keys in the social media versions (on a macOS style window, so with macOS symbols)
import defaultKeyBindings from '../../src/common/defaultKeyBindings.ts';

// In the order macOS shows them
const modifiers: Record<string, string> = { Control: '⌃', Alt: '⌥', Shift: '⇧', Meta: '⌘' };
const keyNames: Record<string, string> = { Space: 'Space', Enter: 'Return', Backspace: '⌫', Escape: 'esc', Tab: '⇥', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', Comma: ',', Period: '.', Slash: '/', Equal: '=', Minus: '-' };

// From a key code (KeyboardEvent.code, as the bindings have them), e.g. KeyE, Digit1, ShiftLeft
function keyName(code: string) {
  const modifier = Object.keys(modifiers).find((name) => code === `${name}Left` || code === `${name}Right`);
  if (modifier != null) return modifiers[modifier]!;
  return keyNames[code] ?? code.replace(/^(Key|Digit)/, '');
}

/** The keys of an action's default shortcut, e.g. ['⌘', 'Z'], or undefined if it has none. Of the ones with Ctrl or Cmd, the Cmd one, like on macOS */
export default function getShortcutKeys(action: string): string[] | undefined {
  const bindings = defaultKeyBindings.filter((binding) => binding.action === action).map(({ keys }) => keys.split('+'));
  const binding = bindings.find((keys) => keys.some((key) => key.startsWith('Meta'))) ?? bindings[0];
  if (binding == null) return undefined;
  // The modifiers first
  const order = Object.values(modifiers);
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
  return binding.map((code) => keyName(code)).sort((a, b) => rank(a) - rank(b));
}
