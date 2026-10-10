import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { firebaseDb } from "@/lib/firebase";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, loading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [bannerURL, setBannerURL] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getDoc(doc(firebaseDb(), "users", user.uid)).then((snap) => {
      if (!alive || !snap.exists()) return;
      const d = snap.data();
      setDisplayName(typeof d.displayName === "string" ? d.displayName : user.displayName ?? "");
      setBio(typeof d.bio === "string" ? d.bio : "");
      setPhotoURL(typeof d.photoURL === "string" ? d.photoURL : user.photoURL ?? "");
      setBannerURL(typeof d.bannerURL === "string" ? d.bannerURL : "");
    }).catch(() => setMessage("Impossible de charger le profil. Vérifie les règles Firestore."));
    return () => { alive = false; };
  }, [user]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true); setMessage("");
    try {
      await setDoc(doc(firebaseDb(), "users", user.uid), {
        uid: user.uid,
        displayName: displayName.trim(),
        bio: bio.trim().slice(0, 240),
        photoURL: photoURL.trim(),
        bannerURL: bannerURL.trim(),
        email: user.email ?? "",
      }, { merge: true });
      setMessage("Profil enregistré.");
    } catch {
      setMessage("Enregistrement refusé. Vérifie les règles Firestore et les URL.");
    } finally { setBusy(false); }
  }

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-12 text-muted-foreground">Chargement du profil…</div>;
  if (!user) return <div className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="text-2xl font-extrabold">Connecte-toi pour gérer ton profil</h1><Link to="/auth" className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground">Connexion</Link></div>;

  return <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
    <div className="overflow-hidden rounded-3xl border bg-card">
      <div className="relative h-40 bg-gradient-to-r from-primary/50 via-purple-900 to-background md:h-56">
        {bannerURL && <img src={bannerURL} alt="Bannière du profil" className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
      </div>
      <div className="px-5 pb-6">
        <div className="-mt-12 flex items-end gap-4">
          {photoURL ? <img src={photoURL} alt="Photo de profil" className="h-24 w-24 rounded-2xl border-4 border-card bg-card object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-card bg-primary text-3xl font-black text-primary-foreground">{(displayName || user.email || "K").charAt(0).toUpperCase()}</div>}
          <div className="pb-2"><h1 className="text-2xl font-extrabold">Mon profil KOVA</h1><p className="text-sm text-muted-foreground">{user.email}</p></div>
        </div>
        <form onSubmit={save} className="mt-7 space-y-4">
          <label className="block text-sm font-semibold">Pseudo<input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={40} className="mt-2 w-full rounded-xl border bg-background px-4 py-3" placeholder="Ton pseudo" /></label>
          <label className="block text-sm font-semibold">Biographie<textarea value={bio} onChange={e=>setBio(e.target.value)} maxLength={240} rows={3} className="mt-2 w-full rounded-xl border bg-background px-4 py-3" placeholder="Présente-toi à la communauté…" /></label>
          <label className="block text-sm font-semibold">URL de la photo de profil<input type="url" value={photoURL} onChange={e=>setPhotoURL(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-4 py-3" placeholder="https://…" /></label>
          <label className="block text-sm font-semibold">URL de la bannière<input type="url" value={bannerURL} onChange={e=>setBannerURL(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-4 py-3" placeholder="https://…" /></label>
          <p className="text-xs text-muted-foreground">Cette version accepte des liens d’image. Le téléversement direct depuis le téléphone nécessitera Firebase Storage et ses règles dédiées.</p>
          {message && <p role="status" className="text-sm text-primary">{message}</p>}
          <button disabled={busy} className="w-full rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-60">{busy ? "Enregistrement…" : "Enregistrer le profil"}</button>
        </form>
      </div>
    </div>
  </div>;
}
