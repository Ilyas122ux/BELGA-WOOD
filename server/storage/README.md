# Stockage persistant JAD HOME

Ce dossier est la valeur par défaut en développement. En production Oracle, les variables d’environnement déplacent les données vers `/srv/jad-home/data`, hors des releases.

- `jad-home-catalogue.xlsx` : source principale des produits, catégories et paramètres.
- `uploads/` : images exposées uniquement par la route Express `/uploads`.
- `backups/` : backups Excel créés avant chaque modification en développement.
- `sessions/` : sessions administrateur persistantes.

Ne placez jamais ce dossier dans `client/public` et ne servez jamais le classeur Excel via HTTP.

Les archives de production complètes (Excel + uploads + manifeste) sont créées par `scripts/backup.sh`, vérifiées par SHA-256 et copiées chaque semaine vers Object Storage. Voir `DEPLOY_ORACLE.md`.
