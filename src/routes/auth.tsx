import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  signOut,
  getAdditionalUserInfo,
  setPersistence,
  browserLocalPersistence,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";
import { setPrefs } from "@/lib/prefs";
import { useAuth } from "@/hooks/useAuth";
import mascot from "@/assets/kova-mascot.jpg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — KOVA" },
      { name: "description", content: "Connecte-toi ou crée ton compte KOVA et personnalise ta bibliothèque manga." },
      { property: "og:title", content: "Connexion — KOVA" },
      { property: "og:description", content: "Rejoins KOVA, ton univers manga, manhwa, manhua et comics." },
    ],
  }),
  component: AuthPage,
});

type FavoriteType = "manga" | "manhwa" | "manhua" | "comics";

const ERRORS: Record<string, string> = {
  "auth/invalid-credential": "Email ou mot de passe incorrect.",
  "auth/email-already-in-use": "Cet email est déjà utilisé.",
  "auth/weak-password": "Mot de passe trop court (6 caractères minimum).",
  "auth/invalid-email": "Email invalide.",
  "auth/popup-closed-by-user": "Fenêtre Google fermée.",
  "auth/unauthorized-domain": "Ce site n'est pas encore autorisé dans Firebase (Authentication → Settings → Authorized domains).",
  "auth/permission-denied": "KOVA n'a pas la permission d'enregistrer ton profil. Vérifie les règles Firestore.",
  "auth/internal-error": "La connexion Google a rencontré un problème de stockage du navigateur. Réessaie après avoir autorisé les cookies et le stockage du site.",
  "auth/popup-blocked": "Le navigateur a bloqué la fenêtre Google. Autorise les fenêtres pop-up pour KOVA.",
};

