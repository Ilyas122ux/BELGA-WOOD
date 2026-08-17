# Matrice de validation du déploiement

Les tests locaux valident la logique applicative. Les tests marqués « VM » doivent être exécutés sur Ubuntu ARM64 après création autorisée de la VM; Windows ne peut pas prouver systemd, Nginx, UFW, le binaire ARM64 ou OCI.

## Automatique à chaque deploy

Le script `deploy.sh` exécute, avant la bascule :

```bash
npm ci --include=dev
npm run typecheck
npm run lint
npm test
npm run build
npm prune --omit=dev
node scripts/validate-catalogue.mjs "$CATALOGUE_PATH"
```

Il arrête ensuite brièvement l'API, écrit l'empreinte SHA-256 du catalogue et de chaque upload, bascule la release, démarre, teste `/api/health`, `/api/ready`, puis exige la même empreinte. Sinon il remet le lien précédent.

Les tests Vitest couvrent : routes publiques/admin 401, login, session persistante après recréation du store, ajout de produit avec deux images, redémarrage simulé de l'app, présence des deux images, modification persistée, lecture/écriture/verrou/backup/restauration Excel, readiness non destructive et message WhatsApp.

## Recette VM ARM64 obligatoire

Exécuter dans cet ordre et conserver la sortie :

1. Architecture/native :
   `uname -m; node -p "process.arch"; node -e "require('sharp'); require('bcrypt'); console.log('native ok')"` — attendu `aarch64`, `arm64`, `native ok`.
2. Qualité/build : lancer `sudo scripts/deploy.sh SOURCE`; toutes les phases doivent réussir.
3. Production : `systemctl is-active jad-home nginx`; attendu deux fois `active`.
4. Endpoints : `curl -fsS http://127.0.0.1:4000/api/health` et `/api/ready`; attendu HTTP 200.
5. Sécurité : `curl -i http://127.0.0.1:4000/api/admin/products`; attendu HTTP 401.
6. Login : se connecter au dashboard avec le compte de production.
7. Ajouter `TEST-PERSISTANCE` avec deux images distinctes; noter l'ID et vérifier les deux fichiers sous `/srv/jad-home/data/uploads/products`.
8. Modifier son prix et recharger la page.
9. Redémarrer : `sudo systemctl restart jad-home`; vérifier produit, prix et images.
10. Reboot complet : `sudo reboot`; refaire health, ready, login, produit et images.
11. Backup : `sudo systemctl start jad-home-backup.service`; vérifier journal et `.sha256`.
12. Archive : `sudo -u jad-home scripts/verify-backup.sh ARCHIVE`; attendu `Archive valide`.
13. Restore : changer temporairement le produit, restaurer l'archive avec `restore.sh`, vérifier que la version archivée revient.
14. Rollback code : déployer deux releases identiques, exécuter `rollback.sh`, vérifier health/ready et empreinte inchangée.
15. Nginx : tester une route React profonde, un asset, une image, `/api`, `/admin`, et la page 503 en arrêtant brièvement l'API.
16. Monitoring : lancer `sudo systemctl start jad-home-monitor.service`, puis vérifier journalctl; tester une notification OCI volontaire.
17. Object Storage : lancer le weekly, vérifier archive + checksum, télécharger et revalider.
18. Certificat : `sudo certbot renew --dry-run`.
19. Pare-feu : depuis l'extérieur, seuls 22, 80, 443 doivent être accessibles; le port 4000 doit être fermé.
20. Supprimer/désactiver le produit de recette depuis le dashboard seulement après validation complète.

Une restauration réelle et un rollback systemd ne sont déclarés réussis qu'après cette recette VM. La logique de repository est testée localement, mais ce n'est pas un substitut à l'exercice Ubuntu.
