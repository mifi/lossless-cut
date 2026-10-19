import { describe, expect, test } from 'vitest';

import { getLanguageSuggestions, getNonNativeMovMetadataKeys, isValidCodecTag, isValidLanguageCode, needsHvc1Tag, streamMetadataKeys } from './metadata';


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

test('isValidCodecTag', () => {
  expect(isValidCodecTag('hvc1')).toBe(true);
  expect(isValidCodecTag('0x31637668')).toBe(true);
  expect(isValidCodecTag('hvc1 ')).toBe(false);
  expect(isValidCodecTag('hvc')).toBe(false);
});

test('needsHvc1Tag', () => {
  const hev1 = { codec_name: 'hevc', codec_tag_string: 'hev1' };
  expect(needsHvc1Tag({ stream: hev1, outFormat: 'mp4', customTag: undefined })).toBe(true);
  expect(needsHvc1Tag({ stream: hev1, outFormat: 'mp4', customTag: 'hev1' })).toBe(false);
  expect(needsHvc1Tag({ stream: hev1, outFormat: 'matroska', customTag: undefined })).toBe(false);
  expect(needsHvc1Tag({ stream: { codec_name: 'hevc', codec_tag_string: 'hvc1' }, outFormat: 'mov', customTag: undefined })).toBe(false);
  expect(needsHvc1Tag({ stream: { codec_name: 'h264', codec_tag_string: 'avc1' }, outFormat: 'mp4', customTag: undefined })).toBe(false);
});

test('getNonNativeMovMetadataKeys', () => {
  expect(getNonNativeMovMetadataKeys({ title: 'a', custom: 'b', deleted: '' }, streamMetadataKeys)).toEqual(['custom']);
  expect(getNonNativeMovMetadataKeys(undefined, streamMetadataKeys)).toEqual([]);
});
