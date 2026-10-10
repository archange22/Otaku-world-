import type { KovaAdapter, KovaMediaItem, KovaAdapterSearchOptions, KovaUnit } from '../types';
import { KOVA_ALL_LANGUAGES } from '../languages';

export class MangaDexAdapter implements KovaAdapter {
  source = 'mangadex' as const;
  category = 'manga' as const;
  name = 'MangaDex';

  private BASE_URL = 'https://api.mangadex.org';

  async search(query: string, options?: KovaAdapterSearchOptions): Promise<KovaMediaItem[]> {
    const limit = options?.limit || 20;
    const offset = ((options?.page || 1) - 1) * limit;
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      'includes[]': 'cover_art',
    });

    ['safe', 'suggestive'].forEach((cr) => params.append('contentRating[]', cr));
    if (query) params.set('title', query);
    if (options?.languages?.length) options.languages.forEach((l) => params.append('availableTranslatedLanguage[]', l));

    if (options?.sort === 'rating') params.set('order[rating]', 'desc');
    else if (options?.sort === 'latest') params.set('order[latestUploadedChapter]', 'desc');
    else params.set('order[followedCount]', 'desc');

    const res = await fetch(`${this.BASE_URL}/manga?${params.toString()}`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data || []).map((m: any) => this.transform(m)).filter((m: KovaMediaItem) => !m.isAdult);
  }

  async getDetails(externalId: string): Promise<KovaMediaItem | null> {
    const res = await fetch(`${this.BASE_URL}/manga/${externalId}?includes[]=cover_art&includes[]=author`);
    if (!res.ok) return null;
    const json = await res.json();
    const item = json.data ? this.transform(json.data) : null;
    return item?.isAdult ? null : item;
  }

  async getUnits(externalId: string, options?: { languages?: string[]; allowAllLanguages?: boolean }): Promise<KovaUnit[]> {
    const params = new URLSearchParams({ manga: externalId, limit: '100', 'order[chapter]': 'asc' });
    ['safe', 'suggestive'].forEach((cr) => params.append('contentRating[]', cr));

    if (options?.languages?.length && options.allowAllLanguages === false) {
      options.languages.forEach((lang) => params.append('translatedLanguage[]', lang));
    }

    const res = await fetch(`${this.BASE_URL}/chapter?${params.toString()}`);
    if (!res.ok) return [];
    const json = await res.json();
    const flagMap = new Map(KOVA_ALL_LANGUAGES.map((l) => [l.code, l.flag]));

    return (json.data || []).map((c: any) => {
      const lang = c.attributes?.translatedLanguage || 'en';
      return {
        id: `mangadex:${c.id}`,
        externalId: c.id,
        mediaId: `mangadex:${externalId}`,
        source: 'mangadex',
        number: c.attributes?.chapter || '1',
        title: c.attributes?.title || null,
        language: lang,
        languageFlag: flagMap.get(lang) || '🌐',
        pagesCount: c.attributes?.pages || 0,
        publishedAt: c.attributes?.publishAt || null,
      };
    });
  }

  async getChapterPages(chapterId: string): Promise<string[]> {
    const res = await fetch(`${this.BASE_URL}/at-home/server/${chapterId}`);
    if (!res.ok) return [];
    const json = await res.json();
    const baseUrl = json.baseUrl;
    const hash = json.chapter?.hash;
    const pageFiles = json.chapter?.data || [];
    return pageFiles.map((f: string) => `${baseUrl}/data/${hash}/${f}`);
  }

  private transform(m: any): KovaMediaItem {
    const attrs = m.attributes || {};
    const titleObj = attrs.title || {};
    const canonical = titleObj.fr || titleObj.en || Object.values(titleObj)[0] || 'Titre inconnu';
    const coverRel = (m.relationships || []).find((r: any) => r.type === 'cover_art');
    const fileName = coverRel?.attributes?.fileName;
    const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}.512.jpg` : null;
    const coverHqUrl = fileName ? `https://uploads.mangadex.org/covers/${m.id}/${fileName}` : null;
    const authorRel = (m.relationships || []).find((r: any) => r.type === 'author');

    return {
      id: `mangadex:${m.id}`,
      externalId: m.id,
      source: 'mangadex',
      category: 'manga',
      title: { canonical: String(canonical), english: titleObj.en || null },
      description: attrs.description?.fr || attrs.description?.en || Object.values(attrs.description || {})[0] as string || '',
      coverUrl,
      coverHqUrl,
      genres: (attrs.tags || []).map((t: any) => t.attributes?.name?.en).filter(Boolean),
      status: attrs.status === 'ongoing' ? 'ongoing' : attrs.status === 'completed' ? 'completed' : attrs.status === 'hiatus' ? 'hiatus' : attrs.status === 'cancelled' ? 'cancelled' : 'unknown',
      releaseYear: attrs.year || null,
      authors: authorRel?.attributes?.name ? [authorRel.attributes.name] : [],
      format: attrs.originalLanguage === 'ko' ? 'Manhwa' : attrs.originalLanguage?.startsWith('zh') ? 'Manhua' : 'Manga',
      isAdult: attrs.contentRating === 'erotica' || attrs.contentRating === 'pornographic',
      availableLanguages: attrs.availableTranslatedLanguages || [],
    };
  }
}
