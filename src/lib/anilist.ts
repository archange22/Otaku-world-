export type Anime = {
  id: number;
  title: { romaji: string; english: string | null };
  coverImage: { extraLarge: string; large: string; color: string | null };
  bannerImage: string | null;
  averageScore: number | null;
  format: string | null;
  episodes: number | null;
  status: string | null;
  genres: string[];
  description: string | null;
  seasonYear: number | null;
  trailer?: { id: string; site: string } | null;
  studios?: { nodes: { name: string }[] };
  duration?: number | null;
};

const FIELDS = `id title{romaji english} coverImage{extraLarge large color} bannerImage averageScore format episodes status genres description(asHtml:false) seasonYear`;

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message ?? "AniList error");
  return json.data;
}

export type AnimeQuery = {
  search?: string;
  format?: string;
  genre?: string;
  sort?: string;
  status?: string;
  page?: number;
  perPage?: number;
};

export async function searchAnime(q: AnimeQuery): Promise<Anime[]> {
  const query = `query($page:Int,$perPage:Int,$search:String,$format:MediaFormat,$genre:String,$sort:[MediaSort],$status:MediaStatus){
    Page(page:$page,perPage:$perPage){ media(type:ANIME,isAdult:false,search:$search,format:$format,genre:$genre,sort:$sort,status:$status){ ${FIELDS} } } }`;
  const d = await gql<{ Page: { media: Anime[] } }>(query, {
    page: q.page ?? 1,
    perPage: q.perPage ?? 24,
    search: q.search || undefined,
    format: q.format || undefined,
    genre: q.genre || undefined,
    status: q.status || undefined,
    sort: [q.sort || (q.search ? "SEARCH_MATCH" : "POPULARITY_DESC")],
  });
  return d.Page.media;
}

export async function getAnime(id: number): Promise<Anime> {
  const query = `query($id:Int){ Media(id:$id,type:ANIME,isAdult:false){ ${FIELDS} duration trailer{id site} studios(isMain:true){nodes{name}} } }`;
  const d = await gql<{ Media: Anime }>(query, { id });
  return d.Media;
}

export const ANIME_GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"];

export const cleanText = (s: string | null) => (s ?? "").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();
export const animeTitle = (a: Anime) => a.title.english || a.title.romaji;
