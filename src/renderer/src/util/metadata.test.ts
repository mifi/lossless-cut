import { describe, expect, test } from 'vitest';

import { getCopyableMetadata, getEffectiveMetadata, getLanguageSuggestions, getNonNativeMovMetadataKeys, isValidCodecTag, isValidCreationTime, isValidLanguageCode, needsHvc1Tag } from './metadata';


describe('getLanguageSuggestions', () => {
  test('localized labels with codes', () => {
    const suggestions = getLanguageSuggestions('en');
    expect(suggestions).toContainEqual({ value: 'ger', label: 'German (ger)' });
    expect(getLanguageSuggestions('de')).toContainEqual({ value: 'ger', label: 'Deutsch (ger)' });
    expect(suggestions.every(({ value }) => isValidLanguageCode(value))).toBe(true);
  });

  test('underscore ui language', () => {
    expect(getLanguageSuggestions('pt_BR')).toContainEqual({ value: 'ger', label: 'alemão (ger)' });
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
  expect(getNonNativeMovMetadataKeys({ metadata: { title: 'a', custom: 'b', deleted: '' }, outFormat: 'mov', isStream: true })).toEqual(['custom']);
  expect(getNonNativeMovMetadataKeys({ metadata: { title: 'a' }, outFormat: 'mp4', isStream: true })).toEqual(['title']);
  expect(getNonNativeMovMetadataKeys({ metadata: { title: 'a', lyrics: 'b', custom: 'c' }, outFormat: 'mp4', isStream: false })).toEqual(['custom']);
  expect(getNonNativeMovMetadataKeys({ metadata: undefined, outFormat: 'mp4', isStream: true })).toEqual([]);
});

test('isValidCreationTime', () => {
  expect(isValidCreationTime('now')).toBe(true);
  expect(isValidCreationTime(new Date().toISOString())).toBe(true);
  expect(isValidCreationTime('2024-12-31 23:59:59')).toBe(true);
  expect(isValidCreationTime('12:00:00')).toBe(true);
  expect(isValidCreationTime('12/31/2024')).toBe(false);
  expect(isValidCreationTime('1')).toBe(false);
});

test('getEffectiveMetadata', () => {
  expect(getEffectiveMetadata({ title: 'a', language: 'eng', comment: 'c' }, { title: 'b', comment: '' })).toEqual({ title: 'b', language: 'eng' });
  expect(getEffectiveMetadata(undefined, undefined)).toEqual({});
});

test('getCopyableMetadata', () => {
  expect(getCopyableMetadata({
    title: 'a',
    language: 'eng',
    DURATION: '00:01:00.000',
    'BPS-eng': '128000',
    _STATISTICS_WRITING_APP: 'mkvmerge',
    encoder: 'Lavf',
    major_brand: 'isom',
    handler_name: 'SoundHandler',
    iTunSMPB: ' 00000000 00000840',
  })).toEqual({ title: 'a', language: 'eng' });
});
