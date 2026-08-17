# Déployer JAD HOME sur Oracle Cloud à coût nul

Ce guide prépare une seule VM, sans créer de ressource distante automatiquement. L'architecture conserve Excel et sépare strictement les releases (`/opt/jad-home`) des données (`/srv/jad-home/data`). Un déploiement ne copie ni ne supprime le catalogue ou les uploads existants.

## Choix retenus

- Ubuntu 24.04 LTS ARM64 sur `VM.Standard.A1.Flex`, 1 OCPU et 6 Go de RAM.
- Fallback seulement si A1 est indisponible : `VM.Standard.E2.1.Micro`, Ubuntu x86_64 et swap de 2 Go.
- Node.js 24 LTS, vérifié par SHA-256 depuis `nodejs.org`. Le projet accepte Node 22 à 24 localement, mais la VM est épinglée sur Node 24.
- Nginx sert React et les images; Express écoute uniquement sur `127.0.0.1:4000`.
- systemd exécute l'API sous l'utilisateur non-root `jad-home` et redémarre toujours le processus.
- Le catalogue, les uploads et les sessions résident sur le volume persistant. `MemoryStore` n'est pas utilisé.
- 14 sauvegardes quotidiennes locales et 8 sauvegardes hebdomadaires dans Object Storage.

Les paquets installés contiennent les cibles Linux ARM64 nécessaires : Sharp inclut `@img/sharp-linux-arm64` et bcrypt 6 fournit un binaire N-API `linux-arm64`. Le vrai contrôle final reste `npm ci`, les tests et un upload d'image exécutés sur la VM ARM64.

## 1. Créer l'infrastructure sans coût

Suivre d'abord [infra/oracle/README.md](infra/oracle/README.md). Ne continuer que si chaque écran indique `Always Free Eligible` et un coût estimé nul. Ne pas activer Pay As You Go, de load balancer, de NAT Gateway, de base managée ou de second volume.

Noter :

- l'IP publique de la VM;
- son OCID;
- le nom du bucket `jad-home-backups`;
- l'OCID du topic Notifications;
- le namespace Object Storage;
- le domaine éventuel.

## 2. Envoyer le projet depuis Windows

Dans PowerShell, depuis `C:\Users\Home\Desktop\jadhome`, créer une archive sans dépendances ni secrets :

```powershell
tar.exe -a -c -f ..\jadhome-deploy.zip --exclude=node_modules --exclude=.env --exclude=dist .
scp -i C:\chemin\oracle.key ..\jadhome-deploy.zip ubuntu@IP_PUBLIQUE:/home/ubuntu/
ssh -i C:\chemin\oracle.key ubuntu@IP_PUBLIQUE
unzip -q /home/ubuntu/jadhome-deploy.zip -d /home/ubuntu/jadhome
```

Le fichier `.env` n'est jamais envoyé. Garder la clé privée uniquement sur le poste du propriétaire.

## 3. Bootstrap idempotent

Pour A1 ARM64 :

```bash
cd /home/ubuntu/jadhome
sudo bash ./scripts/bootstrap-oracle-ubuntu.sh \
  --source /home/ubuntu/jadhome \
  --domain exemple.ma \
  --install-oci-cli \
  --harden-ssh
```

Pour E2.1.Micro uniquement, ajouter `--enable-swap`. Le script refuse le durcissement SSH si aucune clé n'est présente dans `authorized_keys`. Garder la session SSH courante ouverte et tester une deuxième connexion avant de la fermer.

Le bootstrap est relançable. Il installe les paquets, Node 24, Nginx, Certbot, fail2ban, UFW, OCI CLI si demandé, les unités systemd et les permissions. Il n'écrase jamais `/etc/jad-home/jad-home.env` s'il existe.

## 4. Configurer les secrets

Créer le hash bcrypt sur le poste local :

```powershell
npm run hash-password -- "UNE-PHRASE-DE-PASSE-LONGUE-ET-UNIQUE"
```

Puis éditer le fichier sur la VM :

```bash
sudoedit /etc/jad-home/jad-home.env
sudo chmod 600 /etc/jad-home/jad-home.env
sudo chown root:root /etc/jad-home/jad-home.env
```

