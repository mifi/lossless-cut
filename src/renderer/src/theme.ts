import { DefaultTheme, IntentTypes, defaultTheme } from 'evergreen-ui';
import { ProviderProps } from 'react';


function colorKeyForIntent(intent: IntentTypes) {
  if (intent === 'danger') return 'var(--red-12)';
  if (intent === 'success') return 'var(--green-12)';
  return 'var(--gray-12)';
}

function borderColorForIntent(intent: IntentTypes, isHover?: boolean) {
  if (intent === 'danger') return isHover ? 'var(--red-8)' : 'var(--red-7)';
  if (intent === 'success') return isHover ? 'var(--green-8)' : 'var(--green-7)';
  return 'var(--gray-8)';
}

const customTheme: ProviderProps<DefaultTheme>['value'] = {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    icon: {
      default: 'var(--gray-12)',
      muted: 'var(--gray-11)',
      disabled: 'var(--gray-8)',
      selected: 'var(--gray-12)',
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
          backgroundColor: 'var(--gray-3)',

          // https://github.com/segmentio/evergreen/blob/master/src/themes/default/components/button.js
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          border: ((_theme: unknown, props: { intent: IntentTypes }) => `1px solid ${borderColorForIntent(props.intent)}`) as any as string, // todo types
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          color: ((_theme: unknown, props: { color: string, intent: IntentTypes }) => props.color || colorKeyForIntent(props.intent)) as any as string, // todo types

          selectors: {
            _hover: {
              backgroundColor: 'var(--gray-4)',
            },
            _active: {
              backgroundColor: 'var(--gray-5)',
            },
            _focus: {
              backgroundColor: 'var(--gray-5)',
              boxShadow: '0 0 0 1px var(--gray-8)',
            },
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

          selectors: {
            _hover: {
              backgroundColor: 'var(--gray-4)',
            },
            _active: {
              backgroundColor: 'var(--gray-5)',
            },
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
