// eslint-disable-line unicorn/filename-case
// eslint-disable-next-line import/no-extraneous-dependencies
import { test, expect, describe } from 'vitest';

import { pathToFileURL } from 'node:url';


if (process.platform === 'win32') {
  describe('file uri windows only', () => {
    test('converts path to file url', () => {
      expect(pathToFileURL('C:\\Users\\sindresorhus\\dev\\te^st.jpg').href).toEqual('file:///C:/Users/sindresorhus/dev/te%5Est.jpg');
    });
  });
} else {
  describe('file uri non-windows', () => {
    // https://github.com/mifi/lossless-cut/issues/1941
    test('file with backslash', () => {
      expect(pathToFileURL('/has/back\\slash').href).toEqual('file:///has/back%5Cslash');
    });
  });
}

// taken from https://github.com/sindresorhus/file-url
describe('file uri both platforms', () => {
  test('converts path to file url', () => {
    expect(pathToFileURL('/test.jpg').href).toMatch(/^file:\/{3}.*test\.jpg$/);

    expect(pathToFileURL('/Users/sindresorhus/dev/te^st.jpg').href).toMatch(/^file:\/{2}.*\/Users\/sindresorhus\/dev\/te%5Est\.jpg$/);
  });

  test('escapes more special characters in path', () => {
    expect(pathToFileURL('/a^?!@#$%&\'";<>').href).toMatch(/^file:\/{3}.*a%5E%3F!@%23\$%25&'%22;%3C%3E$/);
  });

  test('escapes whitespace characters in path', () => {
    expect(pathToFileURL('/file with\r\nnewline').href).toMatch(/^file:\/{3}.*file%20with%0D%0Anewline$/);
  });

  test('relative path', () => {
    expect(pathToFileURL('relative/test.jpg').href).toMatch(/^file:\/{3}.*\/relative\/test\.jpg$/);
  });

  test('slash', () => {
    expect(pathToFileURL('/').href).toMatch(/^file:\/{2}.*\/$/);
  });

  test('empty', () => {
    expect(pathToFileURL('').href).toMatch(/^file:\/{3}.*$/);
  });
});
