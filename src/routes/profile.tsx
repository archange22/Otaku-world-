import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useAuth } from "@/hooks/useAuth";
import { firebaseDb, firebaseStorage } from "@/lib/firebase";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user, loading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [bannerURL, setBannerURL] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"photo" | "banner" | null>(null);
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

  async function uploadImage(e: ChangeEvent<HTMLInputElement>, kind: "photo" | "banner") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { setMessage("Choisis un fichier image."); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage("Image trop lourde : maximum 5 Mo."); return; }
    setUploading(kind); setMessage("");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
      const path = `user-uploads/${user.uid}/${kind}-${Date.now()}-${safeName}`;
      const storageRef = ref(firebaseStorage(), path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      await setDoc(doc(firebaseDb(), "users", user.uid), {
        uid: user.uid,
        [kind === "photo" ? "photoURL" : "bannerURL"]: url,
      }, { merge: true });
      if (kind === "photo") setPhotoURL(url); else setBannerURL(url);
      setMessage(kind === "photo" ? "Photo mise à jour." : "Bannière mise à jour.");
    } catch (error) {
      console.error("Upload image profil impossible", error);
      setMessage("Téléversement refusé. Vérifie que Firebase Storage est activé et que ses règles autorisent ton compte.");
    } finally { setUploading(null); }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true); setMessage("");
    try {
      await setDoc(doc(firebaseDb(), "users", user.uid), {
        uid: user.uid,
        displayName: displayName.trim().slice(0, 40),
        bio: bio.trim().slice(0, 240),
        photoURL: photoURL.trim(),
        bannerURL: bannerURL.trim(),
        email: user.email ?? "",
      }, { merge: true });
      setMessage("Profil enregistré.");
    } catch {
      setMessage("Enregistrement refusé. Vérifie les règles Firestore.");
    } finally { setBusy(false); }
  }

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-12 text-muted-foreground">Chargement du profil…</div>;
  if (!user) return <div className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="text-2xl font-extrabold">Connecte-toi pour gérer ton profil</h1><Link to="/auth" className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground">Connexion</Link></div>;

  return <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
    <div className="overflow-hidden rounded-3xl border bg-card">
      <div className="relative h-40 bg-gradient-to-r from-primary/50 via-purple-900 to-background md:h-56">
        {bannerURL && <img src={bannerURL} alt="Bannière du profil" className="h-full w-full object-cover" />}
      </div>
      <div className="px-5 pb-6">
        <div className="-mt-12 flex items-end gap-4">
          {photoURL ? <img src={photoURL} alt="Photo de profil" className="h-24 w-24 rounded-2xl border-4 border-card bg-card object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-card bg-primary text-3xl font-black text-primary-foreground">{(displayName || user.email || "K").charAt(0).toUpperCase()}</div>}
          <div className="pb-2"><h1 className="text-2xl font-extrabold">Mon profil KOVA</h1><p className="text-sm text-muted-foreground">{user.email}</p></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="cursor-pointer rounded-xl border p-3 text-sm font-semibold hover:border-primary">Changer la photo {uploading === "photo" ? "…" : ""}<input type="file" accept="image/*" disabled={!!uploading} onChange={e => uploadImage(e, "photo")} className="mt-2 block w-full text-xs" /></label>
          <label className="cursor-pointer rounded-xl border p-3 text-sm font-semibold hover:border-primary">Changer la bannière {uploading === "banner" ? "…" : ""}<input type="file" accept="image/*" disabled={!!uploading} onChange={e => uploadImage(e, "banner")} className="mt-2 block w-full text-xs" /></label>
        </div>
        <form onSubmit={save} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold">Pseudo<input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={40} className="mt-2 w-full rounded-xl border bg-background px-4 py-3" placeholder="Ton pseudo" /></label>
          <label className="block text-sm font-semibold">Biographie<textarea value={bio} onChange={e=>setBio(e.target.value)} maxLength={240} rows={3} className="mt-2 w-full rounded-xl border bg-background px-4 py-3" placeholder="Présente-toi à la communauté…" /></label>
          <label className="block text-sm font-semibold">URL de photo (optionnel)<input type="url" value={photoURL} onChange={e=>setPhotoURL(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-4 py-3" placeholder="https://…" /></label>
          <label className="block text-sm font-semibold">URL de bannière (optionnel)<input type="url" value={bannerURL} onChange={e=>setBannerURL(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-4 py-3" placeholder="https://…" /></label>
          <p className="text-xs text-muted-foreground">Images limitées à 5 Mo. Les règles Firebase Storage doivent être publiées pour activer les téléversements.</p>
          {message && <p role="status" className="text-sm text-primary">{message}</p>}
          <button disabled={busy || !!uploading} className="w-full rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-60">{busy ? "Enregistrement…" : "Enregistrer le profil"}</button>
        </form>
      </div>
    </div>
  </div>;
}
