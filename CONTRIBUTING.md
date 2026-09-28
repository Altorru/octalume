# Contribuer

Décrivez le problème, le résultat attendu et les vérifications dans chaque pull request.

Avant de soumettre :

```bash
npm run check
npm run test:player
npm run build
npm run format:check
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --locked -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

La lecture des replays reste explicite : lancement, rafraîchissement manuel ou analyse demandée. N'introduisez ni watcher, ni polling, ni interaction avec le processus du jeu.

N'ajoutez aucun secret au code ou aux logs. Les fixtures doivent être autorisées à la redistribution et ne contenir aucune donnée personnelle sans consentement.
