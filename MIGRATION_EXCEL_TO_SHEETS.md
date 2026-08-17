# Migration Excel vers Google Sheets

Ne jamais lancer `npm run seed` sur les donnees reelles.

1. Verifier les donnees locales:
   `npm run migrate:excel-to-sheets -- --dry-run`
2. Corriger toute image manquante ou slug invalide.
3. Configurer les variables Google dans un environnement local temporaire.
4. Lancer seulement apres validation:
   `npm run migrate:excel-to-sheets -- --apply`
5. Conserver le manifest `.tmp/migrations/*`.
6. Comparer les nombres produits/categories/parametres avant et apres.

La migration est idempotente par les IDs existants. Les fichiers Excel, uploads et backups locaux ne sont pas supprimes.
