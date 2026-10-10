import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";

async function ensureUserProfile(user: User) {
  const profileRef = doc(firebaseDb(), "users", user.uid);
  const snapshot = await getDoc(profileRef);

  if (!snapshot.exists()) {
    await setDoc(profileRef, {
      uid: user.uid,
      displayName: user.displayName ?? "",
      email: user.email ?? "",
      photoURL: user.photoURL ?? "",
      bannerURL: "",
      createdAt: serverTimestamp(),
    });
    return;
  }

  // Add only missing defaults; preserve existing profile data and privileged fields.
  const existing = snapshot.data() as DocumentData;
  const missingFields: Record<string, unknown> = {};
  if (typeof existing.photoURL !== "string") {
    missingFields.photoURL = user.photoURL ?? "";
  }
  if (typeof existing.bannerURL !== "string") {
    missingFields.bannerURL = "";
  }
  if (typeof existing.uid !== "string") missingFields.uid = user.uid;
  if (typeof existing.email !== "string") missingFields.email = user.email ?? "";
  if (typeof existing.displayName !== "string") {
    missingFields.displayName = user.displayName ?? "";
  }

  if (Object.keys(missingFields).length > 0) {
    await setDoc(profileRef, missingFields, { merge: true });
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth(), async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        // Creates missing profiles for new accounts and repairs missing fields
        // for accounts that already existed before this feature was added.
        await ensureUserProfile(currentUser);
      } catch (error) {
        // Keep authentication usable, but make Firestore permission/config errors visible.
        console.error("Impossible de synchroniser le profil Firestore :", error);
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, []);

  return { user, loading, logout: () => signOut(firebaseAuth()) };
}
