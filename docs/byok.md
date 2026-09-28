# Contrat BYOK et limites

## Fournisseurs implémentés

| Mode          | Endpoint fixe                                                                     | Authentification                                     | Réponse structurée                                     |
| ------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| Démonstration | Aucun réseau                                                                      | Aucune clé                                           | Rapport fictif local                                   |
| OpenAI        | `https://api.openai.com/v1/responses`                                             | Header Bearer                                        | `text.format` JSON schema                              |
| Gemini        | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | Header `x-goog-api-key`                              | `generationConfig.responseMimeType` + `responseSchema` |
| Claude        | `https://api.anthropic.com/v1/messages`                                           | Headers `x-api-key`, `anthropic-version: 2023-06-01` | `output_config.format` JSON schema                     |

Implémentation vérifiée contre les documentations officielles le 28 septembre 2026 : [OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs), [Gemini generateContent et migration](https://ai.google.dev/gemini-api/docs/migrate-to-interactions), [Claude](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). Gemini utilise le schéma OpenAPI de `responseSchema` (types en majuscules), sans `additionalProperties` ; la validation locale refuse toujours les champs inattendus. Le modèle doit être disponible sur le compte utilisé et accepter le format structuré. Autres fournisseurs : non implémentés pour l'instant.

## Configuration et catalogue dynamique

Le parcours est explicite : fournisseur → clé → **Enregistrer et récupérer les modèles** → sélectionner un modèle → **Enregistrer le modèle**. Aucun modèle codé en dur ni saisie libre. Le catalogue seul n'active pas l'analyse : le modèle doit être confirmé. Modifier ou oublier la clé retire son catalogue et désactive la configuration. Clés et listes sont séparées par fournisseur et restent en mémoire ; seuls fournisseur et identifiants de modèles confirmés sont mémorisés sur disque. Après redémarrage, le modèle mémorisé est proposé uniquement s'il figure dans le nouveau catalogue, puis doit être confirmé.

La commande Rust `list_ai_models` effectue exclusivement des GET authentifiés, sans données de replay ni génération :

- [OpenAI GET `/v1/models`](https://developers.openai.com/api/reference/resources/models/methods/list), Bearer. Le catalogue peut inclure des modèles non adaptés au coaching ou aux sorties structurées ; aucune capacité n'est déduite du nom.
- [Gemini GET `/v1beta/models`](https://ai.google.dev/api/models), header `x-goog-api-key`, pages `pageToken` / `nextPageToken`. Filtrage sur `supportedGenerationMethods: generateContent`. Le préfixe `models/` est retiré, sans remplacer l'identifiant exact par un alias.
- [Claude GET `/v1/models`](https://platform.claude.com/docs/en/api/models/list), headers `x-api-key` et `anthropic-version`, pages `after_id` / `last_id` tant que `has_more` est vrai.

Présence dans le catalogue ≠ garantie d'un appel d'analyse réussi, de compatibilité JSON ou de quota disponible. HTTPS uniquement, hôtes fixes, redirections refusées, aucun retry automatique, délai global de 60 secondes, limite cumulée de 2 Mio / 20 pages / 5 000 modèles. Un échec ne retourne pas une liste partielle et ne reproduit jamais le corps d'erreur du fournisseur.

## Ciblage du joueur

Le profil contient un pseudo, comparé après suppression des espaces extérieurs et conversion en minuscules. Pas de matching partiel, fuzzy ou choix du premier joueur. Les doublons empêchent la détection automatique. Les bots sont exclus. L'auteur du replay peut être proposé mais doit être confirmé.

Une sélection manuelle s'applique au replay courant, pas à tout le compte. Le serveur Rust reçoit l'index dans `PlayerStats`, le nom exact et l'équipe, reparsant le fichier puis vérifiant les trois. Ce n'est pas une preuve d'identité Steam/Epic ; les identifiants stables seront nécessaires pour une association de compte robuste.

Le rapport est lié au chemin local et à la cible validée ; il n'est pas affiché pour un autre joueur. Changer le joueur ou le fournisseur invalide le consentement applicable. Le consentement reste local à la page de match et n'est pas enregistré.

## Données envoyées

Uniquement :

- Type de match normalisé (`online`, `private`, `local`, `lan`, `unknown`) et taille observée de chaque équipe.
- Scores bleu/orange, durée enregistrée et indicateur d'estimation.
- Compteurs d'en-tête des joueurs indexés sans nom, équipe ciblée et avantage au score explicites pour éviter la confusion bleu/orange.
- Dossier `network-gameplay` : métriques déterministes et leurs méthodes, couverture, limites, positions/vitesses/orientations/boost des voitures, ballon, chronologie et séquences contextualisées. Les autres joueurs servent au contexte tactique du joueur ciblé.

Les valeurs absentes restent `null`. Aucun pseudo, identifiant de compte, carte en texte libre, date, nom ou chemin de fichier n'est envoyé. Les index pseudonymisés ne constituent pas une garantie mathématique d'anonymat. La clé est transmise uniquement dans le header d'authentification HTTPS du fournisseur choisi, pas dans l'URL ni dans le prompt. Le consentement indique explicitement le contexte des autres joueurs et le coût potentiellement plus élevé du dossier.

Ces données sont minimisées et sans identifiant direct, pas une garantie mathématique d'anonymat. Les règles de conservation du fournisseur et ses sous-traitants restent applicables. `store: false` est demandé à OpenAI ; voir [les contrôles de données OpenAI](https://developers.openai.com/api/docs/guides/your-data). Ce paramètre ne garantit pas l'absence de toute conservation.

## Réponse et fiabilité

Le modèle retourne un résumé détaillé, une note nullable et sa justification, des dimensions de coaching, mistakes avec `evidence_id`/observation/impact/correction/exercice/confiance, points forts/faibles et plan d'entraînement. Le schéma interdit les champs supplémentaires. Rust impose les limites de texte et de listes, notes 0–100, références existantes et non dupliquées. Les timestamps et observations locales des mistakes sont attachés par Rust, jamais acceptés du modèle. Les réponses refusées, filtrées, tronquées ou invalides ne produisent pas de faux rapport réussi.

Le serveur attache lui-même le joueur, le fournisseur, le modèle et le type de match, sans accepter une identité fournie par l'IA. Les métriques numériques viennent exclusivement du parseur/agrégateur local. Une note subjective est autorisée seulement sur arène Soccar validée, ≥ 60 s observées, ≥ 90 % de couverture cible et ≥ 70 % de contexte spatial complet. Ces seuils sont des garde-fous internes, pas une calibration professionnelle ; sinon notes globale et par dimension sont nulles. Les heuristiques géométriques ne prouvent pas à elles seules une faute de rotation. Voir [la méthode](gameplay-methodology.md).

La structure visuelle du rapport est conservée. Le score est accompagné de justification, confiance et avertissement de non-calibration ; le mode démonstration reste explicitement fictif. Le moteur est une base de coaching à valider, pas une expertise professionnelle certifiée.

## Secrets et garde-fous

- Clés séparées par fournisseur, uniquement en mémoire du frontend pour la session. Pas de lecture de clés d'environnement ni de clé globale embarquée.
- Ancienne clé en localStorage supprimée au lancement. En cas d'échec de cette migration, les appels réels sont bloqués dans l'interface.
- « Oublier la clé » retire la clé courante de l'état de l'application ; cela ne prétend pas effacer cryptographiquement les anciennes copies en mémoire.
- Endpoints fixes, HTTPS, redirections refusées, connexion limitée à 10 secondes et appel de coaching à 120 secondes (catalogue : 60 secondes).
- Dossier d'entrée limité à 1 Mio : aucun envoi tronqué si dépassé. Limite en octets, pas une garantie de compatibilité avec la fenêtre de contexte du modèle choisi. Réponse limitée à 256 Kio, sortie limitée à 8 192 tokens.
- Une analyse simultanée maximum, protégée dans React et Rust. Pas de retry automatique applicatif ni de fallback silencieux vers un autre fournisseur.
- Pas de logs de requêtes ou de réponses. Les erreurs ne reproduisent pas le corps fournisseur ou les secrets.

## Vérification

Les tests sont hors ligne : requêtes et catalogues, headers sensibles, consentement/modèle, minimisation, refus/troncature/JSON, identité ciblée, reconstruction des fixtures, unités, pondération temporelle, signaux soutenus et validation des références de coaching. Ils ne prouvent pas un succès de bout en bout avec une vraie clé ni la qualité professionnelle d'un coach.

Le test d'un vrai fournisseur doit être effectué manuellement avec une clé API autorisée et un budget limité. Ne jamais publier la clé ni une capture du champ. Vérifier les erreurs 401/403, 429, le modèle indisponible et le délai d'attente avant de distribuer une release.
