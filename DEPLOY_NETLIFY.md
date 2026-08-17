# Deploiement Netlify BELGA WOOD

Ce guide prepare le deploiement Netlify sans lancer de deploiement depuis Codex.

1. Creer un compte Netlify et connecter le repository Git.
2. Configurer le build:
   - Build command: `npm run build`
   - Publish directory: `client/dist`
   - Functions directory: `netlify/functions`
3. Ajouter les variables d'environnement Netlify depuis `.env.production.example`.
4. Renseigner uniquement des secrets reels dans Netlify, jamais dans Git:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD_HASH`
   - `SESSION_SECRET`
   - `ADMIN_SESSION_VERSION`
   - `GOOGLE_SHEETS_SPREADSHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
5. Executer localement `npm run deploy:check`.
6. Lancer le premier deploy depuis Netlify.
7. Ajouter le domaine personnalise, puis activer HTTPS Netlify.
8. Tester:
   - `/api/health`
   - `/api/ready`
   - catalogue
   - dashboard
   - Google Sheets prive
   - upload Cloudinary signe
   - panier et WhatsApp

Surveiller les quotas gratuits Netlify Functions, Google Sheets API et Cloudinary.
