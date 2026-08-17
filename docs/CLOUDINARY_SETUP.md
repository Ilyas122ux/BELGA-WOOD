# Cloudinary Setup

1. Creer un compte Cloudinary.
2. Recuperer Cloud Name, API Key et API Secret.
3. Configurer Netlify:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `CLOUDINARY_FOLDER=belga-wood`
4. Ne jamais exposer `CLOUDINARY_API_SECRET` dans le frontend.
5. Dossiers utilises:
   - `belga-wood/products`
   - `belga-wood/projects`
   - `belga-wood/categories`
   - `belga-wood/services`
   - `belga-wood/site`
6. Formats acceptes: JPG, JPEG, PNG, WebP.
7. Limite: 8 Mo par image.
8. Tester un upload authentifie depuis le dashboard.
9. Verifier que le navigateur ne recoit jamais l'API Secret.
10. Tester une suppression protegee.
11. Surveiller les credits mensuels Cloudinary.
