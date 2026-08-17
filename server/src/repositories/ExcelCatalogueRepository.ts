import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import lockfile from 'proper-lockfile';
import writeFileAtomic from 'write-file-atomic';
import type { Category, PaginatedProducts, Product, ProductImage, Settings } from '@jad-home/shared';
import { categorySchema, productSchema } from '@jad-home/shared';
import type { CatalogueRepository, ProductFilters } from './CatalogueRepository.js';
import { cleanText, safeFileSegment } from '../utils/strings.js';

const PRODUCT_HEADERS = [
  'id', 'slug', 'name_fr', 'name_ar', 'short_description_fr', 'short_description_ar',
  'description_fr', 'description_ar', 'category_id', 'price', 'old_price', 'currency',
  'stock_quantity', 'stock_status', 'featured', 'new_arrival', 'promotion', 'active', 'colors',
  'dimensions', 'materials', 'image_1', 'image_2', 'image_3', 'image_4', 'image_5', 'image_6',
  'created_at', 'updated_at',
] as const;

const CATEGORY_HEADERS = [
  'id', 'slug', 'name_fr', 'name_ar', 'description_fr', 'description_ar', 'image',
  'display_order', 'active', 'created_at', 'updated_at',
] as const;

const SETTINGS_HEADERS = ['key', 'value', 'updated_at'] as const;

function cellValue(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('result' in value) return value.result;
    if ('text' in value) return value.text;
    if ('richText' in value) return value.richText.map((part) => part.text).join('');
  }
  return value;
}

function rowsAsRecords(sheet: ExcelJS.Worksheet): Record<string, unknown>[] {
  const headers = (sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1).map((value) => String(cellValue(value)));
  const records: Record<string, unknown>[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const record: Record<string, unknown> = {};
    headers.forEach((header, columnIndex) => { record[header] = cellValue(row.getCell(columnIndex + 1).value); });
    if (Object.values(record).some((value) => value !== '')) records.push(record);
  });
  return records;
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function productFromRecord(record: Record<string, unknown>): Product {
  const images = Array.from({ length: 6 }, (_, index) => cleanText(record[`image_${index + 1}`])).filter(Boolean);
  const stock = toNumber(record.stock_quantity);
  return {
    id: cleanText(record.id), slug: cleanText(record.slug),
    name_fr: cleanText(record.name_fr), name_ar: cleanText(record.name_ar),
    short_description_fr: cleanText(record.short_description_fr), short_description_ar: cleanText(record.short_description_ar),
    description_fr: cleanText(record.description_fr), description_ar: cleanText(record.description_ar),
    category_id: cleanText(record.category_id), price: toNumber(record.price),
    old_price: record.old_price === '' ? null : toNumber(record.old_price), currency: cleanText(record.currency) || 'MAD',
    stock_quantity: stock, stock_status: stock > 0 ? 'in_stock' : 'out_of_stock',
    featured: toBoolean(record.featured), new_arrival: toBoolean(record.new_arrival),
    promotion: toBoolean(record.promotion), active: toBoolean(record.active),
    colors: cleanText(record.colors).split('|').filter(Boolean), dimensions: cleanText(record.dimensions),
    materials: cleanText(record.materials).split('|').filter(Boolean), images,
    created_at: cleanText(record.created_at), updated_at: cleanText(record.updated_at),
  };
}

function categoryFromRecord(record: Record<string, unknown>): Category {
  return {
    id: cleanText(record.id), slug: cleanText(record.slug), name_fr: cleanText(record.name_fr),
    name_ar: cleanText(record.name_ar), description_fr: cleanText(record.description_fr),
    description_ar: cleanText(record.description_ar), image: cleanText(record.image),
    display_order: toNumber(record.display_order), active: toBoolean(record.active),
    created_at: cleanText(record.created_at), updated_at: cleanText(record.updated_at),
  };
}

