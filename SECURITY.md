# Sécurité

Ne publiez pas de vulnérabilité, clé API ou replay personnel dans une issue publique.

Utilisez le signalement privé GitHub : **Security → Advisories → Report a vulnerability**.

Si cette fonctionnalité est indisponible, demandez au mainteneur un canal privé sans divulguer les détails techniques publiquement.

Précisez la version, les étapes de reproduction et l'impact. Remplacez les secrets et les données personnelles par des valeurs fictives.

Les appels IA réels utilisent la clé personnelle du fournisseur choisi. Les clés restent en mémoire pour la session, ne sont pas journalisées par l'application et ne sont pas persistées. L'ancien stockage `octalume.apiKey` est supprimé au lancement. Une erreur de nettoyage doit être résolue avant un appel réel.

Ne mettez jamais de vraie clé dans une capture, un test, un commit, une issue ou cette conversation. Les tests utilisent des valeurs fictives et ne contactent pas les fournisseurs IA. Les erreurs réseau sont présentées sans reproduire les corps d'erreur du fournisseur ni les headers d'authentification.

Le consentement porte sur un envoi de statistiques anonymisées, pas sur un fichier replay. Les endpoints sont fixes, HTTPS obligatoire, sans redirection. Le modèle n'est pas une autorité : ses conseils peuvent être inexacts et ne démontrent pas des événements de gameplay non extraits.
