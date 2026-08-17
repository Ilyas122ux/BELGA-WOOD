import crypto from 'node:crypto';
import { google, type sheets_v4 } from 'googleapis';
import type { Category, PaginatedProducts, Product, Settings } from '@jad-home/shared';
import { categorySchema, productSchema } from '@jad-home/shared';
import { env } from '../config/env.js';
import type { CatalogueRepository, ProductFilters } from './CatalogueRepository.js';
import { cleanText } from '../utils/strings.js';

const PRODUCTS = ['id', 'slug', 'name_fr', 'name_ar', 'short_description_fr', 'short_description_ar', 'description_fr', 'description_ar', 'category_id', 'price', 'old_price', 'currency', 'stock_quantity', 'stock_status', 'featured', 'new_arrival', 'promotion', 'active', 'colors', 'dimensions', 'materials', 'images', 'created_at', 'updated_at', 'version'] as const;
const CATEGORIES = ['id', 'slug', 'name_fr', 'name_ar', 'description_fr', 'description_ar', 'image', 'display_order', 'active', 'created_at', 'updated_at', 'version'] as const;
const SETTINGS = ['key', 'value', 'updated_at'] as const;
const META = ['key', 'value', 'updated_at'] as const;
const ORDERS = [
  'id', 'orderNumber', 'clientRequestId', 'customerName', 'customerPhone',
  'customerWhatsapp', 'customerEmail', 'city', 'address', 'additionalAddress',
  'customerNote', 'itemsJson', 'currency', 'subtotal', 'deliveryFee', 'total',
  'status', 'adminNote', 'statusHistoryJson', 'createdAt', 'updatedAt',
  'confirmedAt', 'cancelledAt', 'version',
] as const;
const SHEETS = ['Products', 'Categories', 'Settings', 'Meta', 'Orders'] as const;

type Row = Record<string, string>;

function safeCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function parseJsonList(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return value.split('|').map((item) => item.trim()).filter(Boolean);
  }
}

function parseImages(value: string): Product['images'] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as Product['images'] : [];
  } catch {
    return value.split('|').map((item) => item.trim()).filter(Boolean);
  }
}

function asBoolean(value: string): boolean {
  return value === 'true' || value === '1' || value.toLowerCase() === 'yes';
}

function asNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function productFromRow(row: Row): Product {
  const stock = asNumber(row.stock_quantity || row.stock || '0');
  return {
    id: cleanText(row.id),
    slug: cleanText(row.slug),
    name_fr: cleanText(row.name_fr || row.nameFr),
    name_ar: cleanText(row.name_ar || row.nameAr),
    short_description_fr: cleanText(row.short_description_fr || row.summaryFr),
    short_description_ar: cleanText(row.short_description_ar || row.summaryAr),
    description_fr: cleanText(row.description_fr || row.descriptionFr),
    description_ar: cleanText(row.description_ar || row.descriptionAr),
    category_id: cleanText(row.category_id || row.categoryId),
    price: asNumber(row.price || row.currentPrice || '0'),
    old_price: (row.old_price || row.oldPrice) ? asNumber(row.old_price || row.oldPrice || '0') : null,
    currency: cleanText(row.currency) || 'MAD',
    stock_quantity: stock,
    stock_status: stock > 0 ? 'in_stock' : 'out_of_stock',
    featured: asBoolean(row.featured || ''),
    new_arrival: asBoolean(row.new_arrival || row.newArrival || ''),
    promotion: asBoolean(row.promotion || ''),
    active: asBoolean(row.active || 'true'),
    colors: parseJsonList(row.colors || ''),
    dimensions: cleanText(row.dimensions),
    materials: parseJsonList(row.materials || ''),
    images: parseImages(row.images || ''),
    created_at: cleanText(row.created_at || row.createdAt),
    updated_at: cleanText(row.updated_at || row.updatedAt),
    version: asNumber(row.version || '1') || 1,
  };
}

