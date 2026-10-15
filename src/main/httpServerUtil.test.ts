// eslint-disable-next-line import/no-extraneous-dependencies
import { test, expect, describe } from 'vitest';

import { isRequestAllowed } from './httpServerUtil.js';


describe('http api request validation', () => {
  test('allows a local non-browser client', () => {
    expect(isRequestAllowed({ host: '127.0.0.1:8080', origin: undefined, port: 8080 })).toBe(true);
    expect(isRequestAllowed({ host: 'localhost:8080', origin: undefined, port: 8080 })).toBe(true);
    expect(isRequestAllowed({ host: '[::1]:8080', origin: undefined, port: 8080 })).toBe(true);
    expect(isRequestAllowed({ host: 'LocalHost:8080', origin: undefined, port: 8080 })).toBe(true);
  });

  test('allows a custom port', () => {
    expect(isRequestAllowed({ host: '127.0.0.1:1234', origin: undefined, port: 1234 })).toBe(true);
    expect(isRequestAllowed({ host: '127.0.0.1:8080', origin: undefined, port: 1234 })).toBe(false);
  });

  test('allows an omitted port only when listening on port 80', () => {
    expect(isRequestAllowed({ host: '127.0.0.1', origin: undefined, port: 80 })).toBe(true);
    expect(isRequestAllowed({ host: '127.0.0.1', origin: undefined, port: 8080 })).toBe(false);
  });

  // an attacker controlled domain that has been rebound to 127.0.0.1
  test('rejects a rebound host', () => {
    expect(isRequestAllowed({ host: 'attacker.example.com:8080', origin: undefined, port: 8080 })).toBe(false);
    expect(isRequestAllowed({ host: '127.0.0.1.attacker.example.com:8080', origin: undefined, port: 8080 })).toBe(false);
    expect(isRequestAllowed({ host: undefined, origin: undefined, port: 8080 })).toBe(false);
  });

  // a web page trying to make the user's browser call the api on their behalf
  test('rejects a request from a browser', () => {
    expect(isRequestAllowed({ host: '127.0.0.1:8080', origin: 'https://attacker.example.com', port: 8080 })).toBe(false);
    expect(isRequestAllowed({ host: '127.0.0.1:8080', origin: 'null', port: 8080 })).toBe(false);
    expect(isRequestAllowed({ host: '127.0.0.1:8080', origin: 'http://127.0.0.1:8080', port: 8080 })).toBe(false);
  });
});
