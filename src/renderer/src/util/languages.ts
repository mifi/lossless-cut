import type { Suggestion } from '../components/SuggestionTextField';


// Common ISO 639-2/B codes (as used by Matroska and ffmpeg) mapped to BCP 47, for displaying localized names
const languages: [iso6392: string, bcp47: string][] = [
  ['ara', 'ar'], ['ben', 'bn'], ['bul', 'bg'], ['chi', 'zh'], ['cze', 'cs'], ['dan', 'da'], ['dut', 'nl'], ['eng', 'en'],
  ['fil', 'fil'], ['fin', 'fi'], ['fre', 'fr'], ['ger', 'de'], ['gre', 'el'], ['heb', 'he'], ['hin', 'hi'], ['hrv', 'hr'],
  ['hun', 'hu'], ['ice', 'is'], ['ind', 'id'], ['ita', 'it'], ['jpn', 'ja'], ['kor', 'ko'], ['may', 'ms'], ['nor', 'no'],
  ['per', 'fa'], ['pol', 'pl'], ['por', 'pt'], ['rum', 'ro'], ['rus', 'ru'], ['slo', 'sk'], ['slv', 'sl'], ['spa', 'es'],
  ['srp', 'sr'], ['swe', 'sv'], ['tam', 'ta'], ['tel', 'te'], ['tha', 'th'], ['tur', 'tr'], ['ukr', 'uk'], ['urd', 'ur'],
  ['vie', 'vi'], ['und', 'und'],
];

export function getLanguageSuggestions(uiLanguage: string): Suggestion[] {
  let displayNames: Intl.DisplayNames | undefined;
  try {
    displayNames = new Intl.DisplayNames([uiLanguage, 'en'], { type: 'language' });
  } catch {
    // ignore, fall back to codes only
  }
  return languages
    .map(([value, bcp47]) => ({ value, label: `${displayNames?.of(bcp47) ?? value} (${value})` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export const isValidLanguageCode = (code: string) => /^[a-z]{3}$/.test(code);
