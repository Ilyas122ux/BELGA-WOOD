# Cloudflare Free pour JAD HOME

Cette étape est optionnelle et suppose un domaine déjà payé/disponible. Ne souscrire à aucun add-on.

1. Ajouter le domaine au plan `Free` et remplacer les nameservers chez le registrar.
2. Créer `A @ -> IP_VM` et éventuellement `CNAME www -> @`. Commencer en `DNS only` pour Certbot.
3. Après `certbot --nginx` et `certbot renew --dry-run`, activer le proxy orange.
4. Dans `SSL/TLS > Overview`, choisir `Full (strict)`. Ne jamais choisir Flexible.
5. Dans `Edge Certificates`, activer `Always Use HTTPS` et `Automatic HTTPS Rewrites`; minimum TLS 1.2.
6. Vérifier `https://domaine/api/health` et le dashboard.

Choisir un seul nom canonique (par exemple le domaine sans `www`) correspondant exactement à `CLIENT_URL`, puis créer une Redirect Rule gratuite de `www` vers ce nom. Cela garde la protection Origin/CSRF cohérente pour le dashboard.

Créer les Cache Rules gratuites dans cet ordre :

1. Bypass cache si
   `(http.request.uri.path starts_with "/api/") or (http.request.uri.path starts_with "/admin")`.
2. Cache eligible pour les fichiers versionnés `/assets/` et les images `/uploads/`; conserver les TTL d'origine Nginx et ne pas utiliser `Cache Everything` sur les pages HTML.

Activer uniquement les protections gratuites affichées comme telles, par exemple Browser Integrity Check. Le rate limiting principal du login existe déjà dans Express et Nginx. Après toute modification, contrôler dans un navigateur privé qu'une réponse `/api` possède `Cache-Control: no-store` et qu'une page admin n'est jamais servie depuis le cache.

Sources : [Cloudflare Full (strict)](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/), [Cloudflare Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/), [création d'une Cache Rule](https://developers.cloudflare.com/cache/how-to/cache-rules/create-dashboard/).
