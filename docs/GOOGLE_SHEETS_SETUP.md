# Google Sheets Setup

1. Creer un projet Google Cloud.
2. Activer Google Sheets API.
3. Creer un Service Account dedie a BELGA WOOD.
4. Creer une cle JSON.
5. Encoder la cle:
   `base64 service-account.json`
6. Creer un fichier Google Sheets prive nomme `BELGA WOOD`.
7. Partager uniquement ce fichier avec l'email du Service Account en role Editeur.
8. Ne jamais rendre la feuille publique.
9. Copier le Spreadsheet ID depuis l'URL.
10. Configurer Netlify:
   - `GOOGLE_SHEETS_SPREADSHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`
11. Demarrer l'API et verifier `/api/ready`; l'initialisation preserve les onglets inconnus.
12. Revoquer toute ancienne cle si elle a ete exposee.
