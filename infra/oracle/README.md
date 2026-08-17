# Création manuelle minimale dans Oracle Cloud

Ce dossier est volontairement un guide, pas un Terraform automatique : aucune ressource distante ne doit être créée sans vérification humaine du badge `Always Free Eligible` et du coût affiché.

## 0. Garde-fous avant toute création

1. À l'inscription, choisir une Home Region proche du Maroc **et offrant A1**. Cette région devient la région d'origine du compte et ne peut pas être changée après le provisionnement du tenancy.
2. Ne pas cliquer sur `Upgrade to Pay As You Go`.
3. Dans `Governance & Administration > Limits, Quotas and Usage`, vérifier Compute, Boot Volume et Object Storage.
4. Dans chaque assistant, rechercher explicitement `Always Free Eligible`. Si le badge disparaît ou si le coût estimé n'est pas nul, annuler.
5. Ne créer qu'une VM, un boot volume de 50 Go et un bucket. Ne pas ajouter Load Balancer, Autonomous Database, Block Volume séparé, NAT Gateway ou IP réservée.

La documentation Oracle actuelle indique un quota A1 Always Free équivalent à **2 OCPU et 12 Go de RAM au total**; la configuration retenue de 1 OCPU/6 Go reste en dessous. Elle indique aussi jusqu'à deux VM E2.1.Micro et 20 Go Object Storage combinés. Ces valeurs ont déjà changé par le passé : relire la page officielle Always Free le jour de la création.

## 1. Réseau

Dans `Networking > Virtual Cloud Networks` :

1. `Start VCN Wizard` puis `Create VCN with Internet Connectivity`.
2. Nom : `jad-home-vcn`; plage VCN proposée par défaut.
3. Une seule subnet publique suffit. Aucun NAT Gateway n'est nécessaire.
4. Dans la Security List de la subnet, conserver la sortie stateful vers `0.0.0.0/0`.
5. Entrées stateful minimales :
   - TCP 22, source `VOTRE_IP_PUBLIQUE/32`;
   - TCP 80, source `0.0.0.0/0`;
   - TCP 443, source `0.0.0.0/0`;
   - mêmes règles 80/443 pour `::/0` uniquement si IPv6 est réellement activé.
6. Ne jamais ouvrir 4000 : Express reste local à la VM.

UFW appliquera une seconde couche avec seulement OpenSSH et `Nginx Full`.

## 2. VM A1 préférée

Dans `Compute > Instances > Create instance` :

1. Nom `jad-home-prod`, compartment choisi et Availability Domain disponible.
2. Image `Canonical Ubuntu 24.04` ARM64/aarch64.
3. Shape `VM.Standard.A1.Flex`, avec exactement 1 OCPU et 6 Go.
4. Réseau `jad-home-vcn`, subnet publique, IPv4 publique éphémère.
5. Ajouter la clé publique SSH; télécharger et protéger la clé privée.
6. Boot volume : 50 Go, performance par défaut, **sans** option payante ni volume additionnel.
7. Confirmer le badge `Always Free Eligible` et un coût nul avant `Create`.

Si la capacité A1 est indisponible, essayer une autre Availability Domain de la même Home Region et plus tard. Ne pas créer une forme payante « temporaire ». Dernier fallback : image Ubuntu x86_64, `VM.Standard.E2.1.Micro`, puis le bootstrap avec `--enable-swap`.

## 3. Bucket de sauvegarde

Dans `Storage > Object Storage & Archive Storage > Buckets` :

1. Créer `jad-home-backups` dans le même compartment.
2. Storage tier `Standard`, bucket privé, chiffrement Oracle par défaut.
3. Désactiver l'accès public, l'auto-tiering payant éventuel et les règles de rétention complexes.
4. Ne pas y placer `.env`, clé SSH, hash admin ou secret de session.
5. Surveiller que le total reste sous la franchise Always Free actuelle (20 Go combinés selon la documentation consultée).

Le script conserve huit archives hebdomadaires et leur `.sha256` sous `weekly/<date>/`.

## 4. Autoriser la VM sans clé API

Copier l'OCID de l'instance. Dans `Identity & Security > Dynamic Groups`, créer `jad-home-vm` avec :

