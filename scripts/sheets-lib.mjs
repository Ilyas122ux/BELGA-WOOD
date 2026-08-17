import { google } from 'googleapis';

export const PRODUCTS_HEADERS = ['id', 'slug', 'name_fr', 'name_ar', 'short_description_fr', 'short_description_ar', 'description_fr', 'description_ar', 'category_id', 'price', 'old_price', 'currency', 'stock_quantity', 'stock_status', 'featured', 'new_arrival', 'promotion', 'active', 'colors', 'dimensions', 'materials', 'images', 'created_at', 'updated_at', 'version'];
export const CATEGORIES_HEADERS = ['id', 'slug', 'name_fr', 'name_ar', 'description_fr', 'description_ar', 'image', 'display_order', 'active', 'created_at', 'updated_at', 'version'];
export const SETTINGS_HEADERS = ['key', 'value', 'updated_at'];
export const META_HEADERS = ['key', 'value', 'updated_at'];
export const ORDERS_HEADERS = [
  'id', 'orderNumber', 'clientRequestId', 'customerName', 'customerPhone',
  'customerWhatsapp', 'customerEmail', 'city', 'address', 'additionalAddress',
  'customerNote', 'itemsJson', 'currency', 'subtotal', 'deliveryFee', 'total',
  'status', 'adminNote', 'statusHistoryJson', 'createdAt', 'updatedAt',
  'confirmedAt', 'cancelledAt', 'version',
];
export const SHEETS = ['Products', 'Categories', 'Settings', 'Meta', 'Orders'];

export function safeCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function jsonCell(value) {
  return safeCell(JSON.stringify(value ?? []));
}

export function getSheetsClientFromEnv() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!spreadsheetId || spreadsheetId === 'CHANGE_ME') throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID est requis.');
  if (!encoded || encoded === 'CHANGE_ME') throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 est requis.');
  const credentials = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return { spreadsheetId, sheets: google.sheets({ version: 'v4', auth }) };
}

export async function ensureSheets({ sheets, spreadsheetId }) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set((spreadsheet.data.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean));
  const requests = SHEETS.filter((title) => !existing.has(title)).map((title) => ({ addSheet: { properties: { title } } }));
  if (requests.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: 'Products!A1:Y1', values: [PRODUCTS_HEADERS] },
        { range: 'Categories!A1:L1', values: [CATEGORIES_HEADERS] },
        { range: 'Settings!A1:C1', values: [SETTINGS_HEADERS] },
        { range: 'Meta!A1:C1', values: [META_HEADERS] },
        { range: 'Orders!A1:X1', values: [ORDERS_HEADERS] },
      ],
    },
  });
}

export async function replaceSheetRows({ sheets, spreadsheetId, sheetName, headers, rows }) {
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${sheetName}!A2:ZZ` });
  if (!rows.length) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A2`,
    valueInputOption: 'RAW',
    requestBody: {
      values: rows.map((row) => headers.map((header) => safeCell(row[header]))),
    },
  });
}
