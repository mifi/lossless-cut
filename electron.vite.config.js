import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';


export default defineConfig({
  main: {
    // https://electron-vite.org/guide/dev#dependencies-vs-devdependencies
    // For the main process and preload, the best practice is to externalize dependencies and only bundle our own code.
    // However, until we use ESM for electron main, we need to include ESM-only deps in the bundle: (exclude from externalize)
    plugins: [externalizeDepsPlugin({ exclude: ['p-map', 'execa', 'nanoid'] })],
  },
  preload: {
    // https://electron-vite.org/guide/dev#dependencies-vs-devdependencies
    plugins: [externalizeDepsPlugin({ exclude: [] })],
  },
  renderer: {
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 3e6,
      sourcemap: true,
    },
    server: {
      port: 3001,
      host: '127.0.0.1',
      https: false,
    },
  },
});