```text
ALL {instance.id = 'OCID_DE_L_INSTANCE'}
```

Créer ensuite une policy dans le tenancy/compartment approprié, en remplaçant les noms :

```text
Allow dynamic-group jad-home-vm to read buckets in compartment NOM_COMPARTMENT
Allow dynamic-group jad-home-vm to manage objects in compartment NOM_COMPARTMENT where target.bucket.name='jad-home-backups'
Allow dynamic-group jad-home-vm to use ons-topics in compartment NOM_COMPARTMENT
```

Cette instance principal évite de stocker une clé API OCI sur le disque. Tester depuis la VM :

```bash
oci os ns get --auth instance_principal
sudo -u jad-home oci os object list --auth instance_principal --bucket-name jad-home-backups --all
```

Si la seconde commande échoue à cause du home non-login, vérifier `/usr/local/bin/oci` et les policies; ne pas élargir à `manage all-resources`.

## 5. Notifications et alarmes gratuites

Dans `Developer Services > Application Integration > Notifications` :

1. Créer un topic `jad-home-alerts`.
2. Ajouter une subscription `Email` et confirmer le lien reçu.
3. Copier l'OCID du topic dans `OCI_NOTIFICATION_TOPIC_ID`.

Dans `Observability & Management > Monitoring > Alarm Definitions`, créer une alarme d'absence de métrique pour détecter une VM arrêtée/supprimée. Advanced mode :

```text
CpuUtilization[1m]{resourceId = "OCID_DE_L_INSTANCE"}.groupBy(resourceId).absent(10m)
```

Pending duration : 1 minute; severity `Critical`; destination : topic `jad-home-alerts`; repeat notification : 24 h. Cette alarme complète le timer local qui teste `/api/health`, `/api/ready`, Nginx, systemd, le disque à 75 % et l'âge des backups toutes les dix minutes.

Ne pas créer OCI Health Checks Basic/Premium sans vérifier le prix courant : le tarif public peut être non nul. Le monitoring local et l'alarme d'absence évitent ce coût. Aucun check ne doit servir à fabriquer de l'activité pour empêcher une récupération Oracle.

## 6. Contrôle mensuel du coût

Chaque mois :

1. `Billing & Cost Management > Cost Analysis`: période mois courant, coût total `0`.
2. `Billing > Invoices`: aucune facture due.
3. `Limits, Quotas and Usage`: aucune ressource hors franchise.
4. `Compute > Instances`: une seule VM, shape et badge attendus.
5. `Block Storage > Boot Volumes`: un seul volume de 50 Go attaché.
6. `Object Storage`: taille sous 20 Go et seulement les huit dernières semaines.
7. Vérifier qu'aucun service d'essai n'a été activé.

## 7. Télécharger une copie hors Oracle

Dans le bucket, ouvrir le dossier `weekly`, le dernier sous-dossier, puis télécharger les deux objets `.tar.gz` et `.tar.gz.sha256`. Les conserver chiffrés sur le PC ou un disque externe. Tester localement sous Linux/WSL :

```bash
sha256sum -c jad-home-weekly-YYYYMMDDTHHMMSSZ.tar.gz.sha256
tar -tzf jad-home-weekly-YYYYMMDDTHHMMSSZ.tar.gz >/dev/null
```

Le mot de passe admin et `SESSION_SECRET` ne font pas partie de l'archive; les conserver dans un gestionnaire de mots de passe.

## Sources à relire au moment du déploiement

- [Oracle Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Oracle — Managing Regions](https://docs.oracle.com/en-us/iaas/Content/Identity/Tasks/managingregions.htm)
- [Oracle Object Storage overview](https://docs.oracle.com/en-us/iaas/Content/Object/Concepts/objectstorageoverview.htm)
- [Oracle — Creating an absence alarm](https://docs.oracle.com/en-us/iaas/Content/Monitoring/Tasks/create-alarm-absence.htm)
- [Oracle Observability pricing](https://www.oracle.com/manageability/pricing/)
> ARCHIVE D'INFRASTRUCTURE JAD HOME — non applicable au déploiement Netlify de BELGA WOOD.
