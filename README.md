# Octalume

Application de bureau pour explorer ses ralentis Rocket League et demander un rapport de coaching.

**Tauri v2 · Rust · React · TypeScript · Tailwind CSS**

## Installer Windows — démarrage rapide

Pour installer Octalume sans environnement de développement :

1. Ouvre l'onglet [Releases](https://github.com/Altorru/octalume/releases) et télécharge le fichier `.msi` (recommandé) ou `.exe`.
2. Lance l'installateur. Windows peut afficher un avertissement SmartScreen : vérifie que l'éditeur est bien le dépôt `Altorru/octalume`.
3. Ouvre Octalume, indique ton dossier `Demos`, puis sélectionne ton pseudo dans **Réglages**.
4. Pour une analyse IA, choisis ton fournisseur, colle ta propre clé API et récupère son catalogue de modèles. La clé reste en mémoire pendant la session.

Une release est publiée automatiquement quand un tag `vX.Y.Z` est poussé. Chaque push sur `main` produit aussi un artefact téléchargeable dans l'onglet **Actions**. Les premiers installateurs ne sont pas signés ; une signature code-signing sera nécessaire avant une distribution large.

## Fonctionnement

1. Octalume lit le dossier de ralentis au lancement.
2. « Rafraîchir la liste » relance cette lecture à la demande.
3. « Détails » ouvre un écran de match dédié : score, carte, durée et statistiques des joueurs.
4. L'utilisateur confirme son joueur, puis déclenche le coaching depuis cet écran. Le rapport s'affiche dans la vue « Coaching IA ».

La bibliothèque propose une recherche par fichier, carte ou joueur et des filtres pour isoler les fichiers disponibles ou illisibles. La recherche et le filtre sont conservés lors du retour d'un match. Le pseudo, le dossier et le fournisseur IA se configurent dans « Réglages ». Sans clé en mode réel, le match propose un accès direct à ces réglages, avec un retour au match.

Aucun watcher, polling périodique, service résident ou lancement automatique avec Windows n'est installé. Les watchers des outils de développement surveillent uniquement le code source.

## Statut du starter

- Détection du dossier Documents du système, y compris sa redirection vers OneDrive.
- Dossier personnalisable et mémorisé après un scan réussi.
- Scan non récursif des fichiers `.replay`, triés par modification décroissante.
- Dates et tailles réelles du disque. La date affichée est celle du fichier, pas celle du match.
- Parsing réel boxcars : nom, carte, date, score, effectif enregistré et statistiques des joueurs.
- Contrôle CRC et limite de lecture de 128 Mio par fichier. Un replay illisible reste visible avec son erreur ; il ne bloque pas les autres.
- Profil joueur par pseudo : correspondance unique normalisée, sinon sélection explicite. L'auteur du replay est seulement une suggestion à confirmer. Bots exclus du coaching, doublons distingués par leur index et leur équipe.
- Vue personnelle : score, buts, passes, arrêts et tirs du joueur choisi ; ligne surlignée dans le tableau.
- Mode local de démonstration : délai de deux secondes, conseils fictifs, sans clé ni réseau.
- Pipeline hybride : décodage réseau Rust, métriques déterministes, séquences horodatées, puis coaching BYOK OpenAI, Gemini ou Claude après consentement.
- Les métriques numériques viennent du parseur, jamais du modèle. La note est une appréciation subjective du coach, autorisée uniquement si la couverture est suffisante.
- Seuls les fichiers du dernier scan réussi peuvent être sélectionnés pour l'analyse.
- Extraction locale à la demande : 15 métriques de vitesse, boost répliqué et placement relatif ; chronologie de tout l'enregistrement et séquences plus denses autour des buts et compteurs réseau. Aucun watcher.
- Les signaux géométriques de rotation/espacement sont des situations à examiner, pas des fautes tactiques certifiées. Boost continu, touches et pickups précis restent à valider.

Le format « 3v3 observé » correspond aux effectifs présents dans `PlayerStats`, pas à une playlist certifiée. `TeamSize` peut désigner la capacité du lobby ; les départs et remplacements peuvent aussi modifier les effectifs enregistrés. « Online » ne prouve pas qu'un match est classé.

Les durées calculées avec `NumFrames / RecordFPS` sont affichées comme des estimations de l'enregistrement, pas comme des durées certifiées de match. Les champs manquants restent inconnus.

## Approche « EAC Safe »

Cette expression décrit notre conception passive. Elle ne constitue pas une certification Easy Anti-Cheat ni une garantie d'absence de sanction.

