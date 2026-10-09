import { getSavedChapter, getSavedChaptersForManga } from "@/lib/reader-offline";

type Rel = { id: string; type: string; attributes?: any };
type RawManga = { id: string; attributes: any; relationships: Rel[] };

export type Manga = {
  id: string;
  title: string;
  description: string;
  cover: string | null;
  coverHq: string | null;
  tags: string[];
  status: string;
  year: number | null;
  kind: "Manga" | "Manhwa" | "Manhua" | "Autre";
  author: string | null;
};

export type Chapter = {
  id: string;
  chapter: string | null;
  title: string | null;
  lang: string;
  pages: number;
  group: string | null;
  publishAt: string;
};

function qs(params: Record<string, string | number | (string | number)[] | undefined>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => s.append(`${k}[]`, String(x)));
    else s.append(k, String(v));
  }
  return s.toString();
}

// Proxy first; if it is missing (e.g. static Firebase Hosting serves HTML) or fails, call MangaDex directly.
let proxyBroken = false;
async function md<T = any>(path: string, params: Parameters<typeof qs>[0] = {}): Promise<T> {
  const query = qs(params);
  if (!proxyBroken) {
    try {
      const res = await fetch(`/api/public/md/${path}?${query}`);
      if (res.ok && (res.headers.get("content-type") ?? "").includes("json")) return (await res.json()) as T;
      proxyBroken = true;
    } catch {
      proxyBroken = true;
    }
  }
  let res: Response;
  try {
    res = await fetch(`https://api.mangadex.org/${path}?${query}`);
  } catch {
    throw new Error("MangaDex est inaccessible. Vérifie ta connexion puis réessaie.");
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`MangaDex ${res.status}${detail ? `: ${detail.slice(0, 120)}` : ""}`);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error("MangaDex a renvoyé une réponse invalide.");
  }
}

export const proxImg = (u: string) => u;

const pick = (o: any) =>
  o ? o.fr || o.en || o["ja-ro"] || Object.values(o)[0] || "" : "";

function mapManga(m: RawManga): Manga {
  const a = m.attributes;
  const cov = m.relationships.find((r) => r.type === "cover_art")?.attributes?.fileName;
  const base = cov ? `https://uploads.mangadex.org/covers/${m.id}/${cov}` : null;
  const ol = a.originalLanguage as string;
  const altFr = ((a.altTitles as any[]) ?? []).find((t) => t.fr)?.fr;
  return {
    id: m.id,
    title: altFr || pick(a.title),
    description: pick(a.description),
    cover: base ? proxImg(`${base}.512.jpg`) : null,
    coverHq: base ? proxImg(base) : null,
    tags: ((a.tags as any[]) ?? []).filter((t) => t.attributes.group === "genre").map((t) => pick(t.attributes.name)),
    status: a.status,
    year: a.year,
    kind: ol === "ja" ? "Manga" : ol === "ko" ? "Manhwa" : ol?.startsWith("zh") ? "Manhua" : "Autre",
    author: m.relationships.find((r) => r.type === "author")?.attributes?.name ?? null,
  };
}

const RATINGS = ["safe", "suggestive"];
const LANG_BY_KIND: Record<string, string[]> = { Manga: ["ja"], Manhwa: ["ko"], Manhua: ["zh", "zh-hk"] };

export type MangaQuery = { search?: string; kind?: string; tag?: string; sort?: "followedCount" | "rating" | "latestUploadedChapter" | undefined; limit?: number };

export async function searchManga(q: MangaQuery): Promise<Manga[]> {
  const sort = q.sort ?? (q.search ? undefined : "followedCount");
  const d = await md<{ data: RawManga[] }>("manga", {
    limit: q.limit ?? 24,
    title: q.search,
    "includes": ["cover_art"],
    contentRating: RATINGS,
    availableTranslatedLanguage: ["fr", "en"],
    originalLanguage: q.kind ? LANG_BY_KIND[q.kind] : undefined,
    includedTags: q.tag ? [q.tag] : undefined,
    ...(sort ? { [`order[${sort}]`]: "desc" } : { "order[relevance]": "desc" }),
  });
  return d.data.map(mapManga);
}

