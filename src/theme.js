import { defaultTheme } from 'evergreen-ui';

export default {
  ...defaultTheme,
  components: {
    ...defaultTheme.components,
    Select: {
      ...defaultTheme.components.Select,
      appearances: {
        ...defaultTheme.components.Select.appearances,
        default: {
          ...defaultTheme.components.Select.appearances.default,
          backgroundColor: '#fff', // If not, selects will be invisible on dark background
        },
      },
    },
  },
};
