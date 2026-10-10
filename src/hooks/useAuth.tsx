import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { firebaseAuth, firebaseDb } from "@/lib/firebase";

async function ensureFirestoreProfile(user: import("firebase/auth").User) {
  const profileRef = doc(firebaseDb(), "users", user.uid);
  const snapshot = await getDoc(profileRef);
  const existing = snapshot.exists() ? snapshot.data() : {};
  const updates: Record<string, unknown> = {};

  // Unknown age is handled conservatively until the profile contains verified details.
  if (!snapshot.exists()) {
    Object.assign(updates, {
      uid: user.uid,
      displayName: user.displayName ?? "",
      email: user.email ?? "",
      photoURL: user.photoURL ?? null,
      favoriteType: "manga",
      ageBand: "under-18",
      kidMode: true,
      adultContentEnabled: false,
      adultRecommendations: false,
      createdAt: serverTimestamp(),
    });
  } else {
    // Fill missing profile fields without overwriting a user's existing preferences.
    if (!("uid" in existing)) updates.uid = user.uid;
    if (!("displayName" in existing) && user.displayName) updates.displayName = user.displayName;
    if (!("email" in existing) && user.email) updates.email = user.email;
    if (!("photoURL" in existing) && user.photoURL) updates.photoURL = user.photoURL;
    if (!("favoriteType" in existing)) updates.favoriteType = "manga";
    if (!("ageBand" in existing)) updates.ageBand = "under-18";
    if (!("kidMode" in existing)) updates.kidMode = true;
    if (!("adultContentEnabled" in existing)) updates.adultContentEnabled = false;
    if (!("adultRecommendations" in existing)) updates.adultRecommendations = false;
    if (!("createdAt" in existing)) updates.createdAt = serverTimestamp();
  }

  updates.updatedAt = serverTimestamp();
  await setDoc(profileRef, updates, { merge: true });
}

export function useAuth() {
  const [user, setUser] = useState<import("firebase/auth").User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth(), async (u) => {
      setUser(u);
      setIsOwner(false);

      if (u) {
        try {
          // Ensure every signed-in account has a Firestore profile, even if it
          // entered through a different page or was created before this feature.
          await ensureFirestoreProfile(u);
        } catch (error) {
          // Keep authentication usable if Firestore is temporarily unavailable.
          console.error("Unable to ensure KOVA Firestore profile:", error);
        }

        try {
          const token = await u.getIdTokenResult();
          setIsOwner(u.uid === "CpFFEsdBHoYpWdQHHex8NEZOhno2" || token.claims["owner"] === true);
        } catch {
          setIsOwner(false);
        }
      }

      setLoading(false);
    });
  }, []);

  return { user, loading, isOwner, logout: () => signOut(firebaseAuth()) };
}
