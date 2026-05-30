import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';


export default defineConfig({
  main: {
    build: {
      // https://electron-vite.org/guide/dev#dependencies-vs-devdependencies
      // For the main process and preload, the best practice is to externalize dependencies and only bundle our own code.
      target: 'node24.15',
      sourcemap: true,
    },
  },
  preload: {
    build: {
      target: 'node24.15',
      sourcemap: true,
      rollupOptions: {
        output: {
          format: 'cjs',
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    build: {
      target: 'chrome148',
      sourcemap: true,
      chunkSizeWarningLimit: 3e6,
    },
    server: {
      port: 3001,
      host: '127.0.0.1',
    },
  },
});
