import { useSyncExternalStore } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";

export type Fav = { kind: "manga"; id: string; title: string; cover: string | null };
export type HistoryItem = {
  mangaId: string; title: string; cover: string | null; chapterId: string;
  chapterLabel: string; page: number; total: number; at: number;
};
type Lib = {
  favs: Fav[];
  history: HistoryItem[];
  progress: Record<string, number>;
  meta: Record<string, { title: string; cover: string | null }>;
  xp: number;
  completedChapters: string[];
};
const KEY = "kova:lib";
const EMPTY: Lib = { favs: [], history: [], progress: {}, meta: {}, xp: 0, completedChapters: [] };
let raw: string | null = null;
let cache: Lib = EMPTY;
let currentUser: User | null = null;
let syncReady = false;
let writeVersion = 0;
let syncing = false;
const listeners = new Set<() => void>();

function normalize(value: unknown): Lib {
  const p = value && typeof value === "object" ? value as Partial<Lib> : {};
  return {
    favs: Array.isArray(p.favs) ? p.favs.filter((f): f is Fav => !!f && (f as Fav).kind === "manga" && typeof (f as Fav).id === "string") : [],
    history: Array.isArray(p.history) ? p.history.filter((h): h is HistoryItem => !!h && typeof (h as HistoryItem).chapterId === "string") : [],
    progress: p.progress && typeof p.progress === "object" ? p.progress : {},
    meta: p.meta && typeof p.meta === "object" ? p.meta : {},
    xp: Number.isFinite(p.xp) ? Math.max(0, Number(p.xp)) : 0,
    completedChapters: Array.isArray(p.completedChapters) ? p.completedChapters.filter((id): id is string => typeof id === "string") : [],
  };
}
function notify() { listeners.forEach((l) => l()); }
function persistLocal(next: Lib) {
  const serialized = JSON.stringify(next);
  try { localStorage.setItem(KEY, serialized); } catch { /* local cache may be unavailable */ }
  raw = serialized; cache = next; notify();
}
function read(): Lib {
  if (typeof window === "undefined") return EMPTY;
  let stored: string | null = null;
  try { stored = localStorage.getItem(KEY); } catch { return cache; }
  if (stored !== raw) {
    raw = stored;
    try { cache = normalize(stored ? JSON.parse(stored) : EMPTY); } catch { cache = EMPTY; }
  }
  return cache;
}
async function pushToCloud(user: User, data: Lib, version: number) {
  try {
    await setDoc(doc(firebaseDb(), "users", user.uid, "library", "data"), { ...data, updatedAt: Date.now() });
  } catch (error) {
    console.warn("KOVA: synchronisation Firebase impossible; données conservées localement.", error);
  } finally {
    syncing = false;
    if (version !== writeVersion && currentUser) scheduleCloudWrite(currentUser, cache);
  }
}
function scheduleCloudWrite(user: User, data: Lib) {
  if (syncing) return;
  syncing = true;
  const version = writeVersion;
  void pushToCloud(user, data, version);
}
async function hydrate(user: User) {
  syncReady = false;
  try {
    const snap = await getDoc(doc(firebaseDb(), "users", user.uid, "library", "data"));
    if (currentUser?.uid !== user.uid) return;
    const local = read();
    if (snap.exists()) {
      const cloud = normalize(snap.data());
      // Merge rather than discard local-only data from the current device.
      const merged = normalize({
        favs: [...cloud.favs, ...local.favs.filter((f) => !cloud.favs.some((c) => c.id === f.id))],
        history: [...cloud.history, ...local.history.filter((h) => !cloud.history.some((c) => c.mangaId === h.mangaId))].sort((a,b) => b.at-a.at).slice(0,60),
        progress: { ...local.progress, ...cloud.progress },
        meta: { ...local.meta, ...cloud.meta },
        xp: Math.max(cloud.xp, local.xp),
        completedChapters: [...new Set([...cloud.completedChapters, ...local.completedChapters])],
      });
      persistLocal(merged);
      syncReady = true;
      scheduleCloudWrite(user, merged);
    } else {
      syncReady = true;
      scheduleCloudWrite(user, local);
    }
  } catch (error) {
    syncReady = true;
    console.warn("KOVA: chargement Firebase impossible; utilisation du cache local.", error);
  }
}
if (typeof window !== "undefined") {
  try {
    onAuthStateChanged(firebaseAuth(), (user) => {
      currentUser = user;
      syncReady = !user;
      if (user) void hydrate(user);
    });
  } catch { /* Firebase will initialize when the browser auth hook runs */ }
}
function write(fn: (l: Lib) => Lib) {
  const next = normalize(fn(read()));
  writeVersion += 1;
  persistLocal(next);
  if (currentUser && syncReady) scheduleCloudWrite(currentUser, next);
}
export function useLibrary() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      window.addEventListener("storage", cb);
      return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
    },
    read,
    () => EMPTY,
  );
}
export const lib = {
  toggleFav(f: Fav) {
    write((l) => ({ ...l, favs: l.favs.some((x) => x.id === f.id) ? l.favs.filter((x) => x.id !== f.id) : [f, ...l.favs] }));
  },
  setMeta(mangaId: string, title: string, cover: string | null) {
    if (read().meta[mangaId]?.title === title && read().meta[mangaId]?.cover === cover) return;
    write((l) => ({ ...l, meta: { ...l.meta, [mangaId]: { title, cover } } }));
  },
  getMeta: (mangaId: string) => read().meta[mangaId],
  getProgress: (chapterId: string) => read().progress[chapterId] ?? 0,
  saveProgress(item: Omit<HistoryItem, "at">) {
    write((l) => {
      const completed = item.total > 0 && item.page >= item.total - 1;
      const newlyCompleted = completed && !l.completedChapters.includes(item.chapterId);
      return {
        ...l,
        progress: { ...l.progress, [item.chapterId]: item.page },
        history: [{ ...item, at: Date.now() }, ...l.history.filter((h) => h.mangaId !== item.mangaId)].slice(0, 60),
        xp: l.xp + (newlyCompleted ? 10 : 0),
        completedChapters: newlyCompleted ? [...l.completedChapters, item.chapterId] : l.completedChapters,
      };
    });
  },
  clearHistory() { write((l) => ({ ...l, history: [] })); },
  getXP: () => read().xp,
};
