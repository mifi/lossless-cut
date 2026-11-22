import { describe, expect, test } from 'vitest';

import { getCopyableMetadata, getEffectiveMetadata, getLanguageSuggestions, getNonNativeMovMetadataKeys, getTrackTitleFromName, isValidCodecTag, isValidCreationTime, isValidLanguageCode, needsHvc1Tag } from './metadata';


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
  expect(getNonNativeMovMetadataKeys({ metadata: { title: 'a', custom: 'b', deleted: '' }, outFormat: 'mov', isStream: true })).toStrictEqual(['custom']);
  // the MP4 muxer writes a track's title as its name, but the ipod (m4a) muxer doesn't
  expect(getNonNativeMovMetadataKeys({ metadata: { title: 'a' }, outFormat: 'mp4', isStream: true })).toStrictEqual([]);
  expect(getNonNativeMovMetadataKeys({ metadata: { title: 'a' }, outFormat: 'ipod', isStream: true })).toStrictEqual(['title']);
  expect(getNonNativeMovMetadataKeys({ metadata: { title: 'a', lyrics: 'b', custom: 'c' }, outFormat: 'mp4', isStream: false })).toStrictEqual(['custom']);
  expect(getNonNativeMovMetadataKeys({ metadata: undefined, outFormat: 'mp4', isStream: true })).toStrictEqual([]);
});

test('getTrackTitleFromName', () => {
  // MP4/MOV track names are read as `name`, but written from `title`
  expect(getTrackTitleFromName({ existing: { name: 'Dialogue', handler_name: 'SoundHandler' }, outFormat: 'mp4' })).toBe('Dialogue');
  expect(getTrackTitleFromName({ existing: { name: 'Dialogue' }, outFormat: 'mov' })).toBe('Dialogue');
  expect(getTrackTitleFromName({ existing: { name: 'Dialogue' }, outFormat: 'matroska' })).toBe('Dialogue');
  // formats that don't write a track name from `title`
  expect(getTrackTitleFromName({ existing: { name: 'Dialogue' }, outFormat: 'ipod' })).toBeUndefined();
  expect(getTrackTitleFromName({ existing: { name: 'Dialogue' }, outFormat: 'mpegts' })).toBeUndefined();
  expect(getTrackTitleFromName({ existing: { name: 'Dialogue' }, outFormat: undefined })).toBeUndefined();
  // an existing title, or the user's own title (also when deleted), wins
  expect(getTrackTitleFromName({ existing: { name: 'Dialogue', title: 'Other' }, outFormat: 'mp4' })).toBeUndefined();
  expect(getTrackTitleFromName({ existing: { name: 'Dialogue' }, custom: { title: 'Mine' }, outFormat: 'mp4' })).toBeUndefined();
  expect(getTrackTitleFromName({ existing: { name: 'Dialogue', title: 'Other' }, custom: { title: '' }, outFormat: 'mp4' })).toBeUndefined();
  // the user's changes to the name are used
  expect(getTrackTitleFromName({ existing: { name: 'Dialogue' }, custom: { name: 'Speech' }, outFormat: 'mp4' })).toBe('Speech');
  expect(getTrackTitleFromName({ existing: { name: 'Dialogue' }, custom: { name: '' }, outFormat: 'mp4' })).toBeUndefined();
  expect(getTrackTitleFromName({ existing: { handler_name: 'SoundHandler' }, outFormat: 'mp4' })).toBeUndefined();
  expect(getTrackTitleFromName({ existing: undefined, outFormat: 'mp4' })).toBeUndefined();
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
  expect(getEffectiveMetadata({ title: 'a', language: 'eng', comment: 'c' }, { title: 'b', comment: '' })).toStrictEqual({ title: 'b', language: 'eng' });
  expect(getEffectiveMetadata(undefined, undefined)).toStrictEqual({});
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
    creation_time: '2024-01-01T00:00:00.000000Z',
    filename: 'font.ttf',
  })).toStrictEqual({ title: 'a', language: 'eng' });
  expect(getCopyableMetadata({ handler_name: 'English Commentary' })).toStrictEqual({ handler_name: 'English Commentary' });
  expect(getCopyableMetadata({ handler_name: '\u{10}DJI.Subtitle' })).toStrictEqual({});
});
