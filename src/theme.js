import { defaultTheme } from 'evergreen-ui';


function colorKeyForIntent(intent) {
  if (intent === 'danger') return 'var(--red12)';
  if (intent === 'success') return 'var(--green12)';
  return 'var(--gray12)';
}

function borderColorForIntent(intent, isHover) {
  if (intent === 'danger') return isHover ? 'var(--red8)' : 'var(--red7)';
  if (intent === 'success') return isHover ? 'var(--green8)' : 'var(--green7)';
  return 'var(--gray7)';
}

export default {
  ...defaultTheme,
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
      },
    },
  },
};
