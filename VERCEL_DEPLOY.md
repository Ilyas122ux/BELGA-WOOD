# Vercel production deployment

Deploy from the repository root. The committed `vercel.json` selects Vite,
runs `npm run build`, publishes `client/dist`, sends every `/api/*` request to
the single Express function, and sends non-API browser routes to `index.html`.

## Project settings

- Root Directory: repository root (`.`)
- Framework Preset: Vite (also enforced by `vercel.json`)
- Install Command: `npm install` (default)
- Build Command: `npm run build` (enforced by `vercel.json`)
- Output Directory: `client/dist` (enforced by `vercel.json`)
- Node.js: 22.x

## Production environment variables

Configure these as encrypted Vercel environment variables for Production:

- `SITE_URL=https://belga-wood.vercel.app`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- `SESSION_SECRET` (at least 32 characters)
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_FOLDER=belga-wood`

Do not add `.env` or a service-account JSON file to Git. Share the configured
spreadsheet with the service-account email. On first successful API cold start,
the backend initializes missing content tabs and the `SecurityEvents` tab used
for persistent login and quote throttling.