function categoryFromRow(row: Row): Category {
  return {
    id: cleanText(row.id),
    slug: cleanText(row.slug),
    name_fr: cleanText(row.name_fr || row.nameFr),
    name_ar: cleanText(row.name_ar || row.nameAr),
    description_fr: cleanText(row.description_fr || row.descriptionFr),
    description_ar: cleanText(row.description_ar || row.descriptionAr),
    image: cleanText(row.image),
    display_order: asNumber(row.display_order || row.displayOrder || '0'),
    active: asBoolean(row.active || 'true'),
    created_at: cleanText(row.created_at || row.createdAt),
    updated_at: cleanText(row.updated_at || row.updatedAt),
    version: asNumber(row.version || '1') || 1,
  };
}

function productToRow(product: Product): string[] {
  return PRODUCTS.map((key) => {
    if (key === 'colors' || key === 'materials' || key === 'images') return safeCell(product[key]);
    return safeCell((product as unknown as Record<string, unknown>)[key]);
  });
}

function categoryToRow(category: Category): string[] {
  return CATEGORIES.map((key) => safeCell((category as unknown as Record<string, unknown>)[key]));
}

export class GoogleSheetsCatalogueRepository implements CatalogueRepository {
  private sheets?: sheets_v4.Sheets;

  constructor(private readonly spreadsheetId = env.googleSheetsSpreadsheetId || '', sheetsClient?: sheets_v4.Sheets) {
    this.sheets = sheetsClient;
  }

  private async client(): Promise<sheets_v4.Sheets> {
    if (this.sheets) return this.sheets;
    if (!this.spreadsheetId || !env.googleServiceAccountJsonBase64) throw new Error('Configuration Google Sheets absente.');
    const credentials = JSON.parse(Buffer.from(env.googleServiceAccountJsonBase64, 'base64').toString('utf8')) as { client_email: string; private_key: string };
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
    return this.sheets;
  }

