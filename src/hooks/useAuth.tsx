import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";

async function ensureUserProfile(user: User) {
  const ref = doc(firebaseDb(), "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      displayName: user.displayName ?? "",
      email: user.email ?? "",
      photoURL: user.photoURL ?? "",
      bannerURL: "",
      createdAt: serverTimestamp(),
    });
    return;
  }
  const data = snap.data();
  const patch: Record<string, unknown> = {};
  if (typeof data.photoURL !== "string") patch.photoURL = user.photoURL ?? "";
  if (typeof data.bannerURL !== "string") patch.bannerURL = "";
  if (typeof data.uid !== "string") patch.uid = user.uid;
  if (typeof data.email !== "string") patch.email = user.email ?? "";
  if (typeof data.displayName !== "string") patch.displayName = user.displayName ?? "";
  if (Object.keys(patch).length) await setDoc(ref, patch, { merge: true });
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth(), async (currentUser) => {
      setUser(currentUser);
      try {
        if (currentUser) await ensureUserProfile(currentUser);
      } catch (error) {
        console.error("Échec de synchronisation du profil Firestore :", error);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);
  return { user, loading, logout: () => signOut(firebaseAuth()) };
}
