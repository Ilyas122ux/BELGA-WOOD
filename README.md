# BELGA WOOD

Site portfolio et administration pour BELGA WOOD. Le backend Express utilise un Google Spreadsheet privé comme base métier et Cloudinary pour les images. Le navigateur ne reçoit jamais les identifiants Google, le secret Cloudinary ni le mot de passe administrateur.

## Démarrage

```bash
npm install
copy .env.example .env
npm run dev
```

Renseignez toutes les valeurs vides de `.env`. Utilisez un `SESSION_SECRET` aléatoire d'au moins 32 caractères. L'administration est accessible sous `/admin/connexion`.

`ADMIN_PASSWORD_HASH` contient uniquement un hash bcrypt produit par `npm run hash-password`; le mot de passe en clair ne doit jamais être stocké dans les fichiers du projet. `SITE_URL` doit contenir l'origine publique finale en HTTPS, sans chemin. Elle alimente les URL canoniques, OpenGraph, données structurées, liens produit WhatsApp et sitemap.

## Créer le Google Sheet privé

1. Créez un projet dans Google Cloud Console.
2. Activez **Google Sheets API** pour ce projet.
3. Créez un compte de service dans **IAM et administration → Comptes de service**.
4. Créez une clé JSON pour ce compte de service et téléchargez-la.
5. Encodez le contenu JSON complet en Base64, puis placez uniquement cette chaîne dans `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`.
6. Créez un nouveau Google Spreadsheet privé dédié à BELGA WOOD.
7. Partagez ce Spreadsheet avec l'adresse `client_email` du compte de service, avec le rôle **Éditeur**. Le document ne doit pas être rendu public.
8. Depuis une URL `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`, copiez uniquement `SPREADSHEET_ID` dans `GOOGLE_SHEETS_SPREADSHEET_ID`.
9. Démarrez l'API. Elle crée automatiquement les onglets, en-têtes, catégories, services et réglages sûrs manquants.

Sous PowerShell, pour encoder la clé sans l'afficher :

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('service-account.json')) | Set-Clipboard
```

## Onglets gérés

- `Products`
- `ProductImages`
- `Projects`
- `Categories`
- `Services`
- `ProjectImages`
- `Testimonials`
- `QuoteRequests`
- `Settings`

Les onglets supplémentaires restent intacts. Les données normales sont stockées dans des colonnes lisibles. Les mutations recherchent toujours un enregistrement par son UUID avant de déterminer sa ligne : le tri manuel des lignes est donc supporté.

Les lectures publiques sont mises en cache 30 secondes. Toute mutation administrative invalide immédiatement ce cache. Les lignes publiques mal formées ou sans ID sont ignorées sans faire tomber le site.

## Cloudinary

Créez un compte Cloudinary BELGA WOOD et renseignez les quatre variables correspondantes. Tous les médias restent sous `belga-wood/products`, `belga-wood/projects`, `belga-wood/services`, `belga-wood/categories` ou `belga-wood/site`. Les fichiers acceptés sont JPEG, PNG et WebP, jusqu'à 8 Mo.

## Sitemap et URL de production

Le sitemap est généré dynamiquement par `GET /sitemap.xml`. Il utilise exclusivement `SITE_URL` et les données publiques Google Sheets : produits actifs, réalisations publiées et services actifs. Les routes admin et les contenus inactifs ne sont jamais inclus. Avec une URL locale ou invalide, la route répond sans contenu afin de ne jamais publier de faux liens de production.

Sur Netlify, la redirection dédiée `/sitemap.xml` doit rester placée avant la règle SPA globale dans `netlify.toml`.

## Limitation persistante des connexions

En production Netlify, les tentatives de connexion utilisent le store Netlify Blobs `belga-wood-rate-limits`, avec lecture forte et mises à jour conditionnelles. Les clés sont des empreintes SHA-256 et ne contiennent pas l'adresse IP en clair. Le contexte Blobs est connecté dans la Function Lambda. Si le store est indisponible, la connexion échoue fermée avec une réponse temporaire plutôt que de contourner la protection. En développement local, un limiteur mémoire isolé reste actif.

## Architecture et récupération

- Google Sheets est l'unique persistance métier active.
- Cloudinary stocke les images sous `belga-wood/*`.
- Le dashboard admin gère les contenus, devis et réglages.
- Les anciens scripts JAD HOME, Excel et Oracle sont historiques et ne doivent pas être utilisés pour exploiter ou restaurer BELGA WOOD.

Pour la récupération, suivre `docs/BACKUP_GOOGLE_SHEETS.md`, `docs/GOOGLE_SHEETS_SETUP.md` et `docs/CLOUDINARY_SETUP.md`. Les secrets sont restaurés depuis le gestionnaire d'environnement Netlify, jamais depuis Git.

## Exigences de déploiement

Configurer dans Netlify : `SITE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, les deux variables Google Sheets et les quatre variables Cloudinary. Le Spreadsheet doit rester privé et partagé en rôle Éditeur uniquement avec le compte de service. Exécuter les vérifications ci-dessous avant chaque mise en production.

Les prix et images actuels restent des contenus de démonstration jusqu'à validation écrite de BELGA WOOD. Voir `CLIENT_CONTENT_CHECKLIST.md`.

## Vérification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
