import { useSyncExternalStore } from "react";
import { firebaseAuth } from "@/lib/firebase";

const OWNER_UID = "CpFFEsdBHoYpWdQHHex8NEZOhno2";

/** Bypass des restrictions ordinaires uniquement pour la session Owner authentifiée. */
export function isOwnerSession(): boolean {
  if (typeof window === "undefined") return false;
  try { return firebaseAuth().currentUser?.uid === OWNER_UID; } catch { return false; }
}

export type SectionId =
  | "hero" | "resume" | "popManga" | "manhwa" | "manhua" | "latestManga";

export type Section = { id: SectionId; on: boolean };

export type Prefs = {
  adult: boolean;
  adultRecommendations: boolean;
  kidMode: boolean;
  pin: string | null;
  blacklist: string[];
  heroMode: "random" | "resume";
  sections: Section[];
};

export const SECTION_INFO: Record<SectionId, { title: string; desc: string }> = {
  hero: { title: "Mise en avant", desc: "Le grand bloc affiché en haut de l'accueil." },
  resume: { title: "Reprendre", desc: "Tes lectures en cours." },
  popManga: { title: "Mangas populaires", desc: "Les mangas les plus suivis." },
  manhwa: { title: "Manhwas du moment", desc: "Les webtoons coréens populaires." },
  manhua: { title: "Manhuas du moment", desc: "Les titres chinois populaires." },
  latestManga: { title: "Nouveaux chapitres", desc: "Les derniers chapitres publiés." },
};

const ALL: SectionId[] = Object.keys(SECTION_INFO) as SectionId[];

export const DEFAULT_PREFS: Prefs = {
  adult: false,
  adultRecommendations: false,
  kidMode: false,
  pin: null,
  blacklist: [],
  heroMode: "random",
  sections: ALL.map((id) => ({ id, on: true })),
};

const KEY = "kova:prefs";
let raw: string | null | undefined;
let cache: Prefs = DEFAULT_PREFS;
const listeners = new Set<() => void>();

function normalize(p: Partial<Prefs>): Prefs {
  const merged = { ...DEFAULT_PREFS, ...p };
  const known = (merged.sections ?? []).filter((s) => ALL.includes(s.id));
  const missing = ALL.filter((id) => !known.some((s) => s.id === id)).map((id) => ({ id, on: true }));
  const hero = known.find((s) => s.id === "hero") ?? { id: "hero" as const, on: true };
  return { ...merged, sections: [hero, ...[...known, ...missing].filter((s) => s.id !== "hero")] };
}

export function getPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  const r = localStorage.getItem(KEY);
  if (r !== raw) {
    raw = r;
    try { cache = normalize(r ? JSON.parse(r) : {}); } catch { cache = DEFAULT_PREFS; }
  }
  return cache;
}

export function setPrefs(patch: Partial<Prefs>) {
  const next = normalize({ ...getPrefs(), ...patch });
  localStorage.setItem(KEY, JSON.stringify(next));
  raw = JSON.stringify(next);
  cache = next;
  listeners.forEach((l) => l());
}

export function usePrefs() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      window.addEventListener("storage", cb);
      return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
    },
    getPrefs,
    () => DEFAULT_PREFS,
  );
}

export const adultAllowed = (_p: Prefs = getPrefs()) => false;
export const adultRecommendationsAllowed = (_p: Prefs = getPrefs()) => false;

export const KID_BLOCKED = ["Ecchi", "Hentai", "Gore", "Sexual Violence", "Erotica", "Horror"];

export const hiddenGenres = (p: Prefs = getPrefs()) => isOwnerSession() ? [] : [...new Set([...p.blacklist, ...(p.kidMode ? KID_BLOCKED : [])])];
export const prefsKey = (p: Prefs) => `${adultAllowed(p) ? 1 : 0}|${isOwnerSession() ? 0 : p.kidMode ? 1 : 0}|${hiddenGenres(p).join(",")}`;
export const isHidden = (genres: string[], p: Prefs = getPrefs()) => {
  if (isOwnerSession()) return false;
  const h = hiddenGenres(p).map((g) => g.toLowerCase());
  return genres.some((g) => h.includes(g.toLowerCase()));
};
