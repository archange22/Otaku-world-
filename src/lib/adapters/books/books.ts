import type { KovaAdapter, KovaMediaItem, KovaAdapterSearchOptions } from '../types';

export class GoogleBooksAdapter implements KovaAdapter {
  source = 'google_books' as const;
  category = 'books' as const;
  name = 'Google Books & BD';

  private BASE_URL = 'https://www.googleapis.com/books/v1/volumes';

  async search(query: string, options?: KovaAdapterSearchOptions): Promise<KovaMediaItem[]> {
    const maxResults = options?.limit || 20;
    const startIndex = ((options?.page || 1) - 1) * maxResults;
    let url = `${this.BASE_URL}?q=${encodeURIComponent(query)}&maxResults=${maxResults}&startIndex=${startIndex}`;
    
    // Support language restriction if requested, or search all languages by default
    if (options?.languages && options.languages.length === 1) {
      url += `&langRestrict=${options.languages[0]}`;
    }

    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.items || []).map((item: any) => this.transform(item));
  }

  async getDetails(externalId: string): Promise<KovaMediaItem | null> {
    const url = `${this.BASE_URL}/${externalId}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json.id ? this.transform(json) : null;
  }

  private transform(item: any): KovaMediaItem {
    const vi = item.volumeInfo || {};
    const imgLinks = vi.imageLinks || {};
    const cover = imgLinks.medium || imgLinks.thumbnail || imgLinks.smallThumbnail || null;
    const coverHq = imgLinks.extraLarge || imgLinks.large || cover;

    return {
      id: `google_books:${item.id}`,
      externalId: item.id,
      source: 'google_books',
      category: 'books',
      title: {
        canonical: vi.title || 'Livre sans titre',
        english: vi.subtitle ? `${vi.title}: ${vi.subtitle}` : vi.title,
      },
      description: vi.description || '',
      coverUrl: cover ? cover.replace('http://', 'https://') : null,
      coverHqUrl: coverHq ? coverHq.replace('http://', 'https://') : null,
      genres: vi.categories || ['Livre / BD'],
      status: 'completed',
      releaseYear: vi.publishedDate ? parseInt(vi.publishedDate.slice(0, 4), 10) : null,
      score: vi.averageRating ? Math.round(vi.averageRating * 20) : null,
      totalUnits: vi.pageCount || null,
      authors: vi.authors || [],
      format: vi.printType || 'BOOK',
      availableLanguages: vi.language ? [vi.language] : [],
      url: vi.infoLink,
    };
  }
}

export class OpenLibraryAdapter implements KovaAdapter {
  source = 'open_library' as const;
  category = 'books' as const;
  name = 'Open Library';

  private BASE_URL = 'https://openlibrary.org';

  async search(query: string, options?: KovaAdapterSearchOptions): Promise<KovaMediaItem[]> {
    const limit = options?.limit || 20;
    const url = `${this.BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.docs || []).map((doc: any) => this.transform(doc));
  }

  async getDetails(externalId: string): Promise<KovaMediaItem | null> {
    const url = `${this.BASE_URL}/works/${externalId}.json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json.key ? this.transformWork(json, externalId) : null;
  }

  private transform(doc: any): KovaMediaItem {
    const workKey = (doc.key || '').replace('/works/', '');
    const coverId = doc.cover_i;
    const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null;
    const coverHqUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;

    return {
      id: `open_library:${workKey}`,
      externalId: workKey,
      source: 'open_library',
      category: 'books',
      title: { canonical: doc.title },
      description: doc.first_sentence?.[0] || '',
      coverUrl,
      coverHqUrl,
      genres: doc.subject ? doc.subject.slice(0, 5) : ['Littérature / BD'],
      status: 'completed',
      releaseYear: doc.first_publish_year || null,
      score: doc.ratings_average ? Math.round(doc.ratings_average * 20) : null,
      totalUnits: doc.number_of_pages_median || null,
      authors: doc.author_name || [],
      format: 'Book',
      availableLanguages: doc.language || [],
    };
  }

  private transformWork(work: any, key: string): KovaMediaItem {
    const desc = typeof work.description === 'string' ? work.description : work.description?.value || '';
    const coverId = work.covers?.[0];
    const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null;

    return {
      id: `open_library:${key}`,
      externalId: key,
      source: 'open_library',
      category: 'books',
      title: { canonical: work.title },
      description: desc,
      coverUrl,
      genres: work.subjects?.slice(0, 5) || [],
      status: 'completed',
      format: 'Work',
    };
  }
}
