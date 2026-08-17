# Securite Serverless

- Google Sheet prive, accessible seulement au Service Account.
- Aucun secret dans le frontend.
- Cloudinary upload signe par Function protegee.
- Cookie admin `HttpOnly`, `SameSite=Lax`, `Secure` en production.
- JWT expire apres 8 heures.
- `ADMIN_SESSION_VERSION` invalide toutes les anciennes sessions.
- Verification Origin pour mutations admin/auth.
- Rate limiting persistant via Netlify Blobs en production.
- Valeurs Google Sheets envoyees en RAW avec protection formula injection.
- Validation Zod sur les entrees produits, categories, login et checkout.
- Validation prix/stock cote API avant WhatsApp.
