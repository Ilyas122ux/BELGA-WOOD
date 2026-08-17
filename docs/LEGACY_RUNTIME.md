# Périmètre historique isolé

Le runtime actif BELGA WOOD est limité à `client/src/belga`, `server/src/belga`, `server/src/app.ts` et `netlify/functions/api.mts`. Il utilise Google Sheets et Cloudinary.

Les pages e-commerce, panier, commandes, repositories Excel, scripts Oracle, imports JAD HOME et anciens tests associés sont conservés uniquement comme historique. Ils ne sont importés ni par `client/src/App.tsx`, ni par l'application Express BELGA WOOD, ni par la Function Netlify active.

`exceljs` et `sharp` restent installés uniquement parce que ces scripts et tests historiques les importent encore. Les retirer sans archiver simultanément tout ce périmètre casserait ces outils. Ils doivent être supprimés ensemble dans une opération d'archivage dédiée, jamais réactivés dans le runtime BELGA WOOD.