Octalume travaille sur des fichiers `.replay` déjà enregistrés : aucune injection, lecture ou modification de mémoire, aucun hook, aucune interaction avec le processus du jeu et aucune modification des replays.

Le projet est indépendant de Psyonix, Epic Games et Easy Anti-Cheat. Les règles des éditeurs concernés restent applicables.

## Coaching BYOK : ta clé, ton fournisseur

Ce dépôt contient le client desktop et ses adaptateurs IA. Il n'y a pas de serveur Octalume propriétaire ni de clé fournisseur embarquée. Dans Réglages : choisir le fournisseur, saisir sa clé puis cliquer sur **Enregistrer et récupérer les modèles**, sélectionner un modèle du catalogue et cliquer sur **Enregistrer le modèle**. Aucun identifiant de modèle n'est imposé ni saisi à la main. La consultation du catalogue ne génère aucun coaching et n'envoie aucune donnée de replay.

Fournisseurs implémentés : OpenAI Responses API, Google Gemini `generateContent` et Anthropic Messages API. Les appels de coaching utilisent leurs domaines officiels fixes, HTTPS, un délai de 120 secondes, des sorties JSON structurées (8 192 tokens maximum) et une limite de réponse de 256 Kio. Les redirections sont refusées et aucun retry applicatif automatique n'est effectué. Les autres fournisseurs ne sont pas encore implémentés ; ajouter un adaptateur exige son contrat et ses tests.

Avant chaque analyse réelle, l'écran demande l'accord pour envoyer les métriques déterministes, la chronologie, les positions/vitesses et le boost des joueurs pseudonymisés au fournisseur choisi. Seul le joueur confirmé est coaché ; les autres joueurs servent au contexte tactique. Changer de joueur, de fournisseur ou de modèle rend cet accord invalide. Aucun fichier `.replay`, pseudo, identifiant de compte, carte libre, date ou chemin local n'est transmis. Le volume de données peut augmenter le coût de l'appel.

Une analyse réelle peut consommer le quota ou les crédits du compte API. Un abonnement à une application de chat ne prouve pas un accès API. Les conditions et règles de conservation du fournisseur s'appliquent. OpenAI reçoit `store: false`, ce qui ne constitue pas une garantie générale de non-conservation. Les appels facturés ne sont pas exécutés en CI.

Les mistakes doivent citer une séquence locale existante ; Rust fournit ses timestamps et observations, refuse les références inexistantes et conserve les métriques calculées indépendamment de l'IA. Le rapport explique observation, impact, correction, exercice et confiance. La note subjective /100 n'est ni un rang ni un percentile calibré. Les anciens formats réseau non validés et les échecs de parsing ne déclenchent aucun fallback sur les seuls compteurs. Voir [le contrat et les limites BYOK](docs/byok.md) et [la méthode gameplay](docs/gameplay-methodology.md).

## Confidentialité

Les replays peuvent contenir des pseudonymes et identifiants de joueurs. Ne les publiez pas dans ce dépôt.

Les clés sont conservées **uniquement en mémoire pour la session**, séparées par fournisseur. « Oublier la clé » retire celle du fournisseur courant. Elles ne sont pas enregistrées dans localStorage, dans les fichiers ou dans les logs de l'application. L'ancien champ `octalume.apiKey` du prototype est supprimé au démarrage, sans être relu ni transmis. Les clés devront être ressaisies après fermeture complète. Cela ne remplace pas la sécurité du système hôte.

Seuls le dossier, le pseudo, le choix du fournisseur et le modèle confirmé par fournisseur sont persistés. Après redémarrage, il faut ressaisir sa clé, récupérer le catalogue et confirmer de nouveau le modèle ; un ancien modèle absent de la liste n'est pas réutilisé. Le pseudo est une aide au ciblage, pas une identité Steam/Epic vérifiée. Le nom et l'équipe du joueur sont revérifiés dans le replay au moment de l'analyse ; aucun fallback sur le premier joueur n'est permis.

## Développement

Prérequis : Node.js 22.12+ (24 recommandé en CI), npm et Rust stable.

Sur Windows : toolchain MSVC, Visual Studio Build Tools avec **Desktop development with C++** et Windows SDK, WebView2 Runtime. La génération MSI peut aussi nécessiter la fonctionnalité Windows VBScript.

Sur macOS : Xcode Command Line Tools. Renseignez un dossier local de replays pour tester ; les installateurs Windows sont produits en CI.

```bash
npm ci
npm run tauri dev
```

Dossier Windows habituel :