export async function getTags(): Promise<{ id: string; name: string }[]> {
  const d = await md<{ data: any[] }>("manga/tag");
  return d.data
    .filter((t) => t.attributes.group === "genre")
    .map((t) => ({ id: t.id, name: t.attributes.name.en }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getManga(id: string) {
  const [d, stats] = await Promise.all([
    md<{ data: RawManga }>(`manga/${id}`, { includes: ["cover_art", "author"] }),
    md<{ statistics: Record<string, { rating: { bayesian: number | null }; follows: number }> }>("statistics/manga", { manga: [id] }).catch(() => null),
  ]);
  const s = stats?.statistics[id];
  // Defense in depth: never return erotica/pornographic or unrated titles to the UI.
  const rating = d.data.attributes?.contentRating;
  if (!RATINGS.includes(rating)) throw new Error("Ce contenu est bloqué par le filtre de sécurité.");
  return { ...mapManga(d.data), score: s?.rating.bayesian ?? null, follows: s?.follows ?? null };
}

export async function getChapters(mangaId: string): Promise<Chapter[]> {
  const out: Chapter[] = [];
  try {
  for (let offset = 0; offset < 1500; offset += 500) {
    const d = await md<{ data: any[]; total: number }>(`manga/${mangaId}/feed`, {
      limit: 500,
      offset,
      translatedLanguage: ["fr", "en"],
      contentRating: RATINGS,
      includeExternalUrl: 0,
      includeEmptyPages: 0,
      includes: ["scanlation_group"],
      "order[chapter]": "asc",
    });
    for (const c of d.data) {
      const a = c.attributes;
      // Filtrage strict : uniquement les chapitres hébergés avec de vraies planches
      if (a.externalUrl || !a.pages) continue;
      out.push({
        id: c.id,
        chapter: a.chapter,
        title: a.title,
        lang: a.translatedLanguage,
        pages: a.pages,
        group: c.relationships.find((r: Rel) => r.type === "scanlation_group")?.attributes?.name ?? null,
        publishAt: a.publishAt,
      });
    }
    if (offset + 500 >= d.total) break;
  }
  return out;
  } catch (error) {
    const offline = await getSavedChaptersForManga(mangaId).catch(() => []);
    if (offline.length) return offline.sort((a, b) => Number(a.chapter ?? 0) - Number(b.chapter ?? 0));
    throw error;
  }
}

export async function getChapterInfo(id: string) {
  const saved = await getSavedChapter(id).catch(() => undefined);
  if (saved?.meta) return { mangaId: saved.meta.mangaId, mangaTitle: saved.meta.mangaTitle, lang: saved.meta.lang, chapter: saved.meta.chapter };
  const d = await md<{ data: any }>(`chapter/${id}`, { includes: ["manga"] });
  const mangaRel = d.data.relationships.find((r: Rel) => r.type === "manga");
  if (!mangaRel?.id) throw new Error("Manga introuvable.");
  // Protect direct chapter URLs too, not only navigation from the manga catalogue.
  await getManga(mangaRel.id as string);
  return {
    mangaId: mangaRel.id as string,
    mangaTitle: mangaRel.attributes ? pick(mangaRel.attributes.title) : "",
    lang: d.data.attributes.translatedLanguage as string,
    chapter: d.data.attributes.chapter as string | null,
  };
}

export async function getPages(id: string, saver: boolean): Promise<string[]> {
  const d = await md<{ baseUrl: string; chapter: { hash: string; data: string[]; dataSaver: string[] } }>(`at-home/server/${id}`);
  const files = saver ? d.chapter.dataSaver : d.chapter.data;
  return files.map((f) => `${d.baseUrl}/${saver ? "data-saver" : "data"}/${d.chapter.hash}/${f}`);
}

export const chapterLabel = (c: { chapter: string | null; title?: string | null }) =>
  c.chapter ? `Ch. ${c.chapter}${c.title ? ` — ${c.title}` : ""}` : c.title || "Oneshot";
