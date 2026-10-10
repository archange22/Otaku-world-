import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { CheckCircle2, LockKeyhole, ShieldAlert, UserRound } from "lucide-react";
import { firebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { canAccessAgeRestrictedContent, DEFAULT_AGE_ASSURANCE } from "@/lib/age-assurance";

export const Route = createFileRoute("/age-verification")({
  head: () => ({
    meta: [
      { title: "Protection d'âge — KOVA" },
      { name: "description", content: "Paramètres de compte et état de vérification d'âge KOVA." },
    ],
  }),
  component: AgeVerificationPage,
});

function AgeVerificationPage() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const connectGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === "auth/popup-closed-by-user"
        ? "La fenêtre Google a été fermée."
        : "Connexion Google impossible. Vérifie la configuration Firebase et réessaie.");
    } finally {
      setBusy(false);
    }
  };

  // Google OAuth alone does not establish age. No client-side value can unlock 18+.
  const ageRecord = DEFAULT_AGE_ASSURANCE;
  const adultAccess = canAccessAgeRestrictedContent(ageRecord);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <Link to="/" className="text-sm text-primary underline">← Retour à l'accueil</Link>
      <div className="mt-5 rounded-3xl border bg-card p-5 md:p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary/10 p-3"><ShieldAlert className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-extrabold md:text-3xl">Protection d'âge KOVA</h1>
            <p className="mt-2 text-sm text-muted-foreground">Les paramètres d'âge doivent protéger les utilisateurs sans collecter plus de données que nécessaire.</p>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border p-4">
          <div className="flex items-center gap-2 font-semibold">
            <UserRound className="h-5 w-5" />
            {user ? "Compte connecté" : "Connexion au compte"}
          </div>
          {user ? (
            <p className="mt-2 text-sm text-muted-foreground">Connecté en tant que {user.displayName || user.email || "utilisateur KOVA"}. Cette connexion identifie le compte, mais ne confirme pas l'âge de son titulaire.</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">Connecte-toi avec Google pour associer cette page à ton compte KOVA. Cela ne constitue pas une vérification d'âge.</p>
              <button type="button" onClick={connectGoogle} disabled={busy} className="mt-4 rounded-full border px-4 py-2 text-sm font-semibold hover:border-primary disabled:opacity-60">
                {busy ? "Connexion…" : "Continuer avec Google"}
              </button>
              {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
            </>
          )}
        </section>

        <section className="mt-4 rounded-2xl border p-4">
          <div className="flex items-center gap-2 font-semibold">
            {adultAccess ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <LockKeyhole className="h-5 w-5 text-amber-600" />}
            Statut de vérification : {adultAccess ? "Vérifié" : "Non vérifié"}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {adultAccess
              ? "La vérification a été confirmée par un fournisseur de confiance."
              : "Aucun fournisseur de vérification d'âge n'est configuré. L'accès réservé aux adultes reste bloqué par défaut."}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">Ne te fie pas à une date de naissance saisie dans le navigateur, à une case à cocher ou à une connexion Google seule. Pour activer une vérification réelle, il faut choisir un fournisseur compatible avec les lois applicables et vérifier le résultat côté serveur.</p>
        </section>

        <section className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="font-semibold">Classification du catalogue</h2>
          <p className="mt-2 text-sm text-muted-foreground">Les étiquettes +16 et +18 sont des indications de classification, pas des preuves d'âge. Les métadonnées des API peuvent être incomplètes : les éléments mal classés doivent rester masqués par défaut.</p>
        </section>
      </div>
    </main>
  );
}
