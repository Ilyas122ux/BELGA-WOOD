# Restaurer JAD HOME après incident

> DOCUMENT HISTORIQUE — ne pas utiliser pour le runtime BELGA WOOD actuel. La persistance active est Google Sheets + Cloudinary. Voir `docs/BACKUP_GOOGLE_SHEETS.md`, `docs/GOOGLE_SHEETS_SETUP.md` et `docs/CLOUDINARY_SETUP.md`.

Une archive contient uniquement les données non secrètes : Excel (y compris les réglages du commerce) et toutes les images. Elle ne contient jamais `.env`, le hash admin, le secret de session ou les clés OCI/SSH.

## Restaurer sur la VM actuelle

Lister et vérifier une sauvegarde locale :

```bash
ls -lh /srv/jad-home/data/backups/*.tar.gz
sudo -u jad-home /opt/jad-home/current/scripts/verify-backup.sh \
  /srv/jad-home/data/backups/jad-home-daily-DATE.tar.gz
```

Restaurer :

```bash
sudo /opt/jad-home/current/scripts/restore.sh \
  /srv/jad-home/data/backups/jad-home-daily-DATE.tar.gz
```

Le script vérifie le checksum s'il est présent, refuse les chemins dangereux, extrait dans `/srv/jad-home/data/.restore-work`, ouvre Excel, crée d'abord une sauvegarde de sécurité, arrête le backend, déplace l'état actuel vers `restore-rollback`, installe les données restaurées, redémarre, contrôle health/readiness et compare les SHA-256. En cas d'échec, il remet automatiquement les anciennes données.

Vérifier ensuite :

```bash
curl -fsS https://DOMAINE/api/health
curl -fsS https://DOMAINE/api/ready
sudo journalctl -u jad-home -n 100 --no-pager
```

Puis ouvrir le dashboard, contrôler plusieurs produits/images et ajouter un produit de test.

## Télécharger depuis Object Storage avec la VM

Créer un dossier persistant, jamais `/tmp` :

```bash
sudo install -d -m 0750 -o jad-home -g jad-home /srv/jad-home/data/restore-incoming
sudo -u jad-home oci os object list --auth instance_principal \
  --bucket-name jad-home-backups --prefix weekly/ --all \
  --query 'data[].name' --raw-output
```

Télécharger l'archive et son fichier `.sha256` en remplaçant les noms exacts :

```bash
sudo -u jad-home oci os object get --auth instance_principal \
  --bucket-name jad-home-backups --name 'weekly/DATE/jad-home-weekly-DATE.tar.gz' \
  --file /srv/jad-home/data/restore-incoming/jad-home-weekly-DATE.tar.gz
sudo -u jad-home oci os object get --auth instance_principal \
  --bucket-name jad-home-backups --name 'weekly/DATE/jad-home-weekly-DATE.tar.gz.sha256' \
  --file /srv/jad-home/data/restore-incoming/jad-home-weekly-DATE.tar.gz.sha256
sudo /opt/jad-home/current/scripts/restore.sh \
  /srv/jad-home/data/restore-incoming/jad-home-weekly-DATE.tar.gz
```

## Récupération la plus rapide si Oracle supprime la VM

1. Depuis Oracle Console, confirmer que le bucket et le dernier backup existent. Télécharger immédiatement `.tar.gz` et `.sha256` sur le PC comme seconde copie.
2. Créer **une seule** nouvelle VM Always Free selon [infra/oracle/README.md](infra/oracle/README.md). Ne pas attendre l'ancien disque pour commencer.
3. Mettre à jour la règle du Dynamic Group avec le nouvel OCID.
4. Envoyer la même version du projet, exécuter le bootstrap puis le premier deploy selon [DEPLOY_ORACLE.md](DEPLOY_ORACLE.md). Cela crée temporairement le catalogue de démonstration nécessaire au démarrage.
5. Télécharger la dernière archive dans `/srv/jad-home/data/restore-incoming` et exécuter `restore.sh`.
6. Tester health, readiness, login, un produit et une image.
7. Modifier l'enregistrement `A` Cloudflare vers la nouvelle IP. Garder `Full (strict)` après création du nouveau certificat Let's Encrypt.
8. Recréer l'alarme OCI avec le nouvel OCID et vérifier l'email.

Les secrets ne sont pas dans le backup. Restaurer `/etc/jad-home/jad-home.env` depuis le gestionnaire de mots de passe, ou laisser le bootstrap produire un nouveau `SESSION_SECRET` puis renseigner à nouveau email/hash admin/OCI. Toutes les sessions admin existantes seront invalidées, ce qui est souhaitable après incident.

## Si la restauration automatique échoue

Ne pas effacer les dossiers. Récupérer les éléments suivants :

```bash
sudo systemctl stop jad-home
sudo journalctl -u jad-home -n 300 --no-pager
sudo find /srv/jad-home/data/restore-rollback -maxdepth 2 -type f -ls
sudo find /srv/jad-home/data/.restore-work -maxdepth 3 -type f -ls
```

Le dernier état antérieur est sous `restore-rollback/<date>`. Le script ne le supprime pas. Corriger d'abord permissions/espace disque, puis relancer la restauration; ne jamais copier un `.xlsx` non validé directement sur le fichier actif.
