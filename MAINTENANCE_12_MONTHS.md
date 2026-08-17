# Maintenance simple pendant 12 mois

Prévoir 20 minutes une fois par mois. Noter la date et le résultat dans un carnet. Une case non validée doit être traitée le jour même.

## Checklist mensuelle du propriétaire

- [ ] Ouvrir Oracle Cloud et vérifier que la VM `jad-home-prod` est `Running`.
- [ ] Ouvrir `Billing & Cost Management`: coût du mois = **0**, aucune facture due, aucun essai/service inattendu.
- [ ] Vérifier qu'il n'existe qu'une VM, un boot volume de 50 Go et un bucket privé sous la franchise.
- [ ] Ouvrir le site, se connecter au dashboard et afficher/modifier un produit de test.
- [ ] Sur la VM, exécuter `df -h /srv/jad-home/data`; rester sous 75 %.
- [ ] Exécuter `systemctl list-timers 'jad-home*'`; les trois timers doivent avoir une prochaine date.
- [ ] Vérifier la dernière sauvegarde : `sudo journalctl -u jad-home-backup --since '35 days ago' --no-pager`.
- [ ] Vérifier le bucket : huit semaines au maximum, chaque archive avec son `.sha256`.
- [ ] Télécharger la dernière archive + `.sha256` sur le PC/disque externe et vérifier la somme.
- [ ] Exécuter `sudo /opt/jad-home/current/scripts/verify-backup.sh CHEMIN_ARCHIVE` sur au moins une archive récente.
- [ ] Vérifier l'arrivée de l'email d'alerte OCI avec un test de notification contrôlé.
- [ ] Vérifier que le moniteur HTTP externe Free est actif et qu'aucune option payante/carte n'a été ajoutée.
- [ ] Vérifier `systemctl is-active jad-home nginx fail2ban`.
- [ ] Vérifier HTTPS : cadenas valide, `sudo certbot renew --dry-run`, puis `systemctl status certbot.timer`.
- [ ] Vérifier la date d'expiration/renouvellement du domaine chez le registrar.
- [ ] Lire les éventuels emails Oracle sur Always Free, limites, inactivité ou sécurité.

## Mise à jour Ubuntu prudente

Toujours sauvegarder avant :

```bash
sudo systemctl start jad-home-backup.service
sudo journalctl -u jad-home-backup -n 80 --no-pager
sudo apt-get update
apt list --upgradable
sudo apt-get upgrade
```

Si `needrestart` ou le noyau demande un reboot :

```bash
sudo reboot
# après reconnexion
systemctl is-active jad-home nginx fail2ban
curl -fsS https://DOMAINE/api/health
curl -fsS https://DOMAINE/api/ready
```

Ne jamais lancer `autoremove` sans lire la liste. Ne jamais effacer `/opt/jad-home`, `/srv/jad-home` ou `/etc/jad-home` pour « nettoyer » le disque.

## Mise à jour Node et dépendances

Node 24 LTS reste supporté au-delà des 12 mois visés. Une fois par trimestre, consulter les bulletins Node/npm. Pour passer à une nouvelle version corrective 24.x :

1. Modifier `NODE_VERSION` uniquement vers une version officielle Node 24 LTS.
2. Relancer le bootstrap avec cette variable; le téléchargement est contrôlé par SHA-256.
3. Redéployer: tous les tests sont exécutés avant bascule.

```bash
sudo env NODE_VERSION=24.X.Y bash /home/ubuntu/jadhome/scripts/bootstrap-oracle-ubuntu.sh \
  --source /home/ubuntu/jadhome --domain DOMAINE --install-oci-cli
sudo bash /home/ubuntu/jadhome/scripts/deploy.sh /home/ubuntu/jadhome
```

Pour mettre à jour les dépendances applicatives, le faire d'abord sur Windows dans une copie du projet, relancer `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, puis déployer. Ne pas faire `npm update` directement dans `/opt/jad-home/current`.

## Tous les trois mois

- Faire un exercice de restauration vers un dossier/une VM de test seulement si une ressource réellement gratuite est disponible; sinon tester l'archive, Excel et les checksums localement sans créer une deuxième VM durable.
- Vérifier les règles UFW, SSH et fail2ban : `sudo ufw status verbose`, `sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin'`, `sudo fail2ban-client status sshd`.
- Vérifier les releases conservées : cinq maximum sous `/opt/jad-home/releases`.
- Supprimer manuellement les anciens dossiers `restore-rollback` seulement après avoir confirmé plusieurs backups externes; ne jamais automatiser cette suppression à l'aveugle.

## Seuils d'action

- Disque ≥ 75 % : télécharger/valider les backups, supprimer uniquement d'anciennes archives déjà externalisées et diagnostiquer les logs.
- Aucun daily depuis 36 h : lancer le service backup et lire journalctl.
- Readiness 503 : ne pas redéployer; vérifier Excel, permissions et espace disque.
- Coût différent de 0 : arrêter toute création, identifier la ressource dans Cost Analysis et ouvrir un ticket Oracle si nécessaire.
- VM absente/irrécupérable : appliquer immédiatement [RESTORE_DISASTER.md](RESTORE_DISASTER.md).
> DOCUMENT HISTORIQUE pour l'ancienne architecture Excel/VM. Il ne décrit pas la persistance active BELGA WOOD (Google Sheets + Cloudinary).
