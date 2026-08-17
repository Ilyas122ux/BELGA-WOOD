# Monitoring à 0 DH

Trois couches complémentaires sont prévues :

1. Le timer systemd `jad-home-monitor.timer` vérifie toutes les dix minutes l'API locale, readiness, systemd, Nginx, le disque < 75 % et un daily âgé de moins de 36 h. Son échec publie vers OCI Notifications.
2. Une alarme OCI `CpuUtilization.absent(10m)` prévient si la VM n'émet plus de métriques (arrêt/suppression).
3. Un seul moniteur HTTP externe UptimeRobot Free vérifie le chemin public à travers DNS/Cloudflare, ce que les deux couches locales ne peuvent pas voir.

## Moniteur HTTP externe

Au 21 juillet 2026, la page officielle UptimeRobot affiche un plan Free à 0 USD, sans carte, avec checks de cinq minutes. Vérifier à nouveau ces conditions avant l'inscription; si une carte ou un paiement est demandé, ne pas continuer.

1. Créer un compte Free avec l'email du propriétaire.
2. `New monitor` > type `HTTP(s)`.
3. Friendly name `JAD HOME health`.
4. URL `https://DOMAINE/api/health`.
5. Monitoring interval `5 minutes`.
6. Ajouter seulement l'email du propriétaire comme contact d'alerte.
7. Déclencher un test contrôlé en arrêtant l'API moins de dix minutes, confirmer l'alerte, puis redémarrer :

```bash
sudo systemctl stop jad-home
# attendre l'alerte externe
sudo systemctl start jad-home
curl -fsS https://DOMAINE/api/health
```

Ne pas surveiller les pages catalogue, ne pas multiplier les moniteurs et ne pas réduire l'intervalle. Ces requêtes servent uniquement à détecter une panne publique; elles ne doivent jamais être présentées comme un moyen de contourner la politique d'inactivité Oracle.

Source : [UptimeRobot Free plan](https://uptimerobot.com/pricing/) et [explication officielle du plan Free](https://help.uptimerobot.com/en/articles/11604710-who-should-use-uptimerobot-s-free-plan).
