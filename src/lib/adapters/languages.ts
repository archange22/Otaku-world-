/**
 * KOVA Universal Language Catalog
 * Curated entries keep the best labels; every other ISO 639-1 language is generated.
 */

export interface KovaLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

const CURATED: KovaLanguage[] = [
  { code: 'fr', name: 'Français', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'Anglais', nativeName: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Espagnol (Castillan)', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'es-la', name: 'Espagnol (Amérique Latine)', nativeName: 'Español Latino', flag: '🇲🇽' },
  { code: 'pt-br', name: 'Portugais (Brésil)', nativeName: 'Português Brasileiro', flag: '🇧🇷' },
  { code: 'pt', name: 'Portugais (Portugal)', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'it', name: 'Italien', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'de', name: 'Allemand', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'ru', name: 'Russe', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: 'Japonais', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Coréen', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinois (Simplifié)', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'zh-hk', name: 'Chinois (Traditionnel)', nativeName: '繁體中文', flag: '🇭🇰' },
  { code: 'ar', name: 'Arabe', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'id', name: 'Indonésien', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'vi', name: 'Vietnamien', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'tr', name: 'Turc', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'pl', name: 'Polonais', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'th', name: 'Thaï', nativeName: 'ไทย', flag: '🇹🇭' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'uk', name: 'Ukrainien', nativeName: 'Українська', flag: '🇺🇦' },
  { code: 'nl', name: 'Néerlandais', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', name: 'Suédois', nativeName: 'Svenska', flag: '🇸🇪' },
  { code: 'el', name: 'Grec', nativeName: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'he', name: 'Hébreu', nativeName: 'עברית', flag: '🇮🇱' },
  { code: 'hu', name: 'Hongrois', nativeName: 'Magyar', flag: '🇭🇺' },
  { code: 'ro', name: 'Roumain', nativeName: 'Română', flag: '🇷🇴' },
  { code: 'cs', name: 'Tchèque', nativeName: 'Čeština', flag: '🇨🇿' },
  { code: 'fa', name: 'Persan', nativeName: 'فارسی', flag: '🇮🇷' },
  { code: 'ms', name: 'Malais', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'tl', name: 'Tagalog / Philippin', nativeName: 'Tagalog', flag: '🇵🇭' },
];

// Every ISO 639-1 language code.
const ISO_639_1 = (
  'aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy ' +
  'da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ' +
  'ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv ' +
  'mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw ' +
  'sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu'
).split(' ');

// Flag for the country most associated with a language. Falls back to a globe.
const FLAG_BY_LANG: Record<string, string> = {
  af: '🇿🇦', am: '🇪🇹', az: '🇦🇿', bg: '🇧🇬', bn: '🇧🇩', bs: '🇧🇦', ca: '🇪🇸', cy: '🇬🇧',
  da: '🇩🇰', et: '🇪🇪', eu: '🇪🇸', fi: '🇫🇮', fo: '🇫🇴', fy: '🇳🇱', ga: '🇮🇪', gl: '🇪🇸',
  gu: '🇮🇳', ha: '🇳🇬', ht: '🇭🇹', hr: '🇭🇷', hy: '🇦🇲', ig: '🇳🇬', is: '🇮🇸', ka: '🇬🇪',
  kk: '🇰🇿', km: '🇰🇭', kn: '🇮🇳', ku: '🇹🇷', ky: '🇰🇬', la: '🇻🇦', lb: '🇱🇺', lo: '🇱🇦',
  lt: '🇱🇹', lv: '🇱🇻', mg: '🇲🇬', mk: '🇲🇰', ml: '🇮🇳', mn: '🇲🇳', mr: '🇮🇳', mt: '🇲🇹',
  my: '🇲🇲', nb: '🇳🇴', ne: '🇳🇵', nn: '🇳🇴', no: '🇳🇴', pa: '🇮🇳', ps: '🇦🇫', qu: '🇵🇪',
  gn: '🇵🇾', ay: '🇧🇴', rw: '🇷🇼', ln: '🇨🇩', lg: '🇺🇬', om: '🇪🇹', ti: '🇪🇷', so: '🇸🇴',
  si: '🇱🇰', sk: '🇸🇰', sl: '🇸🇮', sn: '🇿🇼', sq: '🇦🇱', sr: '🇷🇸', sv: '🇸🇪', sw: '🇰🇪',
  ta: '🇮🇳', te: '🇮🇳', tg: '🇹🇯', tk: '🇹🇲', ur: '🇵🇰', uz: '🇺🇿', zu: '🇿🇦', xh: '🇿🇦',
  mi: '🇳🇿', haw: '🇺🇸', sm: '🇼🇸', to: '🇹🇴', fj: '🇫🇯', ny: '🇲🇼', tn: '🇧🇼', st: '🇱🇸',
  ss: '🇸🇿', ve: '🇿🇦', nd: '🇿🇼', nr: '🇿🇦', bi: '🇻🇺', tt: '🇷🇺', ug: '🇨🇳', bo: '🇨🇳',
  ks: '🇮🇳', as: '🇮🇳', or: '🇮🇳', ms_: '🇲🇾', jv: '🇮🇩', su: '🇮🇩', ce: '🇷🇺', cv: '🇷🇺',
  ba: '🇷🇺', ab: '🇬🇪', os: '🇷🇺', be: '🇧🇾', ro_: '🇷🇴', ff: '🇸🇳', wo: '🇸🇳', ak: '🇬🇭',
  tw: '🇬🇭', ee: '🇬🇭', ki: '🇰🇪', yo: '🇳🇬', rn: '🇧🇮', ty: '🇵🇫', ie: '🇪🇺', eo: '🌐',
};

const curatedCodes = new Set(CURATED.map((l) => l.code));
const frDisplay = new Intl.DisplayNames(['fr'], { type: 'language' });

function labelIn(locale: string, code: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

const GENERATED: KovaLanguage[] = ISO_639_1.filter((code) => !curatedCodes.has(code)).map((code) => {
  let name = code;
  try {
    name = frDisplay.of(code) ?? code;
  } catch {
    /* unknown code: keep the raw code */
  }
  return {
    code,
    name,
    nativeName: labelIn(code, code),
    flag: FLAG_BY_LANG[code] ?? '🌐',
  };
});

export const KOVA_ALL_LANGUAGES: KovaLanguage[] = [...CURATED, ...GENERATED];

export const ALL_LANGUAGE_CODES = KOVA_ALL_LANGUAGES.map((l) => l.code);

export function getLanguage(code: string): KovaLanguage | undefined {
  return KOVA_ALL_LANGUAGES.find((l) => l.code === code);
}
