#!/usr/bin/env node
import './load-env.mjs';
import { ensureSheets, getSheetsClientFromEnv, ORDERS_HEADERS, SHEETS } from './sheets-lib.mjs';

const apply = process.argv.includes('--apply');
const required = ['GOOGLE_SHEETS_SPREADSHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_JSON_BASE64'];
const missing = required.filter((name) => !process.env[name] || process.env[name] === 'CHANGE_ME');
console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  required,
  missing,
  sheets: SHEETS,
  orders: {
    action: 'create-if-missing',
    schemaVersion: 1,
    columns: ORDERS_HEADERS,
  },
}, null, 2));
if (!apply) process.exit(0);
if (missing.length) throw new Error(`Variables manquantes: ${missing.join(', ')}`);
const client = getSheetsClientFromEnv();
await ensureSheets(client);
console.log('Google Sheets initialise/verifie sans suppression de donnees existantes.');
