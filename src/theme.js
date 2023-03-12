import { defaultTheme } from 'evergreen-ui';


function colorKeyForIntent(intent) {
  if (intent === 'danger') return 'var(--red12)';
  if (intent === 'success') return 'var(--green12)';
  return 'var(--gray12)';
}

function borderColorForIntent(intent, isHover) {
  if (intent === 'danger') return isHover ? 'var(--red8)' : 'var(--red7)';
  if (intent === 'success') return isHover ? 'var(--green8)' : 'var(--green7)';
  return 'var(--gray8)';
}

export default {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    icon: {
      default: 'var(--gray12)',
      muted: 'var(--gray11)',
      disabled: 'var(--gray8)',
      selected: 'var(--gray12)',
    },
  },
  components: {
    ...defaultTheme.components,
    Button: {
      ...defaultTheme.components.Button,
      appearances: {
        ...defaultTheme.components.Button.appearances,
        default: {
          ...defaultTheme.components.Button.appearances.default,
          backgroundColor: 'var(--gray3)',

          // https://github.com/segmentio/evergreen/blob/master/src/themes/default/components/button.js
          border: (theme, props) => `1px solid ${borderColorForIntent(props.intent)}`,
          color: (theme, props) => props.color || colorKeyForIntent(props.intent),

          _hover: {
            backgroundColor: 'var(--gray4)',
          },
          _active: {
            backgroundColor: 'var(--gray5)',
          },
          _focus: {
            backgroundColor: 'var(--gray5)',
            boxShadow: '0 0 0 1px var(--gray8)',
          },
          disabled: {
            opacity: 0.5,
          },
        },
        minimal: {
          ...defaultTheme.components.Button.appearances.minimal,

          // https://github.com/segmentio/evergreen/blob/master/src/themes/default/components/button.js
          color: (theme, props) => props.color || colorKeyForIntent(props.intent),

          _hover: {
            backgroundColor: 'var(--gray4)',
          },
          _active: {
            backgroundColor: 'var(--gray5)',
          },
          disabled: {
            opacity: 0.5,
          },
        },
      },
    },
  },
};
