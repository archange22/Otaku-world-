import { firebaseAuth, firebaseDb } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import type { KovaMediaItem, KovaUnit } from '../types';

export interface KovaUserDataItem {
  mediaId: string;
  source: string;
  category: string;
  title: string;
  coverUrl: string | null;
  progressUnitId?: string;
  progressNumber?: string | number;
  updatedAt: number;
}

export class KovaFirebaseAdapter {
  private getUid(): string | null {
    return firebaseAuth().currentUser?.uid ?? null;
  }

  async saveFavorite(item: KovaMediaItem): Promise<boolean> {
    const uid = this.getUid();
    if (!uid) return false;

    const ref = doc(firebaseDb(), 'users', uid, 'favorites', item.id);
    await setDoc(ref, {
      mediaId: item.id,
      externalId: item.externalId,
      source: item.source,
      category: item.category,
      title: item.title.canonical,
      coverUrl: item.coverUrl,
      genres: item.genres,
      updatedAt: Date.now(),
    });
    return true;
  }

  async removeFavorite(mediaId: string): Promise<boolean> {
    const uid = this.getUid();
    if (!uid) return false;

    const ref = doc(firebaseDb(), 'users', uid, 'favorites', mediaId);
    await deleteDoc(ref);
    return true;
  }

  async saveProgress(item: KovaMediaItem, unit: KovaUnit): Promise<boolean> {
    const uid = this.getUid();
    if (!uid) return false;

    const ref = doc(firebaseDb(), 'users', uid, 'history', item.id);
    await setDoc(ref, {
      mediaId: item.id,
      source: item.source,
      category: item.category,
      title: item.title.canonical,
      coverUrl: item.coverUrl,
      unitId: unit.id,
      unitNumber: unit.number,
      unitTitle: unit.title,
      updatedAt: Date.now(),
    });
    return true;
  }

  async getFavorites(): Promise<KovaUserDataItem[]> {
    const uid = this.getUid();
    if (!uid) return [];

    const col = collection(firebaseDb(), 'users', uid, 'favorites');
    const q = query(col, orderBy('updatedAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as KovaUserDataItem);
  }
}

export const kovaFirebase = new KovaFirebaseAdapter();
