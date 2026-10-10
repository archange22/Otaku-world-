import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { updateProfile } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { firebaseDb, firebaseStorage } from "@/lib/firebase";
import { ArrowDown, ArrowUp } from "lucide-react";
import { usePrefs, setPrefs, SECTION_INFO, KID_BLOCKED } from "@/lib/prefs";
import { AdultContentBadge } from "@/components/AdultContentBadge";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Réglages — KOVA" },
      { name: "description", content: "Mode enfant, code PIN, thèmes masqués, contenu 18+ et accueil personnalisé." },
      { property: "og:title", content: "Réglages — KOVA" },
      { property: "og:description", content: "Personnalise ton expérience KOVA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-primary" : "bg-muted"}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-foreground transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

const THEMES = [...new Set(KID_BLOCKED)].sort();

function SettingsPage() {
  const p = usePrefs();
  const { user, isOwner } = useAuth();
  const [username, setUsername] = useState(user?.displayName ?? "");
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMessage, setPhotoMessage] = useState("");
  const [bannerBusy, setBannerBusy] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [theme, setTheme] = useState("");

  useEffect(() => { setUsername(user?.displayName ?? ""); }, [user?.uid, user?.displayName]);

  const saveUsername = async () => {
    if (!user) {
      setUsernameMessage("Connecte-toi pour modifier ton nom d’utilisateur.");
      return;
    }
    const nextName = username.trim().replace(/\s+/g, " ");
    if (nextName.length < 3 || nextName.length > 24) {
      setUsernameMessage("Le nom doit contenir entre 3 et 24 caractères.");
      return;
    }
    if (!/^[\p{L}\p{N}_ .-]+$/u.test(nextName)) {
      setUsernameMessage("Utilise uniquement des lettres, chiffres, espaces, points, tirets ou _.");
      return;
    }
    setUsernameBusy(true);
    setUsernameMessage("");
    try {
      await updateProfile(user, { displayName: nextName });
      await setDoc(doc(firebaseDb(), "users", user.uid), { displayName: nextName, updatedAt: serverTimestamp() }, { merge: true });
      setUsername(nextName);
      setUsernameMessage("Nom d’utilisateur mis à jour.");
    } catch {
      setUsernameMessage("Impossible d’enregistrer le changement. Vérifie ta connexion puis réessaie.");
    } finally {
      setUsernameBusy(false);
    }
  };

  const uploadBanner = async (file?: File) => {
    if (!user || !file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setBannerMessage("Choisis une image JPG, PNG, WebP ou GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBannerMessage("La bannière doit faire 5 Mo maximum.");
      return;
    }
    setBannerBusy(true);
    setBannerMessage("");
    try {
      const imageRef = ref(firebaseStorage(), `banners/${user.uid}/profile`);
      await uploadBytes(imageRef, file, { contentType: file.type });
      const url = await getDownloadURL(imageRef);
      await setDoc(doc(firebaseDb(), "users", user.uid), { bannerURL: url, updatedAt: serverTimestamp() }, { merge: true });
      setBannerUrl(url);
      setBannerMessage("Bannière enregistrée sur ton profil.");
    } catch {
      setBannerMessage("Envoi impossible. Vérifie que Firebase Storage est activé et que ses règles sont publiées.");
    } finally {
      setBannerBusy(false);
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!user || !file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoMessage("Choisis un fichier image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoMessage("L’image doit faire 5 Mo maximum.");
      return;
    }
    setPhotoBusy(true);
    setPhotoMessage("");
    try {
      const imageRef = ref(firebaseStorage(), `avatars/${user.uid}/profile`);
      await uploadBytes(imageRef, file, { contentType: file.type });
      const photoURL = await getDownloadURL(imageRef);
      await updateProfile(user, { photoURL });
      await setDoc(doc(firebaseDb(), "users", user.uid), { photoURL, updatedAt: serverTimestamp() }, { merge: true });
      setPhotoMessage("Photo de profil mise à jour.");
    } catch {
      setPhotoMessage("Envoi impossible. Vérifie les règles Firebase Storage et réessaie.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const askPin = () => !p.pin || window.prompt("Code PIN") === p.pin;

  const setKid = (v: boolean) => {
    if (!v && !askPin()) return alert("Code PIN incorrect");
    setPrefs({ kidMode: v });
  };
  // Le contenu 18+ reste bloqué sur KOVA pour les comptes adolescents.
  const setAdult = (_v: boolean) => {
    setPrefs({ adult: false });
  };
  const move = (i: number, d: number) => {
    const s = [...p.sections];
    const j = i + d;
    if (j < 1 || j >= s.length) return;
    [s[i], s[j]] = [s[j]!, s[i]!];
    setPrefs({ sections: s });
  };

  const card = "rounded-2xl border bg-card p-5";
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pt-6 md:px-8">
      <h1 className="text-2xl font-extrabold md:text-4xl">Réglages</h1>

      <section className={`${card} space-y-4`} aria-labelledby="avatar-heading">
        <div>
          <h2 id="avatar-heading" className="text-lg font-bold">Photo de profil</h2>
          <p className="text-sm text-muted-foreground">Ajoute une image pour personnaliser ton compte. JPG, PNG ou WebP, 5 Mo maximum.</p>
        </div>
        <div className="flex items-center gap-4">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Photo de profil actuelle" className="h-20 w-20 rounded-full border object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full border bg-secondary text-2xl font-bold" aria-label="Aucune photo de profil">
              {(user?.displayName?.trim().charAt(0) || user?.email?.charAt(0) || "?").toUpperCase()}
            </div>
          )}
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 py-2 font-semibold">
            {photoBusy ? "Envoi…" : "Choisir une photo"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={!user || photoBusy} onChange={(e) => { void uploadAvatar(e.target.files?.[0]); e.currentTarget.value = ""; }} />
          </label>
        </div>
        {photoMessage && <p role="status" className="text-sm text-muted-foreground">{photoMessage}</p>}
      </section>

      <section className={`${card} space-y-4`} aria-labelledby="banner-heading">
        <div>
          <h2 id="banner-heading" className="text-lg font-bold">Bannière de profil</h2>
          <p className="text-sm text-muted-foreground">Ajoute une image horizontale pour personnaliser ton profil. JPG, PNG, WebP ou GIF, 5 Mo maximum.</p>
        </div>
        <div className="overflow-hidden rounded-2xl border bg-secondary">
          {bannerUrl ? <img src={bannerUrl} alt="Aperçu de la bannière choisie" className="h-32 w-full object-cover sm:h-40" /> : <div className="flex h-28 items-center justify-center bg-gradient-to-r from-primary/25 via-secondary to-accent/20 text-sm text-muted-foreground sm:h-36">Aperçu de ta bannière</div>}
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 py-2 font-semibold">
          {bannerBusy ? "Envoi…" : "Choisir une bannière"}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" disabled={!user || bannerBusy} onChange={(e) => { void uploadBanner(e.target.files?.[0]); e.currentTarget.value = ""; }} />
        </label>
        {bannerMessage && <p role="status" className="text-sm text-muted-foreground">{bannerMessage}</p>}
        {!user && <p className="text-xs text-muted-foreground">Connecte-toi pour enregistrer ta bannière.</p>}
      </section>

      <section className={`${card} space-y-4`} aria-labelledby="username-heading">
        <div>
          <h2 id="username-heading" className="text-lg font-bold">Mon compte</h2>
          <p className="text-sm text-muted-foreground">Change le nom affiché sur ton compte KOVA.</p>
        </div>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Nom d’utilisateur</span>
          <input value={username} onChange={(e) => { setUsername(e.target.value); setUsernameMessage(""); }} maxLength={24} minLength={3} autoComplete="nickname" placeholder="Ton pseudo" className="w-full rounded-xl border bg-secondary px-3 py-3" />
        </label>
        <p className="text-xs text-muted-foreground">3 à 24 caractères. Lettres, chiffres, espaces, points, tirets et _ sont acceptés.</p>
        <button type="button" onClick={saveUsername} disabled={!user || usernameBusy || username.trim() === (user?.displayName ?? "")} className="min-h-11 rounded-xl bg-primary px-5 py-2 font-bold text-primary-foreground disabled:opacity-50">
          {usernameBusy ? "Enregistrement…" : "Enregistrer le nom"}
        </button>
        {usernameMessage && <p role="status" className="text-sm text-muted-foreground">{usernameMessage}</p>}
      </section>

      <section className={`${card} space-y-6`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Recommandations de contenu sensible</h2>
            <p className="text-sm text-muted-foreground">Désactivées par défaut et non utilisées pour les recommandations KOVA.</p>
          </div>
          <Toggle on={false} onChange={() => setPrefs({ adultRecommendations: false })} />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div><h2 className="text-lg font-bold">Mode enfant</h2><p className="text-sm text-muted-foreground">{isOwner ? "Mode enfant ignoré pour le compte Owner : les filtres ordinaires ne s’appliquent pas à cette session." : "Retire le contenu sensible interdit aux moins de 18 ans."}</p></div>
          <Toggle on={p.kidMode} onChange={setKid} />
        </div>
        <div className="flex items-start justify-between gap-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">Contenus réservés aux adultes</h2><AdultContentBadge /></div>
            <p className="text-sm text-muted-foreground">Les titres classés pour adultes sont signalés par le badge +18 et restent bloqués par défaut. Les comptes mineurs et les comptes dont l’âge n’est pas confirmé ne peuvent pas y accéder.</p>
            <p className="text-xs font-semibold text-primary">Recommandations sensibles : désactivées par défaut.</p>
            <span className="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold">{isOwner ? "Owner : filtres ordinaires ignorés, contenus sexuels 18+ toujours bloqués" : "Accès verrouillé sur KOVA"}</span>
          </div>
          <Toggle on={false} onChange={setAdult} />
        </div>
        <div>
          <h2 className="text-lg font-bold">Protection par code PIN</h2>
          <p className="text-sm text-muted-foreground">Demande un code avant de désactiver le mode enfant et protège les réglages sensibles.</p>
          <div className="mt-3 flex gap-2">
            <input value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder={p.pin ? "PIN configuré" : "Nouveau PIN (4-6 chiffres)"} className="min-w-0 flex-1 rounded-xl border bg-secondary px-3 py-2" />
            <button disabled={pinInput.length < 4} onClick={() => { if (askPin()) { setPrefs({ pin: pinInput }); setPinInput(""); } }} className="rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-40">Configurer</button>
            {p.pin && <button onClick={() => askPin() && setPrefs({ pin: null })} className="rounded-xl border px-4">Retirer</button>}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-bold">Thèmes blacklistés</h2>
          <p className="text-sm text-muted-foreground">Masque les mangas, manhwas et manhuas contenant ces thèmes.</p>
          <div className="mt-3 flex gap-2">
            <select value={theme} onChange={(e) => setTheme(e.target.value)} className="min-w-0 flex-1 rounded-xl border bg-secondary px-3 py-2">
              <option value="">Sélectionner un thème…</option>
              {THEMES.filter((t) => !p.blacklist.includes(t)).map((t) => <option key={t}>{t}</option>)}
            </select>
            <button disabled={!theme} onClick={() => { setPrefs({ blacklist: [...p.blacklist, theme] }); setTheme(""); }} className="rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-40">Ajouter</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {p.blacklist.map((t) => <button key={t} onClick={() => setPrefs({ blacklist: p.blacklist.filter((x) => x !== t) })} className="rounded-full border px-3 py-1 text-sm">{t} ✕</button>)}
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-bold">Sections de l'accueil</h2>
        <div className="mt-2 flex gap-2 text-sm">
          {(["random", "resume"] as const).map((m) => <button key={m} onClick={() => setPrefs({ heroMode: m })} className={`rounded-xl border px-3 py-2 ${p.heroMode === m ? "border-primary bg-primary/15" : ""}`}>{m === "random" ? "Mise en avant : tendance" : "Mise en avant : reprendre"}</button>)}
        </div>
        <ul className="mt-4 space-y-2">
          {p.sections.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl border bg-secondary/40 p-3">
              <div className="min-w-0 flex-1"><p className="font-semibold">{SECTION_INFO[s.id].title}</p><p className="text-xs text-muted-foreground">{SECTION_INFO[s.id].desc}</p></div>
              {i > 0 && <>
                <button onClick={() => move(i, -1)} aria-label="Monter" className="rounded-lg border p-1.5"><ArrowUp className="h-4 w-4" /></button>
                <button onClick={() => move(i, 1)} aria-label="Descendre" className="rounded-lg border p-1.5"><ArrowDown className="h-4 w-4" /></button>
              </>}
              <Toggle on={s.on} onChange={(v) => setPrefs({ sections: p.sections.map((x) => (x.id === s.id ? { ...x, on: v } : x)) })} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
