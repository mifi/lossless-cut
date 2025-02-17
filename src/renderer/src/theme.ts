import { DefaultTheme, IntentTypes, defaultTheme } from 'evergreen-ui';
import { ProviderProps } from 'react';


function colorKeyForIntent(intent: IntentTypes) {
  if (intent === 'danger') return 'var(--red12)';
  if (intent === 'success') return 'var(--green12)';
  return 'var(--gray12)';
}

function borderColorForIntent(intent: IntentTypes, isHover?: boolean) {
  if (intent === 'danger') return isHover ? 'var(--red8)' : 'var(--red7)';
  if (intent === 'success') return isHover ? 'var(--green8)' : 'var(--green7)';
  return 'var(--gray8)';
}

const customTheme: ProviderProps<DefaultTheme>['value'] = {
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          border: ((_theme: unknown, props: { intent: IntentTypes }) => `1px solid ${borderColorForIntent(props.intent)}`) as any as string, // todo types
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          color: ((_theme: unknown, props: { color: string, intent: IntentTypes }) => props.color || colorKeyForIntent(props.intent)) as any as string, // todo types

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any as boolean, // todo types
        },
        minimal: {
          ...defaultTheme.components.Button.appearances.minimal,

          // https://github.com/segmentio/evergreen/blob/master/src/themes/default/components/button.js
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          color: ((_theme: unknown, props: { color: string, intent: IntentTypes }) => props.color || colorKeyForIntent(props.intent)) as any as string, // todo types

          _hover: {
            backgroundColor: 'var(--gray4)',
          },
          _active: {
            backgroundColor: 'var(--gray5)',
          },
          disabled: {
            opacity: 0.5,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any as boolean, // todo types,
        },
      },
    },
  },
};

export default customTheme;
