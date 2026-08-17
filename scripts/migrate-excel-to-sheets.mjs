#!/usr/bin/env node
import './load-env.mjs';
import fs from 'node:fs/promises';
import { auditLocalData } from './catalogue-audit-lib.mjs';
import {
  CATEGORIES_HEADERS,
  META_HEADERS,
  PRODUCTS_HEADERS,
  SETTINGS_HEADERS,
  ensureSheets,
  getSheetsClientFromEnv,
  jsonCell,
  replaceSheetRows,
} from './sheets-lib.mjs';

const apply = process.argv.includes('--apply');
const dryRun = process.argv.includes('--dry-run') || !apply;
const report = await auditLocalData();
console.log(JSON.stringify({
  mode: dryRun ? 'dry-run' : 'apply',
  products: report.products,
  categories: report.categories,
  settings: report.settings,
  imageRefs: report.imageRefs,
  missingImages: report.missingImages,
  catalogueSha256: report.catalogueSha256,
}, null, 2));

if (dryRun) process.exit(report.missingImages.length ? 1 : 0);

for (const name of ['GOOGLE_SHEETS_SPREADSHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_JSON_BASE64']) {
  if (!process.env[name] || process.env[name] === 'CHANGE_ME') throw new Error(`${name} est requis pour --apply.`);
}

const client = getSheetsClientFromEnv();
await ensureSheets(client);
const now = new Date().toISOString();
const products = report.catalogue.products.map((product) => {
  const images = [];
  for (let index = 1; index <= 6; index += 1) {
    const value = product[`image_${index}`];
    if (value) images.push({
      secureUrl: value,
      publicId: '',
      width: 0,
      height: 0,
      format: '',
      bytes: 0,
      altFr: product.name_fr || '',
      altAr: product.name_ar || '',
      displayOrder: index,
    });
  }
  return {
    ...product,
    images: jsonCell(images),
    colors: product.colors || '[]',
    materials: product.materials || '[]',
    version: product.version || '1',
  };
});
const categories = report.catalogue.categories.map((category) => ({ ...category, version: category.version || '1' }));
const settings = report.catalogue.settings;
const meta = [
  { key: 'schemaVersion', value: '1', updated_at: now },
  { key: 'catalogueVersion', value: String(Date.now()), updated_at: now },
  { key: 'lastUpdatedAt', value: now, updated_at: now },
  { key: 'lastUpdatedBy', value: 'excel-to-sheets-migration', updated_at: now },
  { key: 'migrationVersion', value: 'excel-to-sheets-v1', updated_at: now },
];
await replaceSheetRows({ ...client, sheetName: 'Products', headers: PRODUCTS_HEADERS, rows: products });
await replaceSheetRows({ ...client, sheetName: 'Categories', headers: CATEGORIES_HEADERS, rows: categories });
await replaceSheetRows({ ...client, sheetName: 'Settings', headers: SETTINGS_HEADERS, rows: settings });
await replaceSheetRows({ ...client, sheetName: 'Meta', headers: META_HEADERS, rows: meta });

const manifest = {
  type: 'excel-to-sheets',
  appliedAt: new Date().toISOString(),
  sourceCatalogueSha256: report.catalogueSha256,
  products: report.products,
  categories: report.categories,
  settings: report.settings,
  note: 'Google Sheets rows replaced idempotently from the local Excel source. Local files were not modified.',
};
await fs.mkdir('.tmp/migrations', { recursive: true });
await fs.writeFile(`.tmp/migrations/excel-to-sheets-${Date.now()}.json`, JSON.stringify(manifest, null, 2));
console.log('Manifest de migration cree dans .tmp/migrations. Aucune donnee locale supprimee.');
