# Protection d'âge KOVA

## État actuel

- La connexion Google/Firebase identifie un compte, mais ne vérifie pas à elle seule que son titulaire a 18 ans.
- Le module `src/lib/age-assurance.ts` utilise une politique « fail closed » : l'accès réservé aux adultes est refusé sans statut confirmé.
- La page `/age-verification` explique le statut et permet la connexion Google, sans prétendre effectuer une vérification d'âge.
- Aucun catalogue adulte ni aperçu adulte n'est chargé par cette page.

## Avant toute mise en production

1. Choisir un fournisseur de vérification d'âge approprié aux lois applicables et minimisant les données collectées.
2. Vérifier son résultat côté serveur, par exemple via une fonction backend Firebase avec vérification de l'identité Firebase et contrôle des permissions.
3. Stocker uniquement le statut minimal, la date et l'identifiant du fournisseur, jamais une pièce d'identité ou des données biométriques dans le profil KOVA.
4. Protéger aussi les endpoints, les règles Firebase, les aperçus, les recommandations et les liens directs. Masquer seulement l'interface ne suffit pas.
5. Ajouter des tests pour les états absent, invalide, mineur, expiré et adulte vérifié.
6. Vérifier le routage généré, le lint, les tests et le build avant fusion ou déploiement.

## Limite importante

Ce dépôt ne contient pas encore de fournisseur d'assurance d'âge ni de vérification serveur. Le type de statut dans le code est un contrat applicatif, pas une preuve de vérification. L'accès doit rester bloqué jusqu'à l'intégration backend réelle.
