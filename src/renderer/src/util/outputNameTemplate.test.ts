import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

vi.mock('../worker/eval', () => ({
  default: async (expression: string, context: Record<string, unknown>) => {
    // eslint-disable-next-line no-template-curly-in-string
    if (expression !== '`${SEG_LABEL.replaceAll(\'_\', \':\')}${EXT}`') throw new Error(`Unexpected expression: ${expression}`);
    return `${String(context.SEG_LABEL).replaceAll('_', ':')}${String(context.EXT)}`;
  },
}));

type WindowWithRequire = Window & {
  require: (specifier: string) => unknown;
  process: {
    mas?: boolean;
    windowsStore?: boolean;
  };
};

const originalWindow = globalThis.window;

function createWindowMock(): WindowWithRequire {
  const remote = {
    app: {
      getVersion: () => '0.0.0-test',
      getAppPath: () => '/app',
    },
    require: (specifier: string) => {
      if (specifier === './index.js') return { isWindows: true, isMac: false };
      throw new Error(`Unexpected remote require: ${specifier}`);
    },
  };

  return {
    process: { mas: false, windowsStore: false },
    require: (specifier: string) => {
      if (specifier === 'node:path') return require('node:path');
      if (specifier === 'node:fs/promises') return require('node:fs/promises');
      if (specifier === '@electron/remote') return remote;
      if (specifier === 'electron') return { ipcRenderer: { invoke: vi.fn() } };
      throw new Error(`Unexpected window.require: ${specifier}`);
    },
  } as WindowWithRequire;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('window', createWindowMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalWindow == null) delete (globalThis as { window?: Window }).window;
  else globalThis.window = originalWindow;
});

describe('generateCutFileNames', () => {
  it('sanitizes the final output basename when template logic reintroduces invalid Windows characters', async () => {
    const { generateCutFileNames } = await import('./outputNameTemplate');

    const { fileNames, problems } = await generateCutFileNames({
      fileDuration: 120,
      segmentsToExport: [{
        start: 10,
        end: 20,
        name: '00:10:05.605 2',
        originalIndex: 0,
      }],
      // eslint-disable-next-line no-template-curly-in-string
      template: '${SEG_LABEL.replaceAll(\'_\', \':\')}${EXT}',
      formatTimecode: ({ seconds }) => seconds.toFixed(3),
      isCustomFormatSelected: true,
      fileFormat: 'matroska',
      sourceFile: { path: String.raw`C:\input\clip.mkv` },
      outputDir: String.raw`C:\output`,
      safeOutputFileName: true,
      maxLabelLength: 100,
      outputFileNameMinZeroPadding: 1,
      exportCount: 0,
      currentFileExportCount: 0,
    });

    expect(problems.error).toBeUndefined();
    expect(fileNames).toEqual(['00_10_05.605 2.mkv']);
  });
});
