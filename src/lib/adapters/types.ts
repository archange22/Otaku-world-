export type KovaCategory = 'manga' | 'comics' | 'books';

export type KovaSource =
  | 'mangadex'
  | 'jikan'
  | 'mal'
  | 'marvel'
  | 'comicvine'
  | 'metron'
  | 'gcd'
  | 'google_books'
  | 'open_library';

export type KovaStatus = 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | 'unknown';
export type KovaSort = 'popularity' | 'trending' | 'rating' | 'latest';

export interface KovaTitle {
  canonical: string;
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
}

export interface KovaMediaItem {
  id: string;
  externalId: string;
  source: KovaSource;
  category: KovaCategory;
  title: KovaTitle;
  description: string;
  coverUrl: string | null;
  coverHqUrl?: string | null;
  bannerUrl?: string | null;
  genres: string[];
  status: KovaStatus;
  releaseYear?: number | null;
  score?: number | null;
  totalUnits?: number | null;
  authors?: string[];
  studios?: string[];
  format?: string | null;
  isAdult?: boolean;
  availableLanguages?: string[];
  url?: string;
  extra?: Record<string, any>;
}

export interface KovaUnit {
  id: string;
  externalId: string;
  mediaId: string;
  source: KovaSource;
  number: string | number;
  title: string | null;
  language: string; // 'fr', 'en', 'es', 'pt-br', 'ja', etc.
  languageFlag?: string;
  pagesCount?: number;
  pages?: string[];
  publishedAt?: string | null;
  streamUrl?: string | null;
}

export interface KovaAdapterSearchOptions {
  limit?: number;
  page?: number;
  genre?: string;
  year?: number;
  sort?: KovaSort;
  includeNsfw?: boolean;
  languages?: string[]; // Empty or undefined for all languages
}

export interface KovaAdapter {
  source: KovaSource;
  category: KovaCategory;
  name: string;
  search(query: string, options?: KovaAdapterSearchOptions): Promise<KovaMediaItem[]>;
  getDetails(externalId: string): Promise<KovaMediaItem | null>;
  getUnits?(externalId: string, options?: { languages?: string[]; allowAllLanguages?: boolean }): Promise<KovaUnit[]>;
  getChapterPages?(chapterId: string): Promise<string[]>;
}