  private async retry<T>(operation: () => Promise<T>): Promise<T> {
    let delay = 200;
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const status = Number((error as { code?: unknown; status?: unknown })?.code || (error as { status?: unknown })?.status);
        if (![429, 500, 502, 503, 504].includes(status) || attempt >= 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  async initialize(): Promise<void> {
    await this.ensureSheets();
  }

  async verifyReadable(): Promise<void> {
    await this.readRows('Meta');
  }

  private async ensureSheets(): Promise<void> {
    const sheets = await this.client();
    const current = await this.retry(() => sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId }));
    const existing = new Set(current.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean));
    const addSheetRequests = SHEETS.filter((title) => !existing.has(title)).map((title) => ({ addSheet: { properties: { title } } }));
    if (addSheetRequests.length) {
      await this.retry(() => sheets.spreadsheets.batchUpdate({ spreadsheetId: this.spreadsheetId, requestBody: { requests: addSheetRequests } }));
    }
    await this.writeHeaders();
  }

  private async writeHeaders(): Promise<void> {
    const values = [
      { range: 'Products!A1:Y1', values: [[...PRODUCTS]] },
      { range: 'Categories!A1:L1', values: [[...CATEGORIES]] },
      { range: 'Settings!A1:C1', values: [[...SETTINGS]] },
      { range: 'Meta!A1:C1', values: [[...META]] },
      { range: 'Orders!A1:X1', values: [[...ORDERS]] },
    ];
    await this.batchUpdate(values);
    const meta = await this.readRows('Meta');
    if (meta.length === 0) {
      const now = new Date().toISOString();
      await this.batchUpdate([{ range: 'Meta!A2:C6', values: [
        ['schemaVersion', '1', now],
        ['catalogueVersion', '1', now],
        ['lastUpdatedAt', now, now],
        ['lastUpdatedBy', 'system', now],
        ['migrationVersion', '0', now],
      ] }]);
    }
  }

  private async readRows(sheetName: typeof SHEETS[number]): Promise<Row[]> {
    const sheets = await this.client();
    const response = await this.retry(() => sheets.spreadsheets.values.get({ spreadsheetId: this.spreadsheetId, range: `${sheetName}!A:Z`, valueRenderOption: 'UNFORMATTED_VALUE' }));
    const values = response.data.values || [];
    const headers = (values[0] || []).map((value) => String(value));
    return values.slice(1).filter((row) => row.some((cell) => cell !== '')).map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? '')])));
  }

  private async batchUpdate(data: { range: string; values: unknown[][] }[]): Promise<void> {
    const sheets = await this.client();
    await this.retry(() => sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { valueInputOption: 'RAW', data: data.map((entry) => ({ range: entry.range, values: entry.values.map((row) => row.map(safeCell)) })) },
    }));
  }

  private async replaceSheet(sheet: 'Products' | 'Categories' | 'Settings', rows: string[][]): Promise<void> {
    const sheets = await this.client();
    await this.retry(() => sheets.spreadsheets.values.clear({ spreadsheetId: this.spreadsheetId, range: `${sheet}!A:Z` }));
    const headers = sheet === 'Products' ? PRODUCTS : sheet === 'Categories' ? CATEGORIES : SETTINGS;
    await this.batchUpdate([{ range: `${sheet}!A1`, values: [[...headers], ...rows] }]);
    await this.touchMeta(`update:${sheet}`);
  }

  private async touchMeta(lastUpdatedBy: string): Promise<void> {
    const now = new Date().toISOString();
    const current = await this.readRows('Meta');
    const values = new Map(current.map((row) => [cleanText(row.key), cleanText(row.value)]));
    values.set('schemaVersion', values.get('schemaVersion') || '1');
    values.set('catalogueVersion', String(Date.now()));
    values.set('lastUpdatedAt', now);
    values.set('lastUpdatedBy', lastUpdatedBy);
    values.set('migrationVersion', values.get('migrationVersion') || '0');
    const rows = ['schemaVersion', 'catalogueVersion', 'lastUpdatedAt', 'lastUpdatedBy', 'migrationVersion']
      .map((key) => [key, values.get(key) || '', now]);
    const sheets = await this.client();
    await this.retry(() => sheets.spreadsheets.values.clear({ spreadsheetId: this.spreadsheetId, range: 'Meta!A2:C' }));
    await this.batchUpdate([{ range: 'Meta!A2', values: rows }]);
  }

  async listProducts(filters: ProductFilters = {}): Promise<PaginatedProducts> {
    const categories = await this.listCategories(true);
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    let products = (await this.readRows('Products')).map(productFromRow);
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
    products = products.map((product) => ({ ...product, category: categoryById.get(product.category_id) }));
    products.sort((a, b) => {
      if (filters.sort === 'price_asc') return a.price - b.price;
      if (filters.sort === 'price_desc') return b.price - a.price;
      if (filters.sort === 'name_asc') return a.name_fr.localeCompare(b.name_fr);
      if (filters.sort === 'newest') return b.created_at.localeCompare(a.created_at);
      return Number(b.featured) - Number(a.featured);
    });
    const total = products.length;
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 12));
    return { items: products.slice((page - 1) * limit, page * limit), total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
  }

  async getProduct(identifier: string, includeInactive = false): Promise<Product | undefined> {
    const result = await this.listProducts({ admin: includeInactive, limit: 100 });
    return result.items.find((product) => product.id === identifier || product.slug === identifier);
  }

  async createProduct(input: unknown, images: Product['images'] = []): Promise<Product> {
    const parsed = productSchema.parse(input);
    const existing = (await this.readRows('Products')).map(productFromRow);
    if (existing.some((product) => product.slug === parsed.slug)) throw new Error('Ce slug est deja utilise.');
    const now = new Date().toISOString();
    const product: Product = { id: crypto.randomUUID(), ...parsed, old_price: parsed.old_price ?? null, stock_status: parsed.stock_quantity > 0 ? 'in_stock' : 'out_of_stock', images: [...parsed.existing_images, ...images].slice(0, 6), created_at: now, updated_at: now, version: 1 };
    await this.replaceSheet('Products', [...existing, product].map(productToRow));
    return product;
  }

  async updateProduct(id: string, input: unknown, images: Product['images'] = []): Promise<Product> {
    const parsed = productSchema.parse(input);
    const products = (await this.readRows('Products')).map(productFromRow);
    const index = products.findIndex((product) => product.id === id);
    if (index < 0) throw new Error('Produit introuvable.');
    if (products.some((product) => product.id !== id && product.slug === parsed.slug)) throw new Error('Ce slug est deja utilise.');
    const previous = products[index]!;
    if (parsed.version && previous.version && parsed.version !== previous.version) throw new Error('Le produit a ete modifie ailleurs. Rechargez avant de reessayer.');
    const updated: Product = { ...previous, ...parsed, old_price: parsed.old_price ?? null, stock_status: parsed.stock_quantity > 0 ? 'in_stock' : 'out_of_stock', images: [...parsed.existing_images, ...images].slice(0, 6), updated_at: new Date().toISOString(), version: (previous.version || 1) + 1 };
    products[index] = updated;
    await this.replaceSheet('Products', products.map(productToRow));
    return updated;
  }

  async patchProduct(id: string, patch: Partial<Pick<Product, 'active' | 'featured' | 'new_arrival' | 'promotion'>>): Promise<Product> {
    const products = (await this.readRows('Products')).map(productFromRow);
    const index = products.findIndex((product) => product.id === id);
    if (index < 0) throw new Error('Produit introuvable.');
    const updated = { ...products[index]!, ...patch, updated_at: new Date().toISOString(), version: (products[index]!.version || 1) + 1 };
    products[index] = updated;
    await this.replaceSheet('Products', products.map(productToRow));
    return updated;
  }

  async deactivateProduct(id: string): Promise<Product> {
    return this.patchProduct(id, { active: false });
  }

  async listCategories(includeInactive = false): Promise<Category[]> {
    const products = (await this.readRows('Products')).map(productFromRow);
    return (await this.readRows('Categories')).map(categoryFromRow)
      .filter((category) => includeInactive || category.active)
      .map((category) => ({ ...category, product_count: products.filter((product) => product.active && product.category_id === category.id).length }))
      .sort((a, b) => a.display_order - b.display_order);
  }

  async createCategory(input: unknown): Promise<Category> {
    const parsed = categorySchema.parse(input);
    const categories = await this.listCategories(true);
    if (categories.some((category) => category.slug === parsed.slug)) throw new Error('Ce slug de categorie est deja utilise.');
    const now = new Date().toISOString();
    const category: Category = { id: crypto.randomUUID(), ...parsed, created_at: now, updated_at: now, version: 1 };
    await this.replaceSheet('Categories', [...categories, category].map(categoryToRow));
    return category;
  }

  async updateCategory(id: string, input: unknown): Promise<Category> {
    const parsed = categorySchema.parse(input);
    const categories = await this.listCategories(true);
    const index = categories.findIndex((category) => category.id === id);
    if (index < 0) throw new Error('Categorie introuvable.');
    if (categories.some((category) => category.id !== id && category.slug === parsed.slug)) throw new Error('Ce slug de categorie est deja utilise.');
    const previous = categories[index]!;
    if (parsed.version && previous.version && parsed.version !== previous.version) throw new Error('La categorie a ete modifiee ailleurs. Rechargez avant de reessayer.');
    const category: Category = { ...previous, ...parsed, updated_at: new Date().toISOString(), version: (previous.version || 1) + 1 };
    categories[index] = category;
    await this.replaceSheet('Categories', categories.map(categoryToRow));
    return category;
  }

  async deactivateCategory(id: string): Promise<Category> {
    const categories = await this.listCategories(true);
    const category = categories.find((item) => item.id === id);
    if (!category) throw new Error('Categorie introuvable.');
    if ((category.product_count || 0) > 0) throw new Error('Cette categorie contient des produits actifs.');
    return this.updateCategory(id, { ...category, active: false });
  }

  async getSettings(): Promise<Settings> {
    return Object.fromEntries((await this.readRows('Settings')).map((record) => [cleanText(record.key), cleanText(record.value)]));
  }

  async updateSettings(input: Record<string, unknown>): Promise<Settings> {
    const current = await this.getSettings();
    const now = new Date().toISOString();
    const next = { ...current, ...Object.fromEntries(Object.entries(input).map(([key, value]) => [key, cleanText(value)])) };
    await this.replaceSheet('Settings', Object.entries(next).map(([key, value]) => [safeCell(key), safeCell(value), now]));
    return next;
  }

  async exportCatalogue(): Promise<unknown> {
    return {
      products: (await this.readRows('Products')).map(productFromRow),
      categories: await this.listCategories(true),
      settings: await this.getSettings(),
      meta: await this.readRows('Meta'),
      exportedAt: new Date().toISOString(),
    };
  }
}
