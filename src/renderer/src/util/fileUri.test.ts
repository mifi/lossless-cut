import { test, expect, describe } from 'vitest';

import fileUriRaw from './fileUri.js';


describe('file uri windows only', () => {
  test('converts path to file url', () => {
    expect(fileUriRaw('C:\\Users\\sindresorhus\\dev\\te^st.jpg', true)).toEqual('file:///C:/Users/sindresorhus/dev/te%5Est.jpg');
  });
});

describe('file uri non-windows', () => {
  // https://github.com/mifi/lossless-cut/issues/1941
  test('file with backslash', () => {
    expect(fileUriRaw('/has/back\\slash', false)).toEqual('file:///has/back%5Cslash');
  });
});

// taken from https://github.com/sindresorhus/file-url
describe.each([{ isWindows: false }, { isWindows: true }])('file uri both platforms isWindows=$isWindows', ({ isWindows }) => {
  const fileUri = (path) => fileUriRaw(path, isWindows);

  test('converts path to file url', () => {
    expect(fileUri('/test.jpg')).toMatch(/file:\/{3}test\.jpg/);

    expect(fileUri('/Users/sindresorhus/dev/te^st.jpg')).toEqual('file:///Users/sindresorhus/dev/te%5Est.jpg');
  });

  test('escapes more special characters in path', () => {
    expect(fileUri('/a?!@#$%^&\'";<>')).toEqual('file:///a%3F!@%23$%25%5E&\'%22;%3C%3E');
  });

  test('escapes whitespace characters in path', () => {
    expect(fileUri('/file with\r\nnewline')).toEqual('file:///file%20with%0D%0Anewline');
  });

  test('relative path', () => {
    expect(fileUri('relative/test.jpg')).toEqual('file:///relative/test.jpg');
  });

  test('empty', () => {
    expect(fileUri('')).toEqual('file:///');
  });

  test('slash', () => {
    expect(fileUri('/')).toEqual('file:///');
  });
});
