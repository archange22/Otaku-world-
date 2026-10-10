import type { KovaAdapter, KovaMediaItem, KovaAdapterSearchOptions } from '../types';

export class ComicVineAdapter implements KovaAdapter {
  source = 'comicvine' as const;
  category = 'comics' as const;
  name = 'Comic Vine';

  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, options?: KovaAdapterSearchOptions): Promise<KovaMediaItem[]> {
    if (!this.apiKey) {
      return this.mockComics(query);
    }

    try {
      const url = `https://comicvine.gamespot.com/api/search/?api_key=${this.apiKey}&format=json&query=${encodeURIComponent(query)}&resources=volume&limit=${options?.limit || 10}`;
      const res = await fetch(url);
      if (!res.ok) return this.mockComics(query);
      const json = await res.json();
      return (json.results || []).map((v: any) => ({
        id: `comicvine:${v.id}`,
        externalId: String(v.id),
        source: 'comicvine' as const,
        category: 'comics' as const,
        title: { canonical: v.name },
        description: (v.deck || v.description || '').replace(/<[^>]*>/g, ''),
        coverUrl: v.image?.medium_url || null,
        coverHqUrl: v.image?.super_url || null,
        genres: ['Comic', 'Superhero'],
        status: 'completed' as const,
        releaseYear: v.start_year ? parseInt(v.start_year, 10) : null,
        totalUnits: v.count_of_issues || null,
        authors: [v.publisher?.name || 'Comics Publisher'],
        format: 'Comic',
      }));
    } catch {
      return this.mockComics(query);
    }
  }

  async getDetails(externalId: string): Promise<KovaMediaItem | null> {
    const list = this.mockComics('');
    return list.find((c) => c.externalId === externalId) || null;
  }

  private mockComics(query: string): KovaMediaItem[] {
    const defaults: KovaMediaItem[] = [
      {
        id: 'comicvine:spider-man',
        externalId: 'spider-man',
        source: 'comicvine',
        category: 'comics',
        title: { canonical: 'The Amazing Spider-Man', english: 'The Amazing Spider-Man' },
        description: 'Peter Parker equilibre sa vie d adolescent et son role de protecteur masque de New York.',
        coverUrl: 'https://images.unsplash.com/photo-1604200213928-ba3cf4fc8436?w=600&auto=format&fit=crop',
        genres: ['Action', 'Super-héros', 'Sci-Fi'],
        status: 'ongoing',
        releaseYear: 1963,
        score: 95,
        totalUnits: 900,
        authors: ['Stan Lee', 'Steve Ditko'],
        format: 'Comic',
      },
      {
        id: 'comicvine:batman-year-one',
        externalId: 'batman-year-one',
        source: 'comicvine',
        category: 'comics',
        title: { canonical: 'Batman: Year One', english: 'Batman: Year One' },
        description: 'Les premiers pas du Chevalier Noir a Gotham City face a la pegre et a la corruption.',
        coverUrl: 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?w=600&auto=format&fit=crop',
        genres: ['Thriller', 'Super-héros', 'Noir'],
        status: 'completed',
        releaseYear: 1987,
        score: 98,
        totalUnits: 4,
        authors: ['Frank Miller', 'David Mazzucchelli'],
        format: 'Graphic Novel',
      },
      {
        id: 'comicvine:x-men',
        externalId: 'x-men',
        source: 'comicvine',
        category: 'comics',
        title: { canonical: 'Uncanny X-Men', english: 'Uncanny X-Men' },
        description: 'Une equipe de mutants lutte pour la coexistence pacifique avec les humains.',
        coverUrl: 'https://images.unsplash.com/photo-1569003339405-ea396a5a8a90?w=600&auto=format&fit=crop',
        genres: ['Action', 'Sci-Fi', 'Mutants'],
        status: 'ongoing',
        releaseYear: 1981,
        score: 92,
        totalUnits: 600,
        authors: ['Chris Claremont'],
        format: 'Comic',
      },
    ];

    if (!query) return defaults;
    const q = query.toLowerCase();
    return defaults.filter((d) => d.title.canonical.toLowerCase().includes(q));
  }
}
