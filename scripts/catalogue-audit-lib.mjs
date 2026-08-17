import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';

export async function sha256(file) {
  return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex').toUpperCase();
}

export async function readCatalogue(file = 'server/storage/jad-home-catalogue.xlsx') {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  for (const sheet of ['Products', 'Categories', 'Settings']) {
    if (!workbook.getWorksheet(sheet)) throw new Error(`Feuille manquante: ${sheet}`);
  }
  const rows = (sheetName) => {
    const sheet = workbook.getWorksheet(sheetName);
    const headers = sheet.getRow(1).values.slice(1).map(String);
    const records = [];
    sheet.eachRow((row, index) => {
      if (index === 1) return;
      const record = Object.fromEntries(headers.map((header, column) => [header, String(row.getCell(column + 1).value ?? '').trim()]));
      if (Object.values(record).some(Boolean)) records.push(record);
    });
    return records;
  };
  return {
    products: rows('Products'),
    categories: rows('Categories'),
    settings: rows('Settings'),
  };
}

export async function auditLocalData() {
  const cataloguePath = 'server/storage/jad-home-catalogue.xlsx';
  const catalogue = await readCatalogue(cataloguePath);
  const imageRefs = [];
  for (const product of catalogue.products) {
    for (let index = 1; index <= 6; index += 1) {
      if (product[`image_${index}`]) imageRefs.push({ owner: product.id || product.slug, path: product[`image_${index}`] });
    }
  }
  for (const category of catalogue.categories) {
    if (category.image) imageRefs.push({ owner: category.id || category.slug, path: category.image });
  }
  const missingImages = [];
  for (const ref of imageRefs) {
    if (!ref.path.startsWith('/uploads/')) continue;
    const localPath = path.join('server/storage', ref.path.replace(/^\/uploads\//, 'uploads/'));
    try { await fs.access(localPath); } catch { missingImages.push({ ...ref, localPath }); }
  }
  return {
    catalogueSha256: await sha256(cataloguePath),
    products: catalogue.products.length,
    categories: catalogue.categories.length,
    settings: catalogue.settings.length,
    imageRefs: imageRefs.length,
    missingImages,
    catalogue,
  };
}
