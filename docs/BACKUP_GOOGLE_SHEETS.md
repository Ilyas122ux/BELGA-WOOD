# Backup Google Sheets

Google Sheets n'est pas une sauvegarde unique.

Strategie gratuite:

1. Installer le script `infra/google-apps-script/weekly-backup.gs` dans Apps Script.
2. Renseigner `SOURCE_SPREADSHEET_ID`.
3. Creer un dossier Drive prive pour les copies.
4. Lancer manuellement une premiere execution.
5. Verifier que la copie n'est pas publique.
6. Creer manuellement un trigger hebdomadaire.
7. Retention recommandee: 8 copies.

Le trigger n'est jamais active automatiquement par le projet.
