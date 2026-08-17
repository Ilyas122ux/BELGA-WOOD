import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import lockfile from 'proper-lockfile';
import writeFileAtomic from 'write-file-atomic';

const root = process.cwd();
const cataloguePath = path.join(root, 'server', 'storage', 'jad-home-catalogue.xlsx');
const backupDirectory = path.join(root, 'server', 'storage', 'backups');
const categoryHeaders = [
  'id', 'slug', 'name_fr', 'name_ar', 'description_fr', 'description_ar', 'image',
  'display_order', 'active', 'created_at', 'updated_at',
];
const desiredCategoryIds = new Set([
  'cat-tables', 'cat-canapes', 'cat-salon-marocain', 'cat-salons', 'cat-lits',
  'cat-chaises', 'cat-tapisserie', 'cat-rangement', 'cat-deco',
]);
const moroccanSalonSlugs = new Set([
  'salon-panoramique-riad', 'salon-angle-sahara', 'salon-panoramique-atlas',
  'salon-angle-kasbah',
]);

function records(sheet) {
  const headers = sheet.getRow(1).values.slice(1).map(String);
  const result = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const record = {};
    headers.forEach((header, columnIndex) => { record[header] = row.getCell(columnIndex + 1).text; });
    if (Object.values(record).some(Boolean)) result.push(record);
  });
  return result;
}

function imageFrom(categories, identifiers, fallback) {
  for (const identifier of identifiers) {
    const category = categories.find((item) => item.id === identifier || item.slug === identifier);
    if (category?.image) return category.image;
  }
  return fallback;
}

function destinationFor(product) {
  const slug = product.slug.toLowerCase();
  const current = product.category_id;
  if (moroccanSalonSlugs.has(slug)) return 'cat-salon-marocain';
  if (/^(table-|table-basse-|console-)/.test(slug) || current === 'cat-tables') return 'cat-tables';
  if (/^(fauteuil-|chaise-|chauffeuse-)/.test(slug) || current === 'cat-chaises') return 'cat-chaises';
  if (/^(buffet-|armoire-)/.test(slug) || current === 'cat-rangement') return 'cat-rangement';
  if (current === 'cat-canapes') return 'cat-canapes';
  if (current === 'cat-salons') return 'cat-salons';
  if (desiredCategoryIds.has(current)) return current;
  throw new Error(`Catégorie non reconnue pour le produit ${product.slug}: ${current}`);
}

async function loadWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  for (const name of ['Products', 'Categories', 'Settings']) {
    if (!workbook.getWorksheet(name)) throw new Error(`Feuille manquante: ${name}`);
  }
  return workbook;
}

await fs.mkdir(backupDirectory, { recursive: true });
const release = await lockfile.lock(cataloguePath, {
  realpath: false,
  retries: { retries: 12, factor: 1.4, minTimeout: 50 },
});
const tempPath = `${cataloguePath}.${crypto.randomUUID()}.tmp.xlsx`;

