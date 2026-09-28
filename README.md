# Octalume

Application de bureau pour explorer ses ralentis Rocket League et demander un rapport de coaching.

**Tauri v2 · Rust · React · TypeScript · Tailwind CSS**

## Fonctionnement

1. Octalume lit le dossier de ralentis au lancement.
2. « Rafraîchir la liste » relance cette lecture à la demande.
3. L'utilisateur sélectionne un replay et déclenche son analyse.
4. Le dashboard affiche le rapport de coaching.

Aucun watcher, polling périodique, service résident ou lancement automatique avec Windows n'est installé. Les watchers des outils de développement surveillent uniquement le code source.

## Statut du starter

- Détection du dossier Documents du système, y compris sa redirection vers OneDrive.
- Dossier personnalisable et mémorisé après un scan réussi.
- Scan non récursif des fichiers `.replay`, triés par modification décroissante.
- Dates et tailles réelles du disque. La date affichée est celle du fichier, pas celle du match.
- Parsing réel boxcars : nom, carte, date, score, effectif enregistré et statistiques des joueurs.
- Contrôle CRC et limite de lecture de 128 Mio par fichier. Un replay illisible reste visible avec son erreur ; il ne bloque pas les autres.
- Analyse de coaching simulée : délai asynchrone de deux secondes, conseils fictifs explicitement signalés. Le type de match provient du replay.
- Seuls les fichiers du dernier scan réussi peuvent être sélectionnés pour l'analyse.
- Les frames réseau ne sont pas décodées : boost, vitesse, rotations et erreurs de jeu ne sont pas encore calculés.

Le format « 3v3 observé » correspond aux effectifs présents dans `PlayerStats`, pas à une playlist certifiée. `TeamSize` peut désigner la capacité du lobby ; les départs et remplacements peuvent aussi modifier les effectifs enregistrés. « Online » ne prouve pas qu'un match est classé.

Les durées calculées avec `NumFrames / RecordFPS` sont affichées comme des estimations de l'enregistrement, pas comme des durées certifiées de match. Les champs manquants restent inconnus.

## Approche « EAC Safe »

Cette expression décrit notre conception passive. Elle ne constitue pas une certification Easy Anti-Cheat ni une garantie d'absence de sanction.

Octalume travaille sur des fichiers `.replay` déjà enregistrés : aucune injection, lecture ou modification de mémoire, aucun hook, aucune interaction avec le processus du jeu et aucune modification des replays.

Le projet est indépendant de Psyonix, Epic Games et Easy Anti-Cheat. Les règles des éditeurs concernés restent applicables.

## Application open source et API propriétaire

Ce dépôt contient le client desktop : interface, lecture locale, futur parsing et client API.

Le moteur de coaching, les modèles et l'infrastructure restent dans un service propriétaire distinct. Ils ne sont pas distribués dans ce dépôt et auront leurs propres conditions d'utilisation.

Dans ce starter, aucun appel réseau ni transfert de replay n'a lieu. Toute clé non vide suffit pour tester la simulation ; elle n'est pas authentifiée.

L'intégration réelle devra documenter le contrat API, les données transmises, leur conservation et les erreurs possibles. Chaque envoi sera déclenché par une action explicite.

## Confidentialité

Les replays peuvent contenir des pseudonymes et identifiants de joueurs. Ne les publiez pas dans ce dépôt.

La clé est conservée **en clair dans localStorage** pour ce prototype. Le bouton « Oublier la clé » la supprime. Remplacer ce stockage par un coffre de secrets avant une distribution avec une API réelle.

Aucune clé fournisseur ou clé serveur ne doit être embarquée dans l'application. La future clé utilisateur devra être révocable et limitée à son compte.

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

Dans l'application, renseignez le chemin absolu vers `.local-tests/replays`, rafraîchissez, puis ouvrez « Détails du match ». Entrez une clé fictive non vide pour tester le rapport de démonstration.

Le script télécharge trois replays publics du [dépôt officiel boxcars](https://github.com/nickbabcock/boxcars/tree/9f31dfa120b37e5a8a649942170b3a2ca8235ff1/assets/replays/good). La révision, les tailles et les SHA-256 sont fixés dans le script. Les fichiers téléchargés sont exclus de Git et ne sont pas redistribués par ce projet. Voir [la provenance des fixtures](docs/test-fixtures.md).

Les tests d'intégration vérifient des cartes, scores et statistiques connus ainsi que l'isolation des fichiers invalides. Ils sont ignorés dans `cargo test` par défaut ; `npm run test:replays` les active après téléchargement. La CI les exécute aussi.

Pour inspecter les métadonnées depuis le terminal :

```bash
cargo run --manifest-path src-tauri/Cargo.toml --example inspect_replays -- .local-tests/replays
```

## Compiler pour Windows

Depuis Windows :

```bash
npm run tauri build -- --bundles msi,nsis -- --locked
```

Installateurs : `src-tauri/target/release/bundle/msi/` et `src-tauri/target/release/bundle/nsis/`.

GitHub Actions compile sur chaque push et pull request vers `main`. Téléchargez les installateurs depuis les artifacts du workflow. Les builds initiaux ne sont pas signés et ne sont pas des releases publiques.

Versionnez `package-lock.json` et `src-tauri/Cargo.lock`.

## Architecture

```text
src/App.tsx                         Dashboard et appels IPC
src/components/CoachingReport.tsx   Rapport de coaching
src/components/ReplayDetails.tsx    Métadonnées et statistiques du match
src/types.ts                        Contrat frontend
src-tauri/src/lib.rs                 Commandes Tauri
src-tauri/src/replays.rs             Scan, validation et index des fichiers
src-tauri/src/metadata.rs            Parsing boxcars et normalisation des métadonnées
src-tauri/src/report.rs              Rapport simulé
.github/workflows/build.yml          Vérifications et installateurs Windows
```

L'ordre du rapport est : score, Game Type, échecs, résumé IA, points forts/faibles, métriques avancées.

## Avant une première release publique

- Ajouter le choix du joueur concerné et le parsing des frames réseau pour les métriques avancées.
- Connecter l'API depuis Rust avec délais limites et gestion des erreurs.
- Sécuriser le stockage de la clé utilisateur.
- Valider le parcours sur Windows et signer les installateurs.
- Épingler les GitHub Actions à des SHA et protéger la branche principale.

## Contribuer et signaler un problème

Voir [CONTRIBUTING.md](CONTRIBUTING.md) et [SECURITY.md](SECURITY.md).

## Licence

Client desktop sous [licence MIT](LICENSE). L'API propriétaire possède ses propres conditions.
