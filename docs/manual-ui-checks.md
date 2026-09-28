# Validation manuelle de l'interface

La refonte comporte trois écrans : bibliothèque, match et réglages. Aucune automatisation de l'interface n'est nécessaire pour suivre ce parcours.

## Démarrer

Fermer l'ancienne application, puis lancer depuis la racine du projet :

```bash
npm run tauri dev
```

Utiliser les fixtures déjà téléchargées dans `.local-tests/replays` ou son propre dossier. Dans « Réglages », vérifier le dossier, cliquer sur « Lire ce dossier » puis « Voir la bibliothèque ».

## Bibliothèque

- Vérifier les scores bleu/orange, durées, types et dates de modification des fichiers.
- Rechercher `epic`, une carte ou un pseudonyme présent dans un replay.
- Essayer « Disponibles » et « À vérifier ». Un fichier illisible doit rester visible avec son erreur et son bouton « Détails » désactivé.
- Une recherche sans résultat doit permettre de réinitialiser les filtres.
- Ouvrir « Détails » : la bibliothèque doit être remplacée par une page de match, pas complétée par un panneau.
- Revenir via « Tous les matchs » : la recherche et le filtre doivent être conservés.

## Match et coaching

- Dans `epic.replay`, vérifier le score **1–2**, la carte **EuroStadium_Night_P** et les six joueurs.
- Vérifier les colonnes score, buts, passes, arrêts et tirs. Une donnée absente affiche « — », pas zéro.
- Cliquer sur « Coaching IA » sans rapport : un état vide doit proposer l'analyse ou la configuration de la clé.
- Choisir « Démonstration locale » dans les réglages, sélectionner un joueur humain dans le match et lancer l'analyse sans clé.
- Vérifier l'état de chargement, l'impossibilité de lancer une seconde analyse simultanée et l'arrivée du rapport dans « Coaching IA ».
- Vérifier l'ordre : score de jeu, Game Type, échecs, résumé IA, points forts/faibles, métriques avancées.
- Vérifier que les conseils sont explicitement présentés comme fictifs.
- Revenir à « Vue d'ensemble », puis « Coaching IA » : le rapport reste disponible.
- Ouvrir un autre replay : aucun rapport du match précédent ne doit lui être attribué.
- Pendant une analyse, revenir à la bibliothèque et ouvrir un autre match : le rapport terminé ne doit apparaître que sur le replay analysé.

## Profil et ciblage

- Copier dans « Mon pseudo en jeu » le nom d'un joueur de la fixture : il doit être détecté uniquement lorsqu'il est le seul humain correspondant.
- Un pseudo absent, vide, partiel ou en doublon ne doit pas sélectionner automatiquement un joueur.
- Sans sélection, l'analyse est désactivée et propose de choisir son joueur.
- Choisir manuellement un autre joueur : les cinq statistiques personnelles et la ligne « TOI » doivent changer.
- Les bots restent désactivés dans la liste. Les joueurs ayant le même pseudo restent distingués par équipe et index.
- Si l'auteur du replay est proposé, la sélection doit nécessiter le clic « Oui, c'est mon joueur ».
- Après un rapport, changer le joueur : le précédent rapport doit disparaître de cette cible. Revenir à l'ancien joueur peut retrouver son rapport tant qu'aucune autre analyse ne l'a remplacé.

## IA réelle BYOK (appel potentiellement facturé)

À effectuer soi-même avec sa clé, jamais dans une issue ou cette conversation :

- Choisir OpenAI, Gemini ou Claude, vérifier le modèle accessible au compte et saisir sa clé API dans l'application.
- Revenir au match et sélectionner son joueur. Sans accord d'envoi coché, l'analyse doit être désactivée.
- Cocher le consentement, puis changer de joueur ou de modèle : l'ancien accord ne doit plus autoriser l'envoi.
- Confirmer l'envoi et analyser. Vérifier le fournisseur, le modèle et le joueur du rapport.
- Le score de gameplay réel doit indiquer « Non évaluable avec ces données ». Les métriques affichées doivent correspondre aux compteurs du joueur, jamais aux métriques fictives de la démo.
- Essayer une clé fictive uniquement si l'on accepte un appel rejeté : une erreur doit apparaître, sans faux succès de démonstration.
- Changer de fournisseur : aucune clé du fournisseur précédent ne doit être affichée ou envoyée à l'autre.
- Fermer complètement l'application et la rouvrir : aucune clé ne doit être retrouvée. Le pseudo, le dossier et le choix du fournisseur restent mémorisés.
- Ne pas diffuser de captures contenant les clés. Les valeurs des champs secrets ne doivent pas être journalisées.

## États d'erreur et réglages

- Un chemin de dossier invalide doit afficher une erreur lisible, sans laisser une ancienne liste comme si le scan avait réussi.
- Un replay supprimé ou corrompu après lecture du dossier doit provoquer une erreur à l'analyse, pas un rapport réussi.
- « Oublier la clé » doit retirer la clé du fournisseur courant du champ et de l'état de session.
- Le dernier dossier lu avec succès doit être retrouvé après redémarrage. L'ancienne clé du prototype en localStorage doit être supprimée, jamais réutilisée.
- Ajouter un fichier au dossier pendant que l'application est ouverte : il ne doit apparaître qu'après un rafraîchissement manuel.

## Présentation et accessibilité

- Redimensionner la fenêtre entre sa taille minimale (780 × 600) et une grande fenêtre : vérifier la navigation, le tableau et le bouton d'analyse.
- Faire défiler un match : la barre de sélection de vue et d'analyse reste accessible en haut.
- Parcourir les contrôles avec Tab / Maj+Tab et les activer avec Entrée / Espace.
- Vérifier la visibilité du focus, les intitulés des boutons et le retour du focus au titre lors d'un changement d'écran.
- Avec la préférence système « Réduire les animations », vérifier l'absence d'animations prolongées.

## Limites

Ce parcours est une checklist, pas une preuve de tests exécutés. Le mode démonstration est fictif et local ; les modes OpenAI, Gemini et Claude effectuent de vrais appels avec les statistiques uniquement après consentement. Aucun fichier replay n'est envoyé. Le gameplay frame par frame n'est pas analysé. « En ligne » ne certifie pas un match classé ; les durées estimées concernent l'enregistrement.
