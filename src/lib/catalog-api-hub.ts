/**
 * Otaku-world API Hub
 * Metadata and discovery integrations only. This module does not fetch or embed
 * unauthorized video streams. Existing AniList and MangaDex clients remain the
 * primary integrations; Jikan and Kitsu are additional fallback sources.
 */

export type CatalogKind = "anime" | "manga";
export type CatalogProvider = "jikan" | "kitsu";

export type ExternalTitle = {
  id: string;
  provider: CatalogProvider;
  kind: CatalogKind;
  title: string;
  synopsis: string | null;
  cover: string | null;
  url: string | null;
  score: number | null;
  year: number | null;
  status: string | null;
  genres: string[];
};

type JikanTitle = {
  mal_id: number;
  title?: string;
  title_english?: string | null;
  synopsis?: string | null;
  url?: string;
  images?: { jpg?: { large_image_url?: string; image_url?: string } };
  score?: number | null;
  year?: number | null;
  status?: string | null;
  genres?: Array<{ name: string }>;
  published?: { from?: string | null };
};

type KitsuTitle = {
  id: string;
  attributes?: {
    canonicalTitle?: string;
    titles?: Record<string, string>;
    synopsis?: string | null;
    posterImage?: { large?: string; medium?: string } | null;
    averageRating?: string | null;
    startDate?: string | null;
    status?: string | null;
    subtype?: string | null;
  };
  relationships?: {
    genres?: { links?: { related?: string } };
  };
};

const JIKAN = "https://api.jikan.moe/v4";
const KITSU = "https://kitsu.io/api/edge";
const TIMEOUT_MS = 9000;

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`API request failed (${response.status})`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function toJikan(item: JikanTitle, kind: CatalogKind): ExternalTitle {
  return {
    id: String(item.mal_id),
    provider: "jikan",
    kind,
    title: item.title_english || item.title || "Untitled",
    synopsis: item.synopsis || null,
    cover: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || null,
    url: item.url || null,
    score: typeof item.score === "number" ? item.score : null,
    year: item.year ?? (item.published?.from ? Number(item.published.from.slice(0, 4)) : null),
    status: item.status || null,
    genres: (item.genres || []).map((genre) => genre.name),
  };
}

function toKitsu(item: KitsuTitle, kind: CatalogKind): ExternalTitle {
  const a = item.attributes || {};
  const score = a.averageRating ? Number(a.averageRating) / 10 : NaN;
  return {
    id: item.id,
    provider: "kitsu",
    kind,
    title: a.canonicalTitle || a.titles?.en || a.titles?.en_jp || a.titles?.ja_jp || "Untitled",
    synopsis: a.synopsis || null,
    cover: a.posterImage?.large || a.posterImage?.medium || null,
    url: `https://kitsu.io/${kind === "anime" ? "anime" : "manga"}/${item.id}`,
    score: Number.isFinite(score) ? Math.round(score * 100) / 100 : null,
    year: a.startDate ? Number(a.startDate.slice(0, 4)) || null : null,
    status: a.status || null,
    genres: [],
  };
}

function encodeQuery(value: string): string {
  return new URLSearchParams({ q: value.trim() }).toString();
}

/** Search Jikan (MyAnimeList metadata API) for anime or manga. */
export async function searchJikan(
  kind: CatalogKind,
  query: string,
  limit = 12,
): Promise<ExternalTitle[]> {
  if (!query.trim()) return [];
  const endpoint = kind === "anime" ? "anime" : "manga";
  const params = new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(encodeQuery(query))), limit: String(Math.min(25, Math.max(1, limit))) });
  const result = await getJson<{ data?: JikanTitle[] }>(`${JIKAN}/${endpoint}?${params.toString()}`);
  return (result.data || []).map((item) => toJikan(item, kind));
}

/** Search Kitsu's public JSON:API for anime or manga metadata. */
export async function searchKitsu(
  kind: CatalogKind,
  query: string,
  limit = 12,
): Promise<ExternalTitle[]> {
  if (!query.trim()) return [];
  const resource = kind === "anime" ? "anime" : "manga";
  const params = new URLSearchParams({
    "filter[text]": query.trim(),
    "page[limit]": String(Math.min(20, Math.max(1, limit))),
  });
  const result = await getJson<{ data?: KitsuTitle[] }>(`${KITSU}/${resource}?${params.toString()}`);
  return (result.data || []).map((item) => toKitsu(item, kind));
}

/**
 * Query metadata providers in parallel. A provider outage won't break the
 * whole search. Provider + ID are retained so callers can deduplicate safely.
 */
export async function searchExternalCatalog(
  kind: CatalogKind,
  query: string,
  limitPerProvider = 12,
): Promise<{ results: ExternalTitle[]; providerErrors: CatalogProvider[] }> {
  const providers: Array<[CatalogProvider, () => Promise<ExternalTitle[]>]> = [
    ["jikan", () => searchJikan(kind, query, limitPerProvider)],
    ["kitsu", () => searchKitsu(kind, query, limitPerProvider)],
  ];
  const settled = await Promise.allSettled(providers.map(([, run]) => run()));
  const results: ExternalTitle[] = [];
  const providerErrors: CatalogProvider[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") results.push(...result.value);
    else providerErrors.push(providers[index][0]);
  });

  // Keep similarly named records from separate sources unless they clearly
  // match; IDs are provider-specific and should never be merged by ID alone.
  const seen = new Set<string>();
  const unique = results.filter((item) => {
    const key = `${item.provider}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { results: unique, providerErrors };
}