function getAge(dateOfBirth: string): number {
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

async function ensureUserProfile(
  user: User,
  signup?: { dateOfBirth: string; favoriteType: FavoriteType },
) {
  type ProfileDoc = Partial<Record<"uid"|"displayName"|"email"|"photoURL"|"favoriteType"|"ageBand"|"kidMode"|"adultContentEnabled"|"adultRecommendations"|"createdAt"|"dateOfBirth"|"updatedAt", unknown>>;
  const profileRef = doc(firebaseDb(), "users", user.uid);
  const snapshot = await getDoc(profileRef);
  const existing: ProfileDoc = snapshot.exists() ? (snapshot.data() as ProfileDoc) : {};
  const isNewProfile = !snapshot.exists();
  const age = signup ? getAge(signup.dateOfBirth) : undefined;
  const data: ProfileDoc = {};

  // Create a safe profile for old accounts that never had a Firestore document.
  // Unknown age defaults to the under-18 protections until the user supplies details.
  if (isNewProfile) {
    data.uid = user.uid;
    data.displayName = user.displayName ?? "";
    data.email = user.email ?? "";
    data.photoURL = user.photoURL ?? null;
    data.favoriteType = signup?.favoriteType ?? "manga";
    data.ageBand = age === undefined || age < 18 ? "under-18" : "18-plus";
    data.kidMode = age === undefined || age < 18;
    data.adultContentEnabled = false;
    data.adultRecommendations = false;
    data.createdAt = serverTimestamp();
    if (signup) data.dateOfBirth = signup.dateOfBirth;
  } else {
    // Backfill only missing fields. Existing settings and profile data are preserved.
    if (!existing.uid) data.uid = user.uid;
    if (!existing.displayName && user.displayName) data.displayName = user.displayName;
    if (!existing.email && user.email) data.email = user.email;
    if (!existing.photoURL && user.photoURL) data.photoURL = user.photoURL;
    if (!existing.favoriteType) data.favoriteType = signup?.favoriteType ?? "manga";
    if (!existing.ageBand) data.ageBand = age === undefined || age < 18 ? "under-18" : "18-plus";
    if (!("kidMode" in existing)) data.kidMode = age === undefined || age < 18;
    if (!("adultContentEnabled" in existing)) data.adultContentEnabled = false;
    if (!("adultRecommendations" in existing)) data.adultRecommendations = false;
    if (!existing.createdAt) data.createdAt = serverTimestamp();
    if (signup && !existing.dateOfBirth) {
      data.dateOfBirth = signup.dateOfBirth;
      data.ageBand = age! < 18 ? "under-18" : "18-plus";
      data.kidMode = age! < 18;
    }
  }

  data.updatedAt = serverTimestamp();
  await setDoc(profileRef, data, { merge: true });

  if (isNewProfile || signup) {
    const kidMode = age === undefined || age < 18;
    setPrefs({ kidMode, adult: false, adultRecommendations: false });
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [favoriteType, setFavoriteType] = useState<FavoriteType>("manga");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => {
    const code = (e as { code?: string }).code ?? "";
    setError(ERRORS[code] ?? "Une erreur est survenue. Réessaie.");
  };

  const validateSignupDetails = () => {
    if (!dateOfBirth) {
      setError("Indique ta date de naissance pour créer ton compte.");
      return false;
    }
    const dob = new Date(`${dateOfBirth}T00:00:00`);
    if (Number.isNaN(dob.getTime()) || dob > new Date()) {
      setError("Entre une date de naissance valide.");
      return false;
    }
    if (getAge(dateOfBirth) > 120) {
      setError("Vérifie ta date de naissance.");
      return false;
    }
    return true;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "signup" && !validateSignupDetails()) return;
    setBusy(true);
    try {
      const auth = firebaseAuth();
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
        await ensureUserProfile(cred.user, { dateOfBirth, favoriteType });
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await ensureUserProfile(cred.user);
      }
      navigate({ to: "/library" });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError("");
    if (mode === "signup" && !validateSignupDetails()) return;
    setBusy(true);
    try {
      const auth = firebaseAuth();
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const additional = getAdditionalUserInfo(result);
      if (additional?.isNewUser) {
        if (mode !== "signup") {
          await signOut(firebaseAuth());
          setError("Pour créer un compte Google, choisis d'abord « Inscris-toi » et complète les informations demandées.");
          return;
        }
        await ensureUserProfile(result.user, { dateOfBirth, favoriteType });
      } else {
        // Existing Google accounts may predate Firestore profiles; repair them on sign-in.
        await ensureUserProfile(result.user);
      }
      navigate({ to: "/library" });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
        <img src={mascot} alt="Mascotte KOVA" className="h-32 w-32 rounded-full object-cover ring-2 ring-primary" />
        <h1 className="mt-6 text-2xl font-extrabold">Salut {user.displayName || user.email} !</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tu es connecté à KOVA.</p>
        <button onClick={() => logout()} className="mt-6 rounded-full border px-6 py-2.5 text-sm font-bold hover:border-primary">
          Se déconnecter
        </button>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-md px-4 py-10 md:py-16">
      <div className="flex flex-col items-center text-center">
        <img src={mascot} alt="Mascotte KOVA" className="h-28 w-28 rounded-full object-cover ring-2 ring-primary shadow-neon" />
        <h1 className="mt-5 text-2xl font-extrabold">{mode === "login" ? "Bon retour sur KOVA" : "Rejoins KOVA"}</h1>
        {mode === "signup" && <p className="mt-2 text-sm text-muted-foreground">Configure ton profil en quelques secondes.</p>}
      </div>
      <form onSubmit={submit} className="mt-8 space-y-3">
        {mode === "signup" && (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pseudo" className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
            <label className="block space-y-1">
              <span className="text-sm font-medium">Date de naissance</span>
              <input type="date" required max={today} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
              <span className="text-xs text-muted-foreground">Elle sert à appliquer les protections adaptées à l'âge.</span>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Quel type de lecture préfères-tu ?</span>
              <select value={favoriteType} onChange={(e) => setFavoriteType(e.target.value as FavoriteType)} className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:border-primary">
                <option value="manga">Manga japonais</option>
                <option value="manhwa">Manhwa coréen</option>
                <option value="manhua">Manhua chinois</option>
                <option value="comics">Comics</option>
              </select>
            </label>
          </>
        )}
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button disabled={busy} className="bg-neon shadow-neon w-full rounded-full py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {busy ? "…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>
      <button disabled={busy} onClick={google} className="mt-3 w-full rounded-full border bg-secondary/60 py-3 text-sm font-bold hover:border-primary disabled:opacity-60">
        {busy ? "…" : "Continuer avec Google"}
      </button>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }} className="font-semibold text-primary">
          {mode === "login" ? "Inscris-toi" : "Connecte-toi"}
        </button>
      </p>
    </div>
  );
}
