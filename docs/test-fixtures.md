# Provenance des replays de test

Source : [nickbabcock/boxcars](https://github.com/nickbabcock/boxcars).

Révision : `9f31dfa120b37e5a8a649942170b3a2ca8235ff1`.

Les fichiers publics sont téléchargés à la demande dans `.local-tests/replays`, exclu de Git. Aucun replay ni export brut de pseudonymes n'est redistribué dans ce dépôt. Le dépôt amont utilise une licence MIT ; ce projet ne revendique aucun droit sur les données personnelles présentes dans les replays.

| Fichier       |           Taille | SHA-256                                                            |
| ------------- | ---------------: | ------------------------------------------------------------------ |
| rlcs.replay   | 1 072 362 octets | `709c0cde2286a1ae0df40de7d58e650371e103f2b4dbf9c8316ac3d53913fc6e` |
| rumble.replay | 1 030 898 octets | `8669455bfc9c1f86a534a4ac87e14096692eb27e4361cde93973ee5262a53b03` |
| epic.replay   | 1 131 017 octets | `d3ab3c713a6275ad0604954fe3ce58cecb6b63d7753c17a0a7a480add9f8cc74` |

## Observations utiles

- RLCS : score 2–5, carte `Stadium_p`, six joueurs, MatchType `Lan`. TeamSize vaut 4 mais l'effectif enregistré est de trois joueurs par équipe.
- Rumble : score 5–2, carte `stadium_foggy_p`, six joueurs, MatchType `Online`. Le nom du fichier n'est pas utilisé pour inférer une playlist.
- Epic : score 1–2, carte `EuroStadium_Night_P`, six joueurs, MatchType `Online`.

Les données viennent de l'en-tête boxcars. Aucun statut Ranked n'est déduit d'Online, aucune date manquante n'est inventée et la durée calculée via les frames reste une estimation.

## Reproduire

```bash
npm run fixtures:download
npm run test:replays
cargo run --manifest-path src-tauri/Cargo.toml --example inspect_replays -- .local-tests/replays
```