Remplacer `ADMIN_PASSWORD_HASH`, vérifier `ADMIN_EMAIL`, `CLIENT_URL`, `OCI_BACKUP_BUCKET`, et renseigner `OCI_NOTIFICATION_TOPIC_ID`. Ne pas entourer le hash bcrypt d'apostrophes et ne jamais exécuter `source` sur ce fichier. Le secret de session aléatoire a déjà été généré par le bootstrap.

## 5. Premier déploiement

```bash
sudo bash /home/ubuntu/jadhome/scripts/deploy.sh /home/ubuntu/jadhome
sudo systemctl status jad-home --no-pager
curl -fsS http://127.0.0.1:4000/api/health
curl -fsS http://127.0.0.1:4000/api/ready
sudo journalctl -u jad-home -n 100 --no-pager
```

Le premier déploiement initialise `/srv/jad-home/data` à partir du catalogue livré. Les suivants sauvegardent les données, lancent `npm ci`, TypeScript, ESLint, les tests et le build, puis basculent le lien `current`. Le service est arrêté quelques secondes pendant la comparaison SHA-256 d'Excel et de tous les uploads. Tout échec de service, health, readiness ou empreinte provoque un rollback du code.

Les timers démarrent seulement après un déploiement validé :

```bash
systemctl list-timers 'jad-home*'
sudo systemctl start jad-home-backup.service
sudo journalctl -u jad-home-backup -n 100 --no-pager
```

Configurer ensuite les trois couches d'alerte décrites dans [`infra/oracle/MONITORING.md`](infra/oracle/MONITORING.md), dont un seul check public gratuit toutes les cinq minutes.

## 6. HTTPS et Cloudflare

Avant le premier certificat, mettre temporairement l'enregistrement Cloudflare en `DNS only`, pointer `A exemple.ma` vers l'IP et attendre la résolution.

```bash
sudo certbot --nginx -d exemple.ma -d www.exemple.ma
sudo certbot renew --dry-run
systemctl status certbot.timer --no-pager
```

Remettre ensuite le proxy Cloudflare orange et suivre [infra/oracle/CLOUDFLARE.md](infra/oracle/CLOUDFLARE.md). Choisir `Full (strict)` seulement après obtention du certificat valide.

## 7. Mise à jour et rollback

Envoyer la nouvelle source dans un autre dossier, puis :

```bash
sudo bash /home/ubuntu/jadhome-new/scripts/deploy.sh /home/ubuntu/jadhome-new
```

Pour revenir à la release précédente tout en gardant les données actuelles :

```bash
sudo bash /opt/jad-home/current/scripts/rollback.sh
```

Ou choisir une release listée par `ls -1 /opt/jad-home/releases` :

```bash
sudo bash /opt/jad-home/current/scripts/rollback.sh 20260721T120000Z
```

## Vérifications après reboot

```bash
sudo reboot
# se reconnecter après 1 à 2 minutes
systemctl is-active jad-home nginx fail2ban
curl -fsS https://exemple.ma/api/health
curl -fsS https://exemple.ma/api/ready
sudo journalctl -u jad-home -b --no-pager
sudo -u jad-home test -r /srv/jad-home/data/jad-home-catalogue.xlsx
sudo -u jad-home test -w /srv/jad-home/data/uploads
```

Se connecter ensuite au dashboard et vérifier qu'un produit et ses images sont toujours présents.

## Limites honnêtes

Cette installation ne garantit pas 100 % de disponibilité. Oracle peut manquer de capacité A1, arrêter une VM, récupérer une instance jugée inactive, suspendre un compte ou changer les conditions Free Tier. Un volume de démarrage peut aussi être perdu avec la VM selon l'action choisie. Les checks de dix minutes servent uniquement à détecter les pannes; ils ne génèrent pas de charge artificielle pour contourner une politique d'inactivité. La copie Object Storage et une copie manuelle hors Oracle sont donc indispensables.
> DOCUMENT HISTORIQUE JAD HOME — cette procédure Oracle/Excel n'est pas l'architecture de production BELGA WOOD. Utiliser `DEPLOY_NETLIFY.md`.
