const DB_NAME = "kova-reader-offline";
const STORE = "chapters";
const MAX_BYTES = 350 * 1024 * 1024;

type SavedChapter = { id: string; pages: Blob[]; savedAt: number; bytes: number; meta?: { mangaId: string; mangaTitle: string; lang: string; chapter: string | null } };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Stockage hors ligne indisponible."));
  });
}

async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Erreur de stockage hors ligne."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error("Erreur de stockage hors ligne.")); };
  });
}

export async function getSavedChapter(id: string): Promise<SavedChapter | undefined> {
  return transaction("readonly", (store) => store.get(id));
}

export async function getSavedPageUrls(id: string): Promise<string[] | null> {
  const saved = await getSavedChapter(id);
  if (!saved) return null;
  return saved.pages.map((blob) => URL.createObjectURL(blob));
}

export async function saveChapterOffline(
  id: string,
  urls: string[],
  onProgress?: (done: number, total: number) => void,
  meta?: SavedChapter["meta"],
): Promise<void> {
  if (!urls.length) throw new Error("Aucune page disponible à télécharger.");
  const existing = await getSavedChapter(id);
  if (existing) return;
  const pages: Blob[] = [];
  let bytes = 0;
  for (let i = 0; i < urls.length; i++) {
    const response = await fetch(urls[i], { mode: "cors", credentials: "omit", cache: "force-cache" });
    if (!response.ok) throw new Error(`Image ${i + 1} indisponible (HTTP ${response.status}).`);
    const blob = await response.blob();
    if (!blob.type.startsWith("image/") || blob.size === 0) throw new Error(`L’image ${i + 1} a renvoyé un fichier invalide.`);
    bytes += blob.size;
    if (bytes > MAX_BYTES) throw new Error("Chapitre trop volumineux pour la limite hors ligne de KOVA.");
    pages.push(blob);
    onProgress?.(i + 1, urls.length);
  }
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    const available = Math.max(0, (estimate.quota ?? MAX_BYTES) - (estimate.usage ?? 0));
    if (bytes > Math.min(MAX_BYTES, available * 0.8)) {
      throw new Error("Espace de stockage insuffisant. Supprime des téléchargements ou choisis un mode plus léger.");
    }
  }
  await transaction("readwrite", (store) => store.put({ id, pages, savedAt: Date.now(), bytes, meta } satisfies SavedChapter));
}

export async function removeSavedChapter(id: string): Promise<void> {
  await transaction("readwrite", (store) => store.delete(id));
}

export async function getOfflineSummary(): Promise<{ count: number; bytes: number }> {
  const all = await transaction("readonly", (store) => store.getAll() as IDBRequest<SavedChapter[]>);
  return all.reduce((sum, item) => ({ count: sum.count + 1, bytes: sum.bytes + item.bytes }), { count: 0, bytes: 0 });
}

export async function getSavedChaptersForManga(mangaId: string): Promise<Array<{ id: string; chapter: string | null; title: string | null; lang: string; pages: number; group: string | null; publishAt: string }>> {
  const all = await transaction("readonly", (store) => store.getAll() as IDBRequest<SavedChapter[]>);
  return all.filter((item) => item.meta?.mangaId === mangaId && item.meta).map((item) => ({
    id: item.id,
    chapter: item.meta!.chapter,
    title: null,
    lang: item.meta!.lang,
    pages: item.pages.length,
    group: "Téléchargé hors ligne",
    publishAt: new Date(item.savedAt).toISOString(),
  }));
}
