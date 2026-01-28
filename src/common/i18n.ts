// returned from app.getLocale()
// https://www.electronjs.org/docs/api/app#appgetlocale
// https://source.chromium.org/chromium/chromium/src/+/master:ui/base/l10n/l10n_util.cc
export type ElectronLanguageKey =
'af' // Afrikaans
| 'ak' // Twi
| 'am' // Amharic
| 'an' // Aragonese
| 'ar' // Arabic
| 'as' // Assamese
| 'ast' // Asturian
| 'ay' // Aymara
| 'az' // Azerbaijani
| 'be' // Belarusian
| 'bg' // Bulgarian
| 'bho' // Bhojpuri
| 'bm' // Bambara
| 'bn' // Bengali
| 'br' // Breton
| 'bs' // Bosnian
| 'ca' // Catalan
| 'ceb' // Cebuano
| 'chr' // Cherokee
| 'ckb' // Kurdish (Arabic),  Sorani
| 'co' // Corsican
| 'cs' // Czech
| 'cy' // Welsh
| 'da' // Danish
| 'de' // German
| 'de-AT' // German (Austria)
| 'de-CH' // German (Switzerland)
| 'de-DE' // German (Germany)
| 'de-LI' // German (Liechtenstein)
| 'doi' // Dogri
| 'dv' // Dhivehi
| 'ee' // Ewe
| 'el' // Greek
| 'en' // English
| 'en-AU' // English (Australia)
| 'en-CA' // English (Canada)
| 'en-GB' // English (UK)
| 'en-GB-oxendict' // English (UK, OED spelling)
| 'en-IE' // English (Ireland)
| 'en-IN' // English (India)
| 'en-NZ' // English (New Zealand)
| 'en-US' // English (US)
| 'en-ZA' // English (South Africa)
| 'eo' // Esperanto
| 'es' // Spanish
| 'es-419' // Spanish (Latin America)
| 'es-AR' // Spanish (Argentina)
| 'es-CL' // Spanish (Chile)
| 'es-CO' // Spanish (Colombia)
| 'es-CR' // Spanish (Costa Rica)
| 'es-ES' // Spanish (Spain)
| 'es-HN' // Spanish (Honduras)
| 'es-MX' // Spanish (Mexico)
| 'es-PE' // Spanish (Peru)
| 'es-US' // Spanish (US)
| 'es-UY' // Spanish (Uruguay)
| 'es-VE' // Spanish (Venezuela)
| 'et' // Estonian
| 'eu' // Basque
| 'fa' // Persian
| 'fi' // Finnish
| 'fil' // Filipino
| 'fo' // Faroese
| 'fr' // French
| 'fr-CA' // French (Canada)
| 'fr-CH' // French (Switzerland)
| 'fr-FR' // French (France)
| 'fy' // Frisian
| 'ga' // Irish
| 'gd' // Scots Gaelic
| 'gl' // Galician
| 'gn' // Guarani
| 'gu' // Gujarati
| 'ha' // Hausa
| 'haw' // Hawaiian
| 'he' // Hebrew
| 'hi' // Hindi
| 'hmn' // Hmong
| 'hr' // Croatian
| 'ht' // Haitian Creole
| 'hu' // Hungarian
| 'hy' // Armenian
| 'ia' // Interlingua
| 'id' // Indonesian
| 'ig' // Igbo
| 'ilo' // Ilocano
| 'is' // Icelandic
| 'it' // Italian
| 'it-CH' // Italian (Switzerland)
| 'it-IT' // Italian (Italy)
| 'ja' // Japanese
| 'jv' // Javanese
| 'ka' // Georgian
| 'kk' // Kazakh
| 'km' // Cambodian
| 'kn' // Kannada
| 'ko' // Korean
| 'kok' // Konkani
| 'kri' // Krio
| 'ku' // Kurdish
| 'ky' // Kyrgyz
| 'la' // Latin
| 'lb' // Luxembourgish
| 'lg' // Luganda
| 'ln' // Lingala
| 'lo' // Laothian
| 'lt' // Lithuanian
| 'lus' // Mizo
| 'lv' // Latvian
| 'mai' // Maithili
| 'mg' // Malagasy
| 'mi' // Maori
| 'mk' // Macedonian
| 'ml' // Malayalam
| 'mn' // Mongolian
| 'mni-Mtei' // Manipuri (Meitei Mayek)
| 'mo' // Moldavian
| 'mr' // Marathi
| 'ms' // Malay
| 'mt' // Maltese
| 'my' // Burmese
| 'nb' // Norwegian (Bokmal)
| 'ne' // Nepali
| 'nl' // Dutch
| 'nn' // Norwegian (Nynorsk)
| 'no' // Norwegian
| 'nso' // Sepedi
| 'ny' // Nyanja
| 'oc' // Occitan
| 'om' // Oromo
| 'or' // Odia (Oriya)
| 'pa' // Punjabi
| 'pl' // Polish
| 'ps' // Pashto
| 'pt' // Portuguese
| 'pt-BR' // Portuguese (Brazil)
| 'pt-PT' // Portuguese (Portugal)
| 'qu' // Quechua
| 'rm' // Romansh
| 'ro' // Romanian
| 'ru' // Russian
| 'rw' // Kinyarwanda
| 'sa' // Sanskrit
| 'sd' // Sindhi
| 'sh' // Serbo-Croatian
| 'si' // Sinhalese
| 'sk' // Slovak
| 'sl' // Slovenian
| 'sm' // Samoan
| 'sn' // Shona
| 'so' // Somali
| 'sq' // Albanian
| 'sr' // Serbian
| 'st' // Sesotho
| 'su' // Sundanese
| 'sv' // Swedish
| 'sw' // Swahili
| 'ta' // Tamil
| 'te' // Telugu
| 'tg' // Tajik
| 'th' // Thai
| 'ti' // Tigrinya
| 'tk' // Turkmen
| 'tn' // Tswana
| 'to' // Tonga
| 'tr' // Turkish
| 'ts' // Tsonga
| 'tt' // Tatar
| 'tw' // Twi
| 'ug' // Uyghur
| 'uk' // Ukrainian
| 'ur' // Urdu
| 'uz' // Uzbek
| 'vi' // Vietnamese
| 'wa' // Walloon
| 'wo' // Wolof
| 'xh' // Xhosa
| 'yi' // Yiddish
| 'yo' // Yoruba
| 'zh' // Chinese
| 'zh-CN' // Chinese (China)
| 'zh-HK' // Chinese (Hong Kong)
| 'zh-TW' // Chinese (Taiwan)
| 'zu' // Zulu

