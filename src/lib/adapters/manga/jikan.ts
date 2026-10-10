import type { KovaAdapter, KovaMediaItem, KovaAdapterSearchOptions } from '../types';

export class JikanMangaAdapter implements KovaAdapter {
  source = 'jikan' as const;
  category = 'manga' as const;
  name = 'Jikan / MyAnimeList';

  private BASE_URL = 'https://api.jikan.moe/v4';

  async search(query: string, options?: KovaAdapterSearchOptions): Promise<KovaMediaItem[]> {
    const limit = options?.limit || 20;
    const page = options?.page || 1;
    // SFW mode parameter: true when includeNsfw is FALSE
    const sfw = options?.includeNsfw === true ? 'false' : 'true';

    const url = `${this.BASE_URL}/manga?q=${encodeURIComponent(query)}&limit=${limit}&page=${page}&sfw=${sfw}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data || []).map((m: any) => this.transform(m));
  }

  async getDetails(externalId: string): Promise<KovaMediaItem | null> {
    const url = `${this.BASE_URL}/manga/${externalId}/full`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ? this.transform(json.data) : null;
  }

  private transform(m: any): KovaMediaItem {
    const statusMap: Record<string, any> = {
      'Publishing': 'ongoing',
      'Finished': 'completed',
      'On Hiatus': 'hiatus',
      'Discontinued': 'cancelled',
    };

    const isHentai = (m.genres || []).some((g: any) => ['Hentai', 'Erotica'].includes(g.name));

    return {
      id: `jikan:${m.mal_id}`,
      externalId: String(m.mal_id),
      source: 'jikan',
      category: 'manga',
      title: {
        canonical: m.title,
        english: m.title_english || null,
        romaji: m.title || null,
        native: m.title_japanese || null,
      },
      description: m.synopsis || '',
      coverUrl: m.images?.webp?.image_url || m.images?.jpg?.image_url || null,
      coverHqUrl: m.images?.webp?.large_image_url || m.images?.jpg?.large_image_url || null,
      genres: (m.genres || []).map((g: any) => g.name),
      status: statusMap[m.status] || 'unknown',
      releaseYear: m.published?.from ? new Date(m.published.from).getFullYear() : null,
      score: m.score ? Math.round(m.score * 10) : null,
      totalUnits: m.chapters || null,
      authors: (m.authors || []).map((a: any) => a.name),
      format: m.type || 'Manga',
      isAdult: isHentai,
    };
  }
}
