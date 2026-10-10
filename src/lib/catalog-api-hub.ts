/**
 * Otaku-world API Hub
 * Metadata/discovery only. It does not source or embed unauthorized streams.
 * Existing clients: AniList (src/lib/anilist.ts), MangaDex (src/lib/mangadex.ts).
 * Additional public metadata providers: Jikan and Kitsu.
 */

export type CatalogKind = "anime" | "manga";
export type CatalogProvider = "jikan" | "kitsu" | "shikimori";

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
  };
};

type ShikimoriTitle = {
  id: number;
  name?: string;
  russian?: string | null;
  english?: string | null;
  japanese?: string | null;
  url?: string;
  image?: { original?: string; preview?: string };
  score?: string | number | null;
  aired_on?: string | null;
  released_on?: string | null;
  status?: string | null;
  description?: string | null;
  genres?: Array<{ name?: string; russian?: string }>;
};

const JIKAN = "https://api.jikan.moe/v4";
const KITSU = "https://kitsu.io/api/edge";
const SHIKIMORI = "https://shikimori.one/api";
const TIMEOUT_MS = 9000;

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
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
    year: item.year ?? (item.published?.from ? Number(item.published.from.slice(0, 4)) || null : null),
    status: item.status || null,
    genres: (item.genres || []).map((genre) => genre.name),
  };
}

function toKitsu(item: KitsuTitle, kind: CatalogKind): ExternalTitle {
  const a = item.attributes || {};
  const rating = a.averageRating ? Number(a.averageRating) / 10 : NaN;
  return {
    id: item.id,
    provider: "kitsu",
    kind,
    title: a.canonicalTitle || a.titles?.en || a.titles?.en_jp || a.titles?.ja_jp || "Untitled",
    synopsis: a.synopsis || null,
    cover: a.posterImage?.large || a.posterImage?.medium || null,
    url: `https://kitsu.io/${kind === "anime" ? "anime" : "manga"}/${item.id}`,
    score: Number.isFinite(rating) ? Math.round(rating * 100) / 100 : null,
    year: a.startDate ? Number(a.startDate.slice(0, 4)) || null : null,
    status: a.status || null,
    genres: [],
  };
}

function toShikimori(item: ShikimoriTitle, kind: CatalogKind): ExternalTitle {
  const date = item.aired_on || item.released_on;
  const score = item.score == null ? NaN : Number(item.score);
  return {
    id: String(item.id),
    provider: "shikimori",
    kind,
    title: item.russian || item.name || item.english || item.japanese || "Untitled",
    synopsis: item.description || null,
    cover: item.image?.original
      ? `https://shikimori.one${item.image.original}`
      : item.image?.preview
        ? `https://shikimori.one${item.image.preview}`
        : null,
    url: item.url ? (item.url.startsWith("http") ? item.url : `https://shikimori.one${item.url}`) : null,
    score: Number.isFinite(score) ? score : null,
    year: date ? Number(date.slice(0, 4)) || null : null,
    status: item.status || null,
    genres: (item.genres || []).map((genre) => genre.russian || genre.name || "").filter(Boolean),
  };
}

/** Search Jikan, a public MyAnimeList metadata API, for anime or manga. */
export async function searchJikan(
  kind: CatalogKind,
  query: string,
  limit = 12,
): Promise<ExternalTitle[]> {
  if (!query.trim()) return [];
  const endpoint = kind === "anime" ? "anime" : "manga";
  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(Math.min(25, Math.max(1, limit))),
  });
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

/** Search Shikimori's public catalogue for anime or manga metadata. */
export async function searchShikimori(
  kind: CatalogKind,
  query: string,
  limit = 12,
): Promise<ExternalTitle[]> {
  if (!query.trim()) return [];
  const resource = kind === "anime" ? "animes" : "mangas";
  const params = new URLSearchParams({
    search: query.trim(),
    limit: String(Math.min(25, Math.max(1, limit))),
  });
  const data = await getJson<ShikimoriTitle[]>(
    `${SHIKIMORI}/${resource}?${params.toString()}`,
    { "User-Agent": "Otaku-world/1.0 (catalog metadata integration)" },
  );
  return (data || []).map((item) => toShikimori(item, kind));
}

/** Query metadata providers in parallel. A single provider outage is isolated. */
export async function searchExternalCatalog(
  kind: CatalogKind,
  query: string,
  limitPerProvider = 12,
): Promise<{ results: ExternalTitle[]; providerErrors: CatalogProvider[] }> {
  const providers: Array<[CatalogProvider, () => Promise<ExternalTitle[]>]> = [
    ["jikan", () => searchJikan(kind, query, limitPerProvider)],
    ["kitsu", () => searchKitsu(kind, query, limitPerProvider)],
    ["shikimori", () => searchShikimori(kind, query, limitPerProvider)],
  ];
  const settled = await Promise.allSettled(providers.map(([, run]) => run()));
  const results: ExternalTitle[] = [];
  const providerErrors: CatalogProvider[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") results.push(...result.value);
    else providerErrors.push(providers[index][0]);
  });

  const seen = new Set<string>();
  const unique = results.filter((item) => {
    const key = `${item.provider}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { results: unique, providerErrors };
}
