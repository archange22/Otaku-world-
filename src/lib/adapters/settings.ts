import { ALL_LANGUAGE_CODES } from './languages';

export interface KovaUserSettings {
  includeNsfw: boolean;
  preferredLanguages: string[];
  allowAllLanguages: boolean;
  readerMode: 'paged' | 'webtoon';
  imageQuality: 'data' | 'dataSaver';
}

const SETTINGS_KEY = 'kova:settings';

const DEFAULT_SETTINGS: KovaUserSettings = {
  includeNsfw: false,
  preferredLanguages: ['fr', 'en'],
  allowAllLanguages: true,
  readerMode: 'webtoon',
  imageQuality: 'data',
};

export function getKovaSettings(): KovaUserSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed, includeNsfw: false };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function updateKovaSettings(patch: Partial<KovaUserSettings>): KovaUserSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const current = getKovaSettings();
  const next = { ...current, ...patch, includeNsfw: false };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('kova:settings-changed', { detail: next }));
  return next;
}

export { ALL_LANGUAGE_CODES };
