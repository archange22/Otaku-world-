import type { KovaAdapter, KovaCategory, KovaMediaItem, KovaSource, KovaUnit, KovaAdapterSearchOptions } from './types';
import { MangaDexAdapter } from './manga/mangadex';
import { JikanMangaAdapter } from './manga/jikan';
import { ComicVineAdapter } from './comics/comicvine';
import { GoogleBooksAdapter, OpenLibraryAdapter } from './books/books';
import { getKovaSettings } from './settings';
import { getPrefs, hiddenGenres } from '@/lib/prefs';

export * from './types';
export * from './languages';
export * from './settings';
export * from './firebase/firestore-sync';

class KovaAdapterHub {
  private adapters: KovaAdapter[] = [];

  constructor() {
    this.register(new MangaDexAdapter());
    this.register(new JikanMangaAdapter());
    this.register(new ComicVineAdapter());
    this.register(new GoogleBooksAdapter());
    this.register(new OpenLibraryAdapter());
  }

  register(adapter: KovaAdapter) {
    this.adapters.push(adapter);
  }

  getSources(category?: KovaCategory): KovaSource[] {
    return [...new Set(this.adapters.filter((a) => !category || a.category === category).map((a) => a.source))];
  }

  async search(query: string, category?: KovaCategory, options?: KovaAdapterSearchOptions): Promise<KovaMediaItem[]> {
    const settings = getKovaSettings();
    const prefs = getPrefs();

    // KOVA applique toujours un filtrage sûr pour empêcher l'accès au contenu 18+.
    const searchOptions: KovaAdapterSearchOptions = {
      ...options,
      includeNsfw: false,
      limit: options?.limit || 20,
    };

    const targets = this.adapters.filter((a) => !category || a.category === category);
    if (targets.length === 0) return [];

    const perAdapter = Math.max(4, Math.ceil(searchOptions.limit! / targets.length));
    const results = await Promise.allSettled(
      targets.map((a) => a.search(query, { ...searchOptions, limit: perAdapter }))
    );

    const merged: KovaMediaItem[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') merged.push(...r.value);
    }

    const hidden = hiddenGenres(prefs);
    const normalized = merged.filter((item) => {
      if (item.isAdult) return false;
      const genres = item.genres.map((g) => g.toLowerCase());
      return !hidden.some((g) => genres.includes(g.toLowerCase()));
    });

    // Déduplication inter-sources sur le titre normalisé + catégorie.
    const seen = new Set<string>();
    return normalized.filter((item) => {
      const key = `${item.category}:${item.title.canonical.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, searchOptions.limit);
  }

  async getDetails(compositeId: string): Promise<KovaMediaItem | null> {
    const [source, externalId] = compositeId.split(':');
    if (!source || !externalId) return null;
    const adapter = this.adapters.find((a) => a.source === source);
    if (!adapter) return null;
    const item = await adapter.getDetails(externalId);
    return item?.isAdult ? null : item;
  }

  async getUnits(compositeId: string, options?: { languages?: string[]; allowAllLanguages?: boolean }): Promise<KovaUnit[]> {
    const [source, externalId] = compositeId.split(':');
    if (!source || !externalId) return [];
    const adapter = this.adapters.find((a) => a.source === source);
    if (!adapter || !adapter.getUnits) return [];

    const settings = getKovaSettings();
    const allowAll = options?.allowAllLanguages !== undefined ? options.allowAllLanguages : settings.allowAllLanguages;
    const langs = options?.languages || settings.preferredLanguages;

    return adapter.getUnits(externalId, { languages: langs, allowAllLanguages: allowAll });
  }

  async getChapterPages(source: KovaSource, chapterId: string): Promise<string[]> {
    const adapter = this.adapters.find((a) => a.source === source);
    if (!adapter || !adapter.getChapterPages) return [];
    return adapter.getChapterPages(chapterId);
  }
}

export const kova = new KovaAdapterHub();
export default kova;
