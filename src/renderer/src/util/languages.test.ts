import { describe, expect, test } from 'vitest';

import { getLanguageSuggestions, isValidLanguageCode } from './languages';


describe('getLanguageSuggestions', () => {
  test('localized labels with codes', () => {
    const suggestions = getLanguageSuggestions('en');
    expect(suggestions).toContainEqual({ value: 'ger', label: 'German (ger)' });
    expect(getLanguageSuggestions('de')).toContainEqual({ value: 'ger', label: 'Deutsch (ger)' });
    expect(suggestions.every(({ value }) => isValidLanguageCode(value))).toBe(true);
  });

  test('invalid ui language falls back to codes', () => {
    expect(getLanguageSuggestions('!!')).toContainEqual({ value: 'eng', label: 'eng (eng)' });
  });
});