try {
  const workbook = await loadWorkbook(cataloguePath);
  const productsSheet = workbook.getWorksheet('Products');
  const categoriesSheet = workbook.getWorksheet('Categories');
  const oldCategories = records(categoriesSheet);
  const now = new Date().toISOString();
  const previousCreatedAt = (identifiers) => {
    const previous = identifiers.map((identifier) => oldCategories.find((item) => item.id === identifier || item.slug === identifier)).find(Boolean);
    return previous?.created_at || now;
  };

  const categories = [
    { id: 'cat-tables', slug: 'table', name_fr: 'Table', name_ar: 'طاولات', description_fr: 'Tables basses, consoles et pièces centrales pour structurer votre intérieur.', description_ar: 'طاولات وكونسولات وقطع مركزية تنظم فضاء منزلك.', image: imageFrom(oldCategories, ['cat-tables'], '/uploads/products/table-atlas.png'), display_order: 1, active: true, created_at: previousCreatedAt(['cat-tables']), updated_at: now },
    { id: 'cat-canapes', slug: 'canape', name_fr: 'Canapé', name_ar: 'كنبات', description_fr: 'Canapés confortables aux lignes généreuses, pensés pour le quotidien.', description_ar: 'كنبات مريحة بخطوط رحبة مصممة للحياة اليومية.', image: imageFrom(oldCategories, ['cat-canapes'], '/uploads/products/canape-nora.png'), display_order: 2, active: true, created_at: previousCreatedAt(['cat-canapes']), updated_at: now },
    { id: 'cat-salon-marocain', slug: 'salon-marocain', name_fr: 'Salon marocain', name_ar: 'صالون مغربي', description_fr: 'Compositions marocaines chaleureuses, élégantes et personnalisables.', description_ar: 'جلسات مغربية دافئة وأنيقة قابلة للتخصيص.', image: '/uploads/products/jad-collection-kasbah.webp', display_order: 3, active: true, created_at: previousCreatedAt(['cat-salon-marocain']), updated_at: now },
    { id: 'cat-salons', slug: 'salon-moderne', name_fr: 'Salon moderne', name_ar: 'صالون عصري', description_fr: 'Salons contemporains, modulaires et panoramiques pour tous les espaces.', description_ar: 'صالونات عصرية ومودولارية وبانورامية تناسب مختلف المساحات.', image: imageFrom(oldCategories, ['cat-salons'], '/uploads/products/jad-collection-dalia.webp'), display_order: 4, active: true, created_at: previousCreatedAt(['cat-salons']), updated_at: now },
    { id: 'cat-lits', slug: 'lit', name_fr: 'Lit', name_ar: 'أسرة', description_fr: 'Lits et ensembles de chambre conçus pour un repos élégant et durable.', description_ar: 'أسرة ومجموعات غرف نوم لراحة أنيقة ودائمة.', image: imageFrom(oldCategories, ['cat-lits', 'chambres-a-coucher'], '/uploads/products/buffet-zellige.png'), display_order: 5, active: true, created_at: previousCreatedAt(['cat-lits', 'chambres-a-coucher']), updated_at: now },
    { id: 'cat-chaises', slug: 'chaise', name_fr: 'Chaise', name_ar: 'كراسي', description_fr: 'Chaises, fauteuils et chauffeuses alliant confort et caractère.', description_ar: 'كراسي ومقاعد تجمع بين الراحة والطابع المميز.', image: imageFrom(oldCategories, ['cat-chaises'], '/uploads/products/fauteuil-kenza.png'), display_order: 6, active: true, created_at: previousCreatedAt(['cat-chaises']), updated_at: now },
    { id: 'cat-tapisserie', slug: 'matelas', name_fr: 'Matelas', name_ar: 'مراتب', description_fr: 'Matelas sélectionnés pour un soutien équilibré et un sommeil confortable.', description_ar: 'مراتب مختارة لدعم متوازن ونوم مريح.', image: imageFrom(oldCategories, ['chambres-a-coucher', 'cat-tapisserie'], '/uploads/products/canape-nora.png'), display_order: 7, active: true, created_at: previousCreatedAt(['cat-tapisserie']), updated_at: now },
    { id: 'cat-rangement', slug: 'armoire', name_fr: 'Armoire', name_ar: 'خزائن', description_fr: 'Armoires et meubles de rangement pratiques au dessin soigné.', description_ar: 'خزائن وأثاث تخزين عملي بتصميم أنيق.', image: imageFrom(oldCategories, ['cat-rangement'], '/uploads/products/buffet-zellige.png'), display_order: 8, active: true, created_at: previousCreatedAt(['cat-rangement']), updated_at: now },
    { id: 'cat-deco', slug: 'bardage', name_fr: 'Bardage', name_ar: 'تكسية الجدران', description_fr: 'Solutions de bardage et finitions murales pour personnaliser les espaces.', description_ar: 'حلول تكسية وتشطيبات جدارية لتخصيص المساحات.', image: imageFrom(oldCategories, ['cat-deco'], '/uploads/products/table-atlas.png'), display_order: 9, active: true, created_at: previousCreatedAt(['cat-deco']), updated_at: now },
  ];

  const productHeaders = productsSheet.getRow(1).values.slice(1).map(String);
  const categoryColumn = productHeaders.indexOf('category_id') + 1;
  const updatedAtColumn = productHeaders.indexOf('updated_at') + 1;
  if (!categoryColumn || !updatedAtColumn) throw new Error('Colonnes produit requises introuvables.');
  let reassigned = 0;
  productsSheet.eachRow((row, index) => {
    if (index === 1) return;
    const product = Object.fromEntries(productHeaders.map((header, columnIndex) => [header, row.getCell(columnIndex + 1).text]));
    if (!product.id) return;
    const destination = destinationFor(product);
    if (destination !== product.category_id) {
      row.getCell(categoryColumn).value = destination;
      row.getCell(updatedAtColumn).value = now;
      reassigned += 1;
    }
  });

  if (categoriesSheet.rowCount > 1) {
    for (let rowIndex = categoriesSheet.rowCount; rowIndex >= 2; rowIndex -= 1) {
      categoriesSheet.spliceRows(rowIndex, 1);
    }
  }
  for (const category of categories) categoriesSheet.addRow(categoryHeaders.map((header) => category[header]));

  const stamp = now.replace(/[:.]/g, '-');
  const backupName = `jad-home-${stamp}-before-category-update.xlsx`;
  await fs.copyFile(cataloguePath, path.join(backupDirectory, backupName));
  await workbook.xlsx.writeFile(tempPath);

  const verified = await loadWorkbook(tempPath);
  const verifiedCategories = records(verified.getWorksheet('Categories'));
  const verifiedProducts = records(verified.getWorksheet('Products'));
  if (verifiedCategories.length !== categories.length) {
    throw new Error(`Nombre de catégories invalide après migration: ${verifiedCategories.length} au lieu de ${categories.length} (${verifiedCategories.map((category) => category.slug).join(', ')}).`);
  }
  const verifiedIds = new Set(verifiedCategories.map((item) => item.id));
  const orphan = verifiedProducts.find((product) => !verifiedIds.has(product.category_id));
  if (orphan) throw new Error(`Produit sans catégorie après migration: ${orphan.slug}`);

  const buffer = await fs.readFile(tempPath);
  await writeFileAtomic(cataloguePath, buffer);
  console.log(JSON.stringify({ categories: verifiedCategories.map(({ id, slug, name_fr }) => ({ id, slug, name_fr })), products: verifiedProducts.length, reassigned, backup: backupName }, null, 2));
} finally {
  await fs.rm(tempPath, { force: true }).catch(() => undefined);
  await release();
}