```text
%USERPROFILE%\Documents\My Games\Rocket League\TAGame\Demos
```

`npm run dev` ouvre uniquement la prévisualisation web : l'accès disque nécessite l'application Tauri.

## Vérifications

```bash
npm run check
npm run test:player
npm run build
npm run format:check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --locked -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

Les tests Rust vérifient le filtrage, le tri, les dossiers invalides, les limites de taille, les CRC et le rejet des fichiers non sélectionnés, vides, supprimés ou liés symboliquement (test des liens sur Unix).

## Tester avec des replays réels sur Mac

```bash
npm run fixtures:download
npm run test:replays
npm run tauri dev
```

Dans l'application, renseignez le chemin absolu vers `.local-tests/replays`, rafraîchissez, puis ouvrez « Détails ». Sélectionnez explicitement un joueur de la fixture. Le fournisseur « Démonstration locale » permet de tester le rapport sans clé ni appel externe.

Le script télécharge trois replays publics du [dépôt officiel boxcars](https://github.com/nickbabcock/boxcars/tree/9f31dfa120b37e5a8a649942170b3a2ca8235ff1/assets/replays/good). La révision, les tailles et les SHA-256 sont fixés dans le script. Les fichiers téléchargés sont exclus de Git et ne sont pas redistribués par ce projet. Voir [la provenance des fixtures](docs/test-fixtures.md).

Les tests d'intégration vérifient des cartes, scores et statistiques connus ainsi que l'isolation des fichiers invalides. Ils sont ignorés dans `cargo test` par défaut ; `npm run test:replays` les active après téléchargement. La CI les exécute aussi.

Pour inspecter les métadonnées depuis le terminal :

```bash
cargo run --manifest-path src-tauri/Cargo.toml --example inspect_replays -- .local-tests/replays
```

## Compiler pour Windows

Depuis Windows :

```bash
npm run tauri -- build --bundles msi,nsis
```

Installateurs : `src-tauri/target/release/bundle/msi/` et `src-tauri/target/release/bundle/nsis/`.

GitHub Actions compile sur chaque push et pull request vers `main`. Téléchargez les installateurs depuis les artifacts du workflow. Les builds initiaux ne sont pas signés et ne sont pas des releases publiques.

Versionnez `package-lock.json` et `src-tauri/Cargo.lock`.

## Architecture

```text
src/App.tsx                         Dashboard et appels IPC
src/components/CoachingReport.tsx   Rapport de coaching
src/components/ReplayDetails.tsx    Métadonnées et statistiques du match
src/components/ReplayLibrary.tsx    Bibliothèque, recherche et filtres
src/components/Settings.tsx         Profil, dossier, fournisseur et clé en mémoire
src/components/PlayerFocus.tsx      Sélection et statistiques personnelles
src/components/GameplayPanel.tsx    Extraction locale, métriques et séquences
src/player.ts                      Matching prudent et cible d'analyse
src/types.ts                        Contrat frontend
src-tauri/src/lib.rs                 Commandes Tauri
src-tauri/src/replays.rs             Scan, validation et index des fichiers
src-tauri/src/metadata.rs            Parsing boxcars et normalisation des métadonnées
src-tauri/src/gameplay.rs            Reconstruction réseau, agrégats et dossier de preuves
src-tauri/src/player.rs              Validation du joueur dans le fichier reparsé
src-tauri/src/ai.rs                  Adaptateurs IA, minimisation et validation
src-tauri/src/report.rs              Contrat des rapports réels et de démonstration
.github/workflows/build.yml          Vérifications et installateurs Windows
```

L'ordre du rapport est : score, Game Type, échecs, résumé IA, points forts/faibles, métriques avancées.

Le parcours de validation manuelle de l'interface est décrit dans [docs/manual-ui-checks.md](docs/manual-ui-checks.md).

## Avant une première release publique

- Ajouter les identifiants stables des joueurs, reconstruire touches/pads/boost continu et calibrer les détecteurs avec des replays annotés par des coaches.
- Valider manuellement les trois fournisseurs avec des comptes autorisés et des budgets limités.
- Ajouter un coffre système si la persistance des clés est souhaitée (aucune persistance actuellement).
- Valider le parcours sur Windows et signer les installateurs.
- Épingler les GitHub Actions à des SHA et protéger la branche principale.

## Contribuer et signaler un problème

Voir [CONTRIBUTING.md](CONTRIBUTING.md) et [SECURITY.md](SECURITY.md).

## Licence

Client desktop sous [licence MIT](LICENSE). Les services IA choisis par l'utilisateur possèdent leurs propres conditions.
