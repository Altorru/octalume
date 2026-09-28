# Contrat BYOK et limites

## Fournisseurs implémentés

| Mode          | Endpoint fixe                                                                     | Authentification                                     | Réponse structurée                                 |
| ------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| Démonstration | Aucun réseau                                                                      | Aucune clé                                           | Rapport fictif local                               |
| OpenAI        | `https://api.openai.com/v1/responses`                                             | Header Bearer                                        | `text.format` JSON schema                          |
| Gemini        | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | Header `x-goog-api-key`                              | `generationConfig.responseFormat.text` JSON schema |
| Claude        | `https://api.anthropic.com/v1/messages`                                           | Headers `x-api-key`, `anthropic-version: 2023-06-01` | `output_config.format` JSON schema                 |

Implémentation vérifiée contre les documentations officielles le 28 septembre 2026 : [OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs), [Gemini](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), [Claude](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). Le modèle doit être disponible sur le compte utilisé et accepter le format structuré. Le champ est éditable ; la compatibilité de chaque modèle existant n'est pas garantie. Autres fournisseurs : non implémentés pour l'instant.

## Ciblage du joueur

Le profil contient un pseudo, comparé après suppression des espaces extérieurs et conversion en minuscules. Pas de matching partiel, fuzzy ou choix du premier joueur. Les doublons empêchent la détection automatique. Les bots sont exclus. L'auteur du replay peut être proposé mais doit être confirmé.

Une sélection manuelle s'applique au replay courant, pas à tout le compte. Le serveur Rust reçoit l'index dans `PlayerStats`, le nom exact et l'équipe, reparsant le fichier puis vérifiant les trois. Ce n'est pas une preuve d'identité Steam/Epic ; les identifiants stables seront nécessaires pour une association de compte robuste.

Le rapport est lié au chemin local et à la cible validée ; il n'est pas affiché pour un autre joueur. Changer le joueur ou le fournisseur invalide le consentement applicable. Le consentement reste local à la page de match et n'est pas enregistré.

## Données envoyées

Uniquement :

- Type de match normalisé (`online`, `private`, `local`, `lan`, `unknown`) et taille observée de chaque équipe.
- Scores bleu/orange, durée enregistrée et indicateur d'estimation.
- Équipe, score, buts, passes, arrêts et tirs du joueur sélectionné.

Les valeurs absentes restent `null`. Aucune statistique individuelle d'un autre joueur, pseudo, identifiant, carte en texte libre, date, nom ou chemin de fichier n'est envoyé. La clé est transmise uniquement dans le header d'authentification HTTPS du fournisseur choisi, pas dans l'URL ni dans le prompt.

Ces données sont minimisées et sans identifiant direct, pas une garantie mathématique d'anonymat. Les règles de conservation du fournisseur et ses sous-traitants restent applicables. `store: false` est demandé à OpenAI ; voir [les contrôles de données OpenAI](https://developers.openai.com/api/docs/guides/your-data). Ce paramètre ne garantit pas l'absence de toute conservation.

## Réponse et fiabilité

Le modèle retourne uniquement un résumé et trois listes (erreurs, points forts, points faibles). Le schéma interdit les champs supplémentaires. Rust impose les limites de texte et de listes. Une liste d'erreurs critiques non vide est rejetée, car l'en-tête ne permet pas d'établir des événements de gameplay. Les réponses refusées, filtrées, tronquées ou invalides ne produisent pas de faux rapport réussi.

Le serveur attache lui-même le joueur, le fournisseur, le modèle et le type de match, sans accepter une identité fournie par l'IA. La note globale de gameplay est `null` et les métriques numériques sont copiées des statistiques réelles. Les conseils restent des hypothèses et exercices, jamais une analyse certifiée des rotations, du boost, de la vitesse ou des trajectoires.

La structure visuelle du rapport est conservée ; le score réel affiche « Non évaluable avec ces données ». Le mode démonstration affiche encore une note et des exemples fictifs clairement signalés.

## Secrets et garde-fous

- Clés séparées par fournisseur, uniquement en mémoire du frontend pour la session. Pas de lecture de clés d'environnement ni de clé globale embarquée.
- Ancienne clé en localStorage supprimée au lancement. En cas d'échec de cette migration, les appels réels sont bloqués dans l'interface.
- « Oublier la clé » retire la clé courante de l'état de l'application ; cela ne prétend pas effacer cryptographiquement les anciennes copies en mémoire.
- Endpoints fixes, HTTPS, redirections refusées, connexion limitée à 10 secondes et appel à 60 secondes.
- Réponse limitée à 256 Kio, sortie limitée à 2 000 tokens OpenAI/Claude et 4 096 Gemini.
- Une analyse simultanée maximum, protégée dans React et Rust. Pas de retry automatique applicatif ni de fallback silencieux vers un autre fournisseur.
- Pas de logs de requêtes ou de réponses. Les erreurs ne reproduisent pas le corps fournisseur ou les secrets.

## Vérification

Les tests sont hors ligne : construction des trois requêtes, headers sensibles, validation du consentement/modèle, minimisation, refus et troncature, JSON, identité ciblée et absence de score de gameplay fictif. Ils ne prouvent pas un succès de bout en bout avec une vraie clé.

Le test d'un vrai fournisseur doit être effectué manuellement avec une clé API autorisée et un budget limité. Ne jamais publier la clé ni une capture du champ. Vérifier les erreurs 401/403, 429, le modèle indisponible et le délai d'attente avant de distribuer une release.
