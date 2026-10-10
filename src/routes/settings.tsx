import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { firebaseDb } from "@/lib/firebase";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, loading } = useAuth();
  const [recommendations, setRecommendations] = useState(false);
  const [privateProfile, setPrivateProfile] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(firebaseDb(), "userSettings", user.uid)).then(s => {
      if (!s.exists()) return;
      const d = s.data();
      setRecommendations(d.recommendationsEnabled === true);
      setPrivateProfile(d.privateProfile !== false);
      setReducedMotion(d.reducedMotion === true);
    }).catch(() => setMessage("Impossible de charger les réglages. Vérifie les règles Firestore."));
  }, [user]);

  async function save() {
    if (!user) return;
    setBusy(true); setMessage("");
    try {
      await setDoc(doc(firebaseDb(), "userSettings", user.uid), {
        recommendationsEnabled: recommendations,
        privateProfile,
        reducedMotion,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setMessage("Réglages enregistrés.");
    } catch { setMessage("Enregistrement refusé. Vérifie les règles Firestore."); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="mx-auto max-w-2xl px-4 py-12">Chargement…</div>;
  if (!user) return <div className="mx-auto max-w-2xl px-4 py-12"><h1 className="text-2xl font-extrabold">Réglages KOVA</h1><p className="mt-3 text-muted-foreground">Connecte-toi pour sauvegarder tes préférences.</p></div>;

  const options = [
    { title: "Recommandations personnalisées", desc: "Désactivées par défaut. Active-les uniquement si tu souhaites personnaliser les suggestions.", value: recommendations, set: setRecommendations },
    { title: "Profil privé", desc: "Préférence de confidentialité pour ton profil. Les pages publiques doivent aussi respecter ce réglage.", value: privateProfile, set: setPrivateProfile },
    { title: "Réduire les animations", desc: "Préférence pour une interface plus légère.", value: reducedMotion, set: setReducedMotion },
  ];
  return <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
    <h1 className="text-3xl font-extrabold">Réglages <span className="text-primary">KOVA</span></h1>
    <p className="mt-2 text-muted-foreground">Tes préférences personnelles et ta confidentialité.</p>
    <div className="mt-7 space-y-3">{options.map(o=><label key={o.title} className="flex cursor-pointer items-start gap-4 rounded-2xl border bg-card p-4">
      <input type="checkbox" checked={o.value} onChange={e=>o.set(e.target.checked)} className="mt-1 h-5 w-5 accent-violet-500" />
      <span><span className="block font-bold">{o.title}</span><span className="mt-1 block text-sm text-muted-foreground">{o.desc}</span></span>
    </label>)}</div>
    <p className="mt-3 text-xs text-muted-foreground">Ces options enregistrent les préférences du compte. Les règles d'affichage doivent être appliquées dans chaque page concernée.</p>
    {message && <p role="status" className="mt-4 text-sm text-primary">{message}</p>}
    <button onClick={save} disabled={busy} className="mt-5 w-full rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-60">{busy ? "Enregistrement…" : "Enregistrer les réglages"}</button>
  </div>;
}
