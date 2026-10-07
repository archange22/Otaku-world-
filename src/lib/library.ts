import { useSyncExternalStore } from "react";

export type Fav = { kind: "anime" | "manga"; id: string; title: string; cover: string | null };
export type HistoryItem = {
  mangaId: string;
  title: string;
  cover: string | null;
  chapterId: string;
  chapterLabel: string;
  page: number;
  total: number;
  at: number;
};

const KEY = "kova:lib";
type Lib = { favs: Fav[]; history: HistoryItem[]; progress: Record<string, number>; meta: Record<string, { title: string; cover: string | null }> };
const EMPTY: Lib = { favs: [], history: [], progress: {}, meta: {} };

let raw: string | null = null;
let cache: Lib = EMPTY;
const listeners = new Set<() => void>();

function read(): Lib {
  const r = localStorage.getItem(KEY);
  if (r !== raw) {
    raw = r;
    try {
      cache = r ? { ...EMPTY, ...JSON.parse(r) } : EMPTY;
    } catch {
      cache = EMPTY;
    }
  }
  return cache;
}
function write(fn: (l: Lib) => Lib) {
  const next = fn(read());
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function useLibrary() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    read,
    () => EMPTY,
  );
}

export const lib = {
  toggleFav(f: Fav) {
    write((l) => ({
      ...l,
      favs: l.favs.some((x) => x.id === f.id && x.kind === f.kind)
        ? l.favs.filter((x) => !(x.id === f.id && x.kind === f.kind))
        : [f, ...l.favs],
    }));
  },
  setMeta(mangaId: string, title: string, cover: string | null) {
    if (read().meta[mangaId]?.title === title) return;
    write((l) => ({ ...l, meta: { ...l.meta, [mangaId]: { title, cover } } }));
  },
  getMeta: (mangaId: string) => read().meta[mangaId],
  getProgress: (chapterId: string) => read().progress[chapterId] ?? 0,
  saveProgress(item: Omit<HistoryItem, "at">) {
    write((l) => ({
      ...l,
      progress: { ...l.progress, [item.chapterId]: item.page },
      history: [{ ...item, at: Date.now() }, ...l.history.filter((h) => h.mangaId !== item.mangaId)].slice(0, 60),
    }));
  },
  clearHistory() {
    write((l) => ({ ...l, history: [] }));
  },
};
