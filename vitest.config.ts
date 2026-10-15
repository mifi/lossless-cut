import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `tsc --build` compiles src/common (tests included) into common-ts-dist. Don't discover those
    // compiled copies, or every test in src/common would also run a second time from the build output.
    exclude: [...configDefaults.exclude, 'common-ts-dist/**'],
  },
});
