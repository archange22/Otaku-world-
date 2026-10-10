import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Eye, Palette, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";

export const Route = createFileRoute("/settings/")({ head: () => ({ meta: [{ title: "Paramètres — KOVA" }, { name: "description", content: "Personnalise tes préférences KOVA." }] }), component: SettingsPage });

type Preferences = { darkMode: boolean; reducedMotion: boolean; notifications: boolean; recommendations: boolean; autoplay: boolean; privateProfile: boolean };
const defaults: Preferences = { darkMode: true, reducedMotion: false, notifications: true, recommendations: true, autoplay: false, privateProfile: false };

function SettingsPage() {
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try { const raw = localStorage.getItem("kova-preferences-v1"); if (raw) setPrefs({ ...defaults, ...JSON.parse(raw) }); } catch { /* Ignore malformed local preferences. */ }
  }, []);
  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) { setPrefs((current) => ({ ...current, [key]: value })); setSaved(false); }
  function save() { try { localStorage.setItem("kova-preferences-v1", JSON.stringify(prefs)); setSaved(true); } catch { setSaved(false); } }
  const groups = [
    { title: "Apparence", description: "Adapte l'interface à ton confort.", icon: Palette, items: [{ key: "darkMode" as const, label: "Thème sombre", detail: "Conserve l'apparence sombre de KOVA." }, { key: "reducedMotion" as const, label: "Réduire les animations", detail: "Privilégie les transitions discrètes." }] },
    { title: "Lecture et visionnage", description: "Choisis le comportement des lecteurs.", icon: Eye, items: [{ key: "autoplay" as const, label: "Lecture automatique", detail: "Désactivée par défaut pour garder le contrôle." }] },
    { title: "Recommandations", description: "Contrôle la personnalisation du catalogue.", icon: Sparkles, items: [{ key: "recommendations" as const, label: "Recommandations personnalisées", detail: "Utilise les préférences disponibles pour proposer des titres." }] },
    { title: "Notifications", description: "Choisis si KOVA peut afficher des notifications.", icon: Bell, items: [{ key: "notifications" as const, label: "Notifications KOVA", detail: "Préférences locales de notification de cette interface." }] },
    { title: "Confidentialité", description: "Prépare les réglages de visibilité du profil.", icon: ShieldCheck, items: [{ key: "privateProfile" as const, label: "Préférence de profil privé", detail: "Cette préférence est enregistrée sur cet appareil. La confidentialité réelle nécessite une sauvegarde et des règles côté serveur." }] },
  ];
  return <main className="mx-auto max-w-4xl px-4 pb-12 pt-7 md:px-8"><div className="flex items-start gap-3"><div className="rounded-2xl bg-primary/10 p-3 text-primary"><SlidersHorizontal className="h-6 w-6" /></div><div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">KOVA / Mon espace</p><h1 className="mt-1 text-2xl font-extrabold md:text-4xl">Paramètres</h1><p className="mt-2 text-sm text-muted-foreground">Personnalise ton expérience. Les préférences ci-dessous sont enregistrées sur cet appareil.</p></div></div>
  <div className="mt-7 space-y-4">{groups.map((group) => <section key={group.title} className="rounded-2xl border bg-card p-4 md:p-6"><div className="mb-4 flex items-center gap-3"><group.icon className="h-5 w-5 text-primary" /><div><h2 className="font-bold">{group.title}</h2><p className="text-xs text-muted-foreground">{group.description}</p></div></div><div className="divide-y divide-white/10">{group.items.map((item) => <label key={item.key} className="flex cursor-pointer items-center justify-between gap-4 py-4"><span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.detail}</span></span><input type="checkbox" checked={prefs[item.key]} onChange={(e) => update(item.key, e.target.checked)} className="h-5 w-5 shrink-0 accent-violet-500" /></label>)}</div></section>)}</div>
  <div className="sticky bottom-20 mt-6 flex items-center justify-between gap-3 rounded-2xl border bg-background/95 p-3 backdrop-blur md:bottom-4"><p className="text-xs text-muted-foreground">{saved ? "Préférences enregistrées ✓" : "Pense à enregistrer tes changements."}</p><button type="button" onClick={save} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90">Enregistrer</button></div>
  <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Ces options d'interface ne remplacent pas les contrôles de sécurité du serveur. Les autorisations, l'âge, les rôles et les données de compte doivent être vérifiés côté serveur avant toute fonctionnalité sensible.</p></main>;
}
