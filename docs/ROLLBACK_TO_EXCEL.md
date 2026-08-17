# Rollback temporaire vers Excel local

Tant que la migration Netlify n'est pas validee:

1. Conserver `ExcelCatalogueRepository`.
2. Conserver `server/storage/jad-home-catalogue.xlsx`.
3. Conserver `server/storage/uploads`.
4. Conserver `server/storage/backups`.
5. Configurer:
   `CATALOGUE_BACKEND=excel`
6. Lancer:
   `npm run dev`

Ne pas supprimer les scripts Oracle tant que le client n'a pas valide la nouvelle architecture.
> DOCUMENT HISTORIQUE JAD HOME — ne pas activer ce rollback pour BELGA WOOD. Google Sheets est la persistance active unique.
