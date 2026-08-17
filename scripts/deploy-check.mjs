#!/usr/bin/env node
import './load-env.mjs';
import fs from 'node:fs/promises';

const requiredFiles = [
  'netlify.toml',
  'client/index.html',
  'netlify/functions/api.mts',
  'shared/dist/index.js',
  'server/dist/index.js',
  'client/dist/index.html',
];
for (const file of requiredFiles) await fs.access(file);
const envExample = await fs.readFile('.env.example', 'utf8');
for (const token of ['GOOGLE_SHEETS_SPREADSHEET_ID', 'CLOUDINARY_CLOUD_NAME', 'ADMIN_SESSION_VERSION']) {
  if (!envExample.includes(token)) throw new Error(`.env.example incomplet: ${token}`);
}
const sheetsLibrary = await fs.readFile('scripts/sheets-lib.mjs', 'utf8');
for (const token of ['Orders', 'clientRequestId', 'statusHistoryJson', "valueInputOption: 'RAW'"]) {
  if (!sheetsLibrary.includes(token)) throw new Error(`Initialisation Orders incomplète: ${token}`);
}
const dist = await fs.readdir('client/dist/assets');
if (!dist.some((name) => name.endsWith('.js'))) throw new Error('client/dist ne contient aucun bundle JavaScript. Lancez npm run build avant deploy:check.');
const bundleText = await Promise.all(dist.filter((name) => name.endsWith('.js')).map((name) => fs.readFile(`client/dist/assets/${name}`, 'utf8')));
for (const secretName of ['CLOUDINARY_API_SECRET', 'GOOGLE_SERVICE_ACCOUNT_JSON_BASE64', 'SESSION_SECRET', 'ADMIN_PASSWORD_HASH']) {
  if (bundleText.some((text) => text.includes(secretName))) throw new Error(`Secret name exposed in frontend bundle: ${secretName}`);
}
console.log('deploy:check OK');