// https://www.electronjs.org/docs/api/app#appgetlocale
// https://source.chromium.org/chromium/chromium/src/+/master:ui/base/l10n/l10n_util.cc
// See i18n.js
export const langNames = {
  en: 'English',
  cs: 'Čeština',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  nl: 'Nederlands',
  nb: 'Norsk (bokmål)',
  nn: 'Norsk (nynorsk)',
  // sv: 'Svenska',
  pl: 'Polski',
  pt: 'Português',
  'pt-BR': 'Português do Brasil',
  sl: 'Slovenščina',
  sk: 'Slovenčina',
  fi: 'Suomi',
  ru: 'Русский',
  uk: 'Українська',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  ja: '日本語',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  ko: '한국어',
  ta: 'தமிழ்',
  lt: 'Lietuvių',
  hu: 'Magyar',
} satisfies Partial<Record<ElectronLanguageKey, string>>;

export type SupportedLanguage = (keyof typeof langNames);

// Weblate hardcodes different lang codes than electron
// https://www.electronjs.org/docs/api/app#appgetlocale
// https://source.chromium.org/chromium/chromium/src/+/master:ui/base/l10n/l10n_util.cc
export function mapLang(lng: ElectronLanguageKey) {
  const map: Partial<Record<ElectronLanguageKey, string>> = {
    'de-AT': 'de',
    'de-CH': 'de',
    'de-DE': 'de',
    'de-LI': 'de',

    'es-419': 'es',
    'es-AR': 'es',
    'es-CL': 'es',
    'es-CO': 'es',
    'es-CR': 'es',
    'es-ES': 'es',
    'es-HN': 'es',
    'es-MX': 'es',
    'es-PE': 'es',
    'es-US': 'es',
    'es-UY': 'es',
    'es-VE': 'es',

    'fr-CA': 'fr',
    'fr-CH': 'fr',
    'fr-FR': 'fr',

    nb: 'nb_NO',
    no: 'nb_NO',

    zh: 'zh_Hans',
    'zh-CN': 'zh_Hans',
    'zh-TW': 'zh_Hant',
    'zh-HK': 'zh_Hant',

    'pt-BR': 'pt_BR',
    'pt-PT': 'pt',

    'it-CH': 'it',
    'it-IT': 'it',
  };

  return map[lng] ?? lng;
}
