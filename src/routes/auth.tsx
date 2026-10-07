import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import mascot from "@/assets/kova-mascot.jpg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — KOVA" },
      { name: "description", content: "Connecte-toi ou crée ton compte KOVA pour retrouver ta bibliothèque otaku." },
      { property: "og:title", content: "Connexion — KOVA" },
      { property: "og:description", content: "Rejoins KOVA, l'Otaku-World des animes et mangas." },
    ],
  }),
  component: AuthPage,
});

const ERRORS: Record<string, string> = {
  "auth/invalid-credential": "Email ou mot de passe incorrect.",
  "auth/email-already-in-use": "Cet email est déjà utilisé.",
  "auth/weak-password": "Mot de passe trop court (6 caractères minimum).",
  "auth/invalid-email": "Email invalide.",
  "auth/popup-closed-by-user": "Fenêtre Google fermée.",
  "auth/unauthorized-domain": "Ce site n'est pas encore autorisé dans Firebase (Authentication → Settings → Authorized domains).",
};

function AuthPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => {
    const code = (e as { code?: string }).code ?? "";
    setError(ERRORS[code] ?? "Une erreur est survenue. Réessaie.");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const auth = firebaseAuth();
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
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
    try {
      await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
      navigate({ to: "/library" });
    } catch (err) {
      fail(err);
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

  return (
    <div className="mx-auto max-w-md px-4 py-10 md:py-16">
      <div className="flex flex-col items-center text-center">
        <img src={mascot} alt="Mascotte KOVA" className="h-28 w-28 rounded-full object-cover ring-2 ring-primary shadow-neon" />
        <h1 className="mt-5 text-2xl font-extrabold">{mode === "login" ? "Bon retour sur KOVA" : "Rejoins KOVA"}</h1>
      </div>
      <form onSubmit={submit} className="mt-8 space-y-3">
        {mode === "signup" && (
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pseudo" className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
        )}
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" className="w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button disabled={busy} className="bg-neon shadow-neon w-full rounded-full py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {busy ? "…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>
      <button onClick={google} className="mt-3 w-full rounded-full border bg-secondary/60 py-3 text-sm font-bold hover:border-primary">
        Continuer avec Google
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
