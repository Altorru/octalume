# Méthode gameplay : faits locaux, interprétation du coach

« 70 % déterministe / 30 % IA » est une orientation de conception, pas une mesure de précision ni une pondération magique. Rust reconstruit les observations et calcule les métriques ; le modèle interprète leur contexte, propose corrections et exercices. Le coaching professionnel exige ensuite des benchmarks annotés et une revue humaine, pas seulement un prompt plus long.

## Extraction à la demande

Le scan de bibliothèque reste léger (en-tête seulement). « Extraire le gameplay » calcule localement sans clé ni réseau. L'analyse réelle revalide le fichier, le joueur et décode toutes les frames via [boxcars](https://docs.rs/boxcars/0.11.5/boxcars/struct.Frame.html). Pas de watcher, processus de jeu, injection ou modification des fichiers.

Association voiture → PRI → nom et équipe d'en-tête, uniquement si unique. Suppression/recréation d'acteurs retire leurs anciens états. Doublon de pseudo au sein d'une équipe : refus, pas de choix arbitraire. Les noms restent locaux ; le dossier externe contient des index de joueurs, pas des identifiants de compte.

Les replays réseau antérieurs à la version 7 sont refusés pour le coaching : leurs échelles position/vitesse et rotations ne sont pas validées par ce moteur. Les en-têtes restent consultables. Les conversions ne sont pas devinées pour obtenir une note.

## Mesures déterministes

Agrégats sur les intervalles entre frames, pondérés par durée et uniquement dans l'état `Active`. Un intervalle > 0,5 s n'est pas intégré. Corps non endormis maintenus au plus 0,5 s après leur dernière mise à jour. Données absentes : null, jamais zéro. Les snapshots quantifient positions/vitesses à l'unité uu ; les durées et résultats sont arrondis au dixième.

- Vitesse moyenne ; temps sous 500 uu/s et à au moins 2 200 uu/s.
- Boost répliqué moyen ; temps répliqué < 20 et quasi nul ; temps boost activé ; activation à ≥ 2 200 uu/s.
- Moitié offensive et tiers défensif ; côté but propre par rapport au ballon ; dernier coéquipier selon axe Y.
- Distances au ballon et au coéquipier le plus proche ; hauteur moyenne.

Chaque métrique expose méthode et durée réellement mesurée, pas une valeur opaque. [Conventions d'arène RLBot](https://wiki.rlbot.org/v5/botmaking/useful-game-values/) : blue défend -Y, orange +Y, Z est vertical, dimensions en uu. Les comparaisons directionnelles ne sont activées que pour des arènes Soccar reconnues. La liste doit être étendue avec validation pour de nouvelles cartes.

Boost : `ReplicatedBoostAmount` / `ReplicatedBoost.boost_amount` converti de 0–255 en 0–100 ; le dernier montant est maintenu entre réplications. L'état d'activation utilise la parité de `ReplicatedActive`. **Le boost moyen et temps de réservoir sont approximatifs** tant que consommation continue, respawns et pickups ne sont pas reconstruits et calibrés. Activer le boost à vitesse élevée n'est pas automatiquement du gaspillage.

## Séquences et erreurs

- Buts depuis `Goals.frame` : timestamp de la frame correspondante, équipe du buteur, sans publier son nom. Un replay peut omettre des buts figurant au score final.
- Augmentations des compteurs réseau tirs, arrêts, buts et démolitions du joueur cible : hauts historiques pour éviter de compter les keyframes/baselines répétées. Ce sont des timestamps de réplication, pas des instants de collision exacts.
- Signaux soutenus au moins une seconde : coéquipiers dans la zone du ballon, proximité < 500 uu, dernier selon Y devant le ballon dans sa moitié, boost activé à haute vitesse, boost répliqué vide.

Ces signaux ne sont pas des mistakes certifiées. Le modèle doit lire la séquence avant/après, expliciter l'impact probable et l'alternative, puis ne retenir que des critiques défendables. Chaque critique cite un identifiant de séquence existant ; Rust injecte les timestamps et observations locales. Aucune causalité automatique entre un but encaissé et une faute du joueur.

## Dossier envoyé

Toutes les métriques et leurs méthodes, limites/couverture, compteurs pseudonymisés de tous les joueurs, équipe cible et avantage au score explicites, séquences et chronologie sur toute la durée disponible. Les autres joueurs servent au contexte du coaching du joueur choisi.

Chronologie à environ 1 Hz (adaptative pour garder environ 600 snapshots sur les longs enregistrements) ; fenêtres ~4 Hz, huit secondes avant et trois après les événements. Les agrégats utilisent toutes les frames observables, **pas seulement les snapshots envoyés**. Ce dossier n'est pas une transmission du flux réseau brut complet. Limites explicites : 60 signaux heuristiques, 180 preuves au total et 1 200 échantillons de séquences denses, avec avertissements de plafonnement.

Limites d'extraction : fichier 32 Mio, 100 000 frames, 30 minutes, huit joueurs d'en-tête. Envoi limité à 1 Mio et refus si dépassé, sans tronquer silencieusement. La limite en octets ne garantit pas de tenir dans la fenêtre de contexte de chaque modèle. Aucun fallback « cinq compteurs » en cas d'échec gameplay.

## Note et confiance

La note /100 et ses dimensions sont des **appréciations subjectives du modèle**, pas des métriques déterministes, rangs, percentiles ou évaluations professionnelles calibrées. Rust exige arène reconnue, ≥ 60 s observées, ≥ 90 % de couverture du joueur et ≥ 70 % de contexte spatial complet pour autoriser une note. Le modèle peut toujours répondre null si ses preuves sont insuffisantes. En dessous des seuils, les notes sont retirées côté Rust.

## Ce qui reste à valider pour un niveau professionnel

Touches individuelles et collisions, pickups grands/petits et boost continu, transitions de rôles/rotations tactiques, mécaniques détaillées, modes/mutators spécifiques, calibration sur replays annotés et évaluation de precision/recall des détecteurs. Les heuristiques actuelles et la qualité des textes IA ne suffisent pas à revendiquer un « coaching pro validé ».
