#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';

const cataloguePath = process.argv[2];
if (!cataloguePath) {
  console.error('Usage: node scripts/validate-catalogue.mjs <catalogue.xlsx>');
  process.exit(2);
}

const required = {
  Products: ['id', 'slug', 'name_fr', 'name_ar', 'category_id', 'price', 'image_1'],
  Categories: ['id', 'slug', 'name_fr', 'name_ar', 'active'],
  Settings: ['key', 'value'],
};

try {
  const stat = await fs.stat(cataloguePath);
  if (!stat.isFile() || stat.size < 100) throw new Error('fichier absent, vide ou trop petit');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(cataloguePath);
  const rows = {};
  for (const [sheetName, expectedHeaders] of Object.entries(required)) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) throw new Error(`feuille manquante: ${sheetName}`);
    const headers = sheet.getRow(1).values.slice(1).map(String);
    const missing = expectedHeaders.filter((header) => !headers.includes(header));
    if (missing.length) throw new Error(`${sheetName}: colonnes manquantes: ${missing.join(', ')}`);
    rows[sheetName] = Math.max(0, sheet.actualRowCount - 1);
  }
  console.log(JSON.stringify({ valid: true, path: path.resolve(cataloguePath), size: stat.size, rows }));
} catch (error) {
  console.error(JSON.stringify({ valid: false, path: path.resolve(cataloguePath), error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
}