function styleSheet(sheet: ExcelJS.Worksheet, widths: number[]): void {
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(widths.length).letter}1` };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFF1E6D1' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF211E1B' } };
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
}

function productRow(product: Product): ExcelJS.CellValue[] {
  return PRODUCT_HEADERS.map((header) => {
    if (header.startsWith('image_')) return imageToString(product.images[Number(header.slice(-1)) - 1]);
    if (header === 'colors' || header === 'materials') return product[header].join('|');
    return (product as unknown as Record<string, ExcelJS.CellValue>)[header];
  }) as ExcelJS.CellValue[];
}

function imageToString(image: ProductImage | undefined): string {
  if (!image) return '';
  return typeof image === 'string' ? image : image.secureUrl;
}

export class ExcelCatalogueRepository implements CatalogueRepository {
  readonly cataloguePath: string;
  readonly backupDirectory: string;

  constructor(cataloguePath: string, backupDirectory?: string) {
    this.cataloguePath = cataloguePath;
    this.backupDirectory = backupDirectory || path.join(path.dirname(cataloguePath), 'backups');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.cataloguePath), { recursive: true });
    await fs.mkdir(this.backupDirectory, { recursive: true });
    let exists = true;
    try {
      await fs.access(this.cataloguePath);
    } catch {
      exists = false;
    }
    if (exists) await this.readWorkbook();
    else await this.createInitialWorkbook();
  }

  async verifyReadable(): Promise<void> {
    await fs.access(this.cataloguePath, fs.constants.R_OK);
    await this.readWorkbook();
  }

  private async readWorkbook(filePath = this.cataloguePath): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    for (const required of ['Products', 'Categories', 'Settings']) {
      if (!workbook.getWorksheet(required)) throw new Error(`Feuille Excel manquante: ${required}`);
    }
    return workbook;
  }

  private async createInitialWorkbook(): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JAD HOME';
    workbook.created = new Date();
    const productsSheet = workbook.addWorksheet('Products');
    const categoriesSheet = workbook.addWorksheet('Categories');
    const settingsSheet = workbook.addWorksheet('Settings');
    productsSheet.addRow([...PRODUCT_HEADERS]);
    categoriesSheet.addRow([...CATEGORY_HEADERS]);
    settingsSheet.addRow([...SETTINGS_HEADERS]);

    const now = new Date().toISOString();
    const categories: Category[] = [
      ['cat-tables', 'table', 'Table', 'طاولات', 'Tables basses, consoles et pièces centrales pour structurer votre intérieur.', 'طاولات وكونسولات وقطع مركزية تنظم فضاء منزلك.', '/uploads/products/table-atlas.png', 1],
      ['cat-canapes', 'canape', 'Canapé', 'كنبات', 'Canapés confortables aux lignes généreuses, pensés pour le quotidien.', 'كنبات مريحة بخطوط رحبة مصممة للحياة اليومية.', '/uploads/products/canape-nora.png', 2],
      ['cat-salon-marocain', 'salon-marocain', 'Salon marocain', 'صالون مغربي', 'Compositions marocaines chaleureuses, élégantes et personnalisables.', 'جلسات مغربية دافئة وأنيقة قابلة للتخصيص.', '/uploads/products/canape-nora.png', 3],
      ['cat-salons', 'salon-moderne', 'Salon moderne', 'صالون عصري', 'Salons contemporains, modulaires et panoramiques pour tous les espaces.', 'صالونات عصرية ومودولارية وبانورامية تناسب مختلف المساحات.', '/uploads/products/canape-nora.png', 4],
      ['cat-lits', 'lit', 'Lit', 'أسرة', 'Lits et ensembles de chambre conçus pour un repos élégant et durable.', 'أسرة ومجموعات غرف نوم لراحة أنيقة ودائمة.', '/uploads/products/buffet-zellige.png', 5],
      ['cat-chaises', 'chaise', 'Chaise', 'كراسي', 'Chaises, fauteuils et chauffeuses alliant confort et caractère.', 'كراسي ومقاعد تجمع بين الراحة والطابع المميز.', '/uploads/products/fauteuil-kenza.png', 6],
      ['cat-tapisserie', 'matelas', 'Matelas', 'مراتب', 'Matelas sélectionnés pour un soutien équilibré et un sommeil confortable.', 'مراتب مختارة لدعم متوازن ونوم مريح.', '/uploads/products/canape-nora.png', 7],
      ['cat-rangement', 'armoire', 'Armoire', 'خزائن', 'Armoires et meubles de rangement pratiques au dessin soigné.', 'خزائن وأثاث تخزين عملي بتصميم أنيق.', '/uploads/products/buffet-zellige.png', 8],
      ['cat-deco', 'bardage', 'Bardage', 'تكسية الجدران', 'Solutions de bardage et finitions murales pour personnaliser les espaces.', 'حلول تكسية وتشطيبات جدارية لتخصيص المساحات.', '/uploads/products/table-atlas.png', 9],
    ].map(([id, slug, name_fr, name_ar, description_fr, description_ar, image, display_order]) => ({
      id: String(id), slug: String(slug), name_fr: String(name_fr), name_ar: String(name_ar),
      description_fr: String(description_fr), description_ar: String(description_ar), image: String(image),
      display_order: Number(display_order), active: true, created_at: now, updated_at: now,
    }));
    categories.forEach((category) => categoriesSheet.addRow(CATEGORY_HEADERS.map((header) => category[header])));

    const demo = (partial: Partial<Product> & Pick<Product, 'id' | 'slug' | 'name_fr' | 'name_ar' | 'category_id' | 'price' | 'images'>): Product => ({
      short_description_fr: 'Produit de démonstration — collection JAD HOME.',
      short_description_ar: 'منتج تجريبي — مجموعة جاد هوم.',
      description_fr: 'Une pièce sélectionnée pour son équilibre entre confort, lignes contemporaines et matières chaleureuses. Modèle de démonstration à personnaliser depuis le dashboard.',
      description_ar: 'قطعة مختارة تجمع بين الراحة والخطوط المعاصرة والخامات الدافئة. نموذج تجريبي قابل للتعديل من لوحة التحكم.',
      currency: 'MAD', old_price: null, stock_quantity: 8, stock_status: 'in_stock', featured: false,
      new_arrival: false, promotion: false, active: true, colors: ['Ivoire'], dimensions: 'À confirmer',
      materials: ['Bois', 'Tissu'], created_at: now, updated_at: now, ...partial,
    });
    const products: Product[] = [
      demo({ id: 'prd-nora', slug: 'canape-nora', name_fr: 'Canapé Nora', name_ar: 'أريكة نورا', category_id: 'cat-canapes', price: 7490, old_price: 8290, featured: true, promotion: true, colors: ['Ivoire', 'Sable'], dimensions: '220 × 94 × 76 cm', materials: ['Bouclé', 'Bois massif'], images: ['/uploads/products/canape-nora.png'] }),
      demo({ id: 'prd-atlas', slug: 'table-basse-atlas', name_fr: 'Table basse Atlas', name_ar: 'طاولة أطلس', category_id: 'cat-tables', price: 2690, new_arrival: true, featured: true, colors: ['Travertin'], dimensions: '120 × 70 × 35 cm', materials: ['Travertin', 'Noyer'], images: ['/uploads/products/table-atlas.png'] }),
      demo({ id: 'prd-kenza', slug: 'fauteuil-kenza', name_fr: 'Fauteuil Kenza', name_ar: 'كرسي كنزة', category_id: 'cat-chaises', price: 3190, old_price: 3650, promotion: true, featured: true, colors: ['Caramel', 'Écru'], dimensions: '78 × 82 × 76 cm', materials: ['Bouclé', 'Noyer'], images: ['/uploads/products/fauteuil-kenza.png'] }),
      demo({ id: 'prd-zellige', slug: 'buffet-zellige', name_fr: 'Buffet Zellige', name_ar: 'خزانة زليج', category_id: 'cat-rangement', price: 4590, new_arrival: true, colors: ['Noyer foncé'], dimensions: '180 × 45 × 78 cm', materials: ['Noyer', 'Métal'], images: ['/uploads/products/buffet-zellige.png'] }),
      demo({ id: 'prd-safa', slug: 'salon-safa', name_fr: 'Salon Safa', name_ar: 'صالون صفا', category_id: 'cat-salons', price: 12490, old_price: 13990, featured: true, promotion: true, colors: ['Écru', 'Taupe'], dimensions: 'Composition 5 places', materials: ['Bouclé', 'Bois massif'], images: ['/uploads/products/canape-nora.png', '/uploads/products/fauteuil-kenza.png'] }),
      demo({ id: 'prd-azur', slug: 'table-azur', name_fr: 'Table Azur', name_ar: 'طاولة أزور', category_id: 'cat-tables', price: 1890, new_arrival: true, colors: ['Crème'], dimensions: '90 × 60 × 38 cm', materials: ['Pierre', 'Bois'], images: ['/uploads/products/table-atlas.png'] }),
      demo({ id: 'prd-amal', slug: 'chauffeuse-amal', name_fr: 'Chauffeuse Amal', name_ar: 'مقعد أمل', category_id: 'cat-chaises', price: 2290, stock_quantity: 0, stock_status: 'out_of_stock', colors: ['Terracotta'], dimensions: '72 × 80 × 70 cm', materials: ['Tissu', 'Mousse HR'], images: ['/uploads/products/fauteuil-kenza.png'] }),
      demo({ id: 'prd-dar', slug: 'console-dar', name_fr: 'Console Dar', name_ar: 'كونسول دار', category_id: 'cat-tables', price: 3490, featured: true, colors: ['Noyer'], dimensions: '140 × 38 × 78 cm', materials: ['Noyer', 'Métal'], images: ['/uploads/products/buffet-zellige.png'] }),
    ];
    products.forEach((product) => productsSheet.addRow(productRow(product)));

    const settings: Settings = {
      business_name: 'JAD HOME', slogan: 'Tout pour votre tapisserie', whatsapp_number: process.env.WHATSAPP_DEFAULT_NUMBER || '212648937007',
      phone_number: '+212 648-937007', email: 'bonjour@jadhome.ma',
      address: 'Adresse de démonstration — Casablanca, Maroc', instagram_url: 'https://instagram.com/',
      facebook_url: 'https://facebook.com/', tiktok_url: 'https://tiktok.com/',
      delivery_text_fr: 'Livraison partout au Maroc. Délais confirmés lors de la commande.',
      delivery_text_ar: 'التوصيل متاح في جميع أنحاء المغرب. يتم تأكيد المدة عند الطلب.',
      currency: 'MAD', delivery_fee: '0', default_language: 'fr',
    };
    Object.entries(settings).forEach(([key, value]) => settingsSheet.addRow([key, value, now]));
    styleSheet(productsSheet, PRODUCT_HEADERS.map((header) => header.includes('description') ? 34 : header.startsWith('image') ? 30 : 18));
    styleSheet(categoriesSheet, CATEGORY_HEADERS.map((header) => header.includes('description') ? 34 : 20));
    styleSheet(settingsSheet, [28, 72, 26]);
    await workbook.xlsx.writeFile(this.cataloguePath);
  }

  private async pruneBackups(): Promise<void> {
    const names = (await fs.readdir(this.backupDirectory)).filter((name) => name.endsWith('.xlsx')).sort().reverse();
    await Promise.all(names.slice(20).map((name) => fs.unlink(path.join(this.backupDirectory, name))));
  }

  private async createBackupUnlocked(): Promise<string> {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `jad-home-${stamp}.xlsx`;
    await fs.copyFile(this.cataloguePath, path.join(this.backupDirectory, name));
    await this.pruneBackups();
    return name;
  }

  async createBackup(): Promise<string> {
    const release = await lockfile.lock(this.cataloguePath, { realpath: false, retries: { retries: 8, factor: 1.5, minTimeout: 60 } });
    try { return await this.createBackupUnlocked(); } finally { await release(); }
  }

  private async write(mutator: (workbook: ExcelJS.Workbook) => void | Promise<void>): Promise<void> {
    const release = await lockfile.lock(this.cataloguePath, { realpath: false, retries: { retries: 12, factor: 1.4, minTimeout: 50 } });
    const tempPath = `${this.cataloguePath}.${crypto.randomUUID()}.tmp.xlsx`;
    try {
      await this.createBackupUnlocked();
      const workbook = await this.readWorkbook();
      await mutator(workbook);
      await workbook.xlsx.writeFile(tempPath);
      await this.readWorkbook(tempPath);
      const buffer = await fs.readFile(tempPath);
      await writeFileAtomic(this.cataloguePath, buffer);
    } finally {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
      await release();
    }
  }

  async listProducts(filters: ProductFilters = {}): Promise<PaginatedProducts> {
    const workbook = await this.readWorkbook();
    const categories = rowsAsRecords(workbook.getWorksheet('Categories')!).map(categoryFromRecord);
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    let products = rowsAsRecords(workbook.getWorksheet('Products')!).map(productFromRecord);
    if (!filters.admin) products = products.filter((product) => product.active);
    if (filters.active !== undefined) products = products.filter((product) => product.active === filters.active);
    if (filters.category) {
      const category = categories.find((item) => item.slug === filters.category || item.id === filters.category);
      products = products.filter((product) => product.category_id === category?.id);
    }
    if (filters.search) {
      const term = filters.search.toLocaleLowerCase();
      products = products.filter((product) => [product.name_fr, product.name_ar, product.description_fr].some((value) => value.toLocaleLowerCase().includes(term)));
    }
    if (filters.minPrice !== undefined) products = products.filter((product) => product.price >= filters.minPrice!);
    if (filters.maxPrice !== undefined) products = products.filter((product) => product.price <= filters.maxPrice!);
    if (filters.inStock) products = products.filter((product) => product.stock_quantity > 0);
    if (filters.featured) products = products.filter((product) => product.featured);
    if (filters.promotion) products = products.filter((product) => product.promotion);
    if (filters.newArrival) products = products.filter((product) => product.new_arrival);
    const sorters: Record<string, (a: Product, b: Product) => number> = {
      newest: (a, b) => b.created_at.localeCompare(a.created_at), price_asc: (a, b) => a.price - b.price,
      price_desc: (a, b) => b.price - a.price, name_asc: (a, b) => a.name_fr.localeCompare(b.name_fr),
      promotions: (a, b) => Number(b.promotion) - Number(a.promotion), recommended: (a, b) => Number(b.featured) - Number(a.featured),
    };
    products.sort(sorters[filters.sort || 'recommended'] || sorters.recommended);
    products = products.map((product) => ({ ...product, category: categoryById.get(product.category_id) }));
    const total = products.length;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 12));
    return { items: products.slice((page - 1) * limit, page * limit), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  async getProduct(identifier: string, includeInactive = false): Promise<Product | undefined> {
    const result = await this.listProducts({ admin: includeInactive, limit: 100 });
    return result.items.find((product) => product.id === identifier || product.slug === identifier);
  }

  async createProduct(input: unknown, images: ProductImage[] = []): Promise<Product> {
    const parsed = productSchema.parse(input);
    const existing = await this.listProducts({ admin: true, limit: 100 });
    if (existing.items.some((product) => product.slug === parsed.slug)) throw new Error('Ce slug est déjà utilisé.');
    const now = new Date().toISOString();
    const product: Product = {
      id: crypto.randomUUID(), ...parsed, old_price: parsed.old_price ?? null,
      stock_status: parsed.stock_quantity > 0 ? 'in_stock' : 'out_of_stock',
      images: [...parsed.existing_images, ...images].slice(0, 6), created_at: now, updated_at: now,
    };
    await this.write((workbook) => { workbook.getWorksheet('Products')!.addRow(productRow(product)); });
    return product;
  }

  async updateProduct(id: string, input: unknown, images: ProductImage[] = []): Promise<Product> {
    const parsed = productSchema.parse(input);
    const existing = await this.listProducts({ admin: true, limit: 100 });
    const previous = existing.items.find((product) => product.id === id);
    if (!previous) throw new Error('Produit introuvable.');
    if (existing.items.some((product) => product.id !== id && product.slug === parsed.slug)) throw new Error('Ce slug est déjà utilisé.');
    const product: Product = {
      ...previous, ...parsed, old_price: parsed.old_price ?? null,
      stock_status: parsed.stock_quantity > 0 ? 'in_stock' : 'out_of_stock',
      images: [...parsed.existing_images, ...images].slice(0, 6), updated_at: new Date().toISOString(),
    };
    await this.write((workbook) => {
      const sheet = workbook.getWorksheet('Products')!;
      const recordIndex = rowsAsRecords(sheet).findIndex((record) => cleanText(record.id) === id);
      if (recordIndex < 0) throw new Error('Produit introuvable.');
      sheet.getRow(recordIndex + 2).values = productRow(product);
    });
    return product;
  }

  async patchProduct(id: string, patch: Partial<Pick<Product, 'active' | 'featured' | 'new_arrival' | 'promotion'>>): Promise<Product> {
    const previous = await this.getProduct(id, true);
    if (!previous) throw new Error('Produit introuvable.');
    const updated = { ...previous, ...patch, updated_at: new Date().toISOString() };
    await this.write((workbook) => {
      const sheet = workbook.getWorksheet('Products')!;
      const index = rowsAsRecords(sheet).findIndex((record) => cleanText(record.id) === id);
      sheet.getRow(index + 2).values = productRow(updated);
    });
    return updated;
  }

  async deactivateProduct(id: string): Promise<Product> { return this.patchProduct(id, { active: false }); }

  async listCategories(includeInactive = false): Promise<Category[]> {
    const workbook = await this.readWorkbook();
    const products = rowsAsRecords(workbook.getWorksheet('Products')!).map(productFromRecord);
    return rowsAsRecords(workbook.getWorksheet('Categories')!).map(categoryFromRecord)
      .filter((category) => includeInactive || category.active)
      .map((category) => ({ ...category, product_count: products.filter((product) => product.active && product.category_id === category.id).length }))
      .sort((a, b) => a.display_order - b.display_order);
  }

  async createCategory(input: unknown): Promise<Category> {
    const parsed = categorySchema.parse(input);
    const existing = await this.listCategories(true);
    if (existing.some((category) => category.slug === parsed.slug)) throw new Error('Ce slug de catégorie est déjà utilisé.');
    const now = new Date().toISOString();
    const category: Category = { id: crypto.randomUUID(), ...parsed, created_at: now, updated_at: now };
    await this.write((workbook) => { workbook.getWorksheet('Categories')!.addRow(CATEGORY_HEADERS.map((header) => category[header])); });
    return category;
  }

  async updateCategory(id: string, input: unknown): Promise<Category> {
    const parsed = categorySchema.parse(input);
    const existing = await this.listCategories(true);
    const previous = existing.find((category) => category.id === id);
    if (!previous) throw new Error('Catégorie introuvable.');
    if (existing.some((category) => category.id !== id && category.slug === parsed.slug)) throw new Error('Ce slug de catégorie est déjà utilisé.');
    const category: Category = { ...previous, ...parsed, updated_at: new Date().toISOString() };
    await this.write((workbook) => {
      const sheet = workbook.getWorksheet('Categories')!;
      const index = rowsAsRecords(sheet).findIndex((record) => cleanText(record.id) === id);
      sheet.getRow(index + 2).values = CATEGORY_HEADERS.map((header) => category[header]);
    });
    return category;
  }

  async deactivateCategory(id: string): Promise<Category> {
    const categories = await this.listCategories(true);
    const category = categories.find((item) => item.id === id);
    if (!category) throw new Error('Catégorie introuvable.');
    if ((category.product_count || 0) > 0) throw new Error('Cette catégorie contient des produits actifs.');
    return this.updateCategory(id, { ...category, active: false });
  }

  async getSettings(): Promise<Settings> {
    const workbook = await this.readWorkbook();
    return Object.fromEntries(rowsAsRecords(workbook.getWorksheet('Settings')!).map((record) => [cleanText(record.key), cleanText(record.value)]));
  }

  async updateSettings(input: Record<string, unknown>): Promise<Settings> {
    const allowed = ['business_name', 'slogan', 'whatsapp_number', 'phone_number', 'email', 'address', 'instagram_url', 'facebook_url', 'tiktok_url', 'delivery_text_fr', 'delivery_text_ar', 'currency', 'delivery_fee', 'default_language'];
    const clean = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.includes(key)).map(([key, value]) => [key, cleanText(value)]));
    await this.write((workbook) => {
      const sheet = workbook.getWorksheet('Settings')!;
      const current = rowsAsRecords(sheet);
      for (const [key, value] of Object.entries(clean)) {
        const index = current.findIndex((record) => cleanText(record.key) === key);
        if (index >= 0) sheet.getRow(index + 2).values = [key, value, new Date().toISOString()];
        else sheet.addRow([key, value, new Date().toISOString()]);
      }
    });
    return this.getSettings();
  }

  async listBackups(): Promise<{ name: string; size: number; date: string }[]> {
    const names = (await fs.readdir(this.backupDirectory)).filter((name) => name.endsWith('.xlsx') && safeFileSegment(name));
    const files = await Promise.all(names.map(async (name) => {
      const stat = await fs.stat(path.join(this.backupDirectory, name));
      return { name, size: stat.size, date: stat.mtime.toISOString() };
    }));
    return files.sort((a, b) => b.date.localeCompare(a.date));
  }

  getBackupPath(name: string): string {
    if (!safeFileSegment(name) || !name.endsWith('.xlsx')) throw new Error('Nom de sauvegarde invalide.');
    return path.join(this.backupDirectory, name);
  }

  async restoreBackup(name: string): Promise<void> {
    const backupPath = this.getBackupPath(name);
    await this.readWorkbook(backupPath);
    const release = await lockfile.lock(this.cataloguePath, { realpath: false, retries: 8 });
    try {
      await this.createBackupUnlocked();
      const buffer = await fs.readFile(backupPath);
      await writeFileAtomic(this.cataloguePath, buffer);
      await this.readWorkbook();
    } finally { await release(); }
  }
}
