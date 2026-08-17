import bcrypt from 'bcrypt';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CloudinaryImage } from '@jad-home/shared';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { GoogleSheetsCatalogueRepository } from '../repositories/GoogleSheetsCatalogueRepository.js';
import { ORDER_HEADERS } from '../repositories/GoogleSheetsOrderRepository.js';

const headers = {
  Products: ['id', 'slug', 'name_fr', 'name_ar', 'short_description_fr', 'short_description_ar', 'description_fr', 'description_ar', 'category_id', 'price', 'old_price', 'currency', 'stock_quantity', 'stock_status', 'featured', 'new_arrival', 'promotion', 'active', 'colors', 'dimensions', 'materials', 'images', 'created_at', 'updated_at', 'version'],
  Categories: ['id', 'slug', 'name_fr', 'name_ar', 'description_fr', 'description_ar', 'image', 'display_order', 'active', 'created_at', 'updated_at', 'version'],
  Settings: ['key', 'value', 'updated_at'],
  Meta: ['key', 'value', 'updated_at'],
  Orders: ORDER_HEADERS,
} as const;

type SheetName = keyof typeof headers;

function sheetName(range: string): SheetName {
  return range.split('!')[0] as SheetName;
}

function createFakeSheets() {
  const data: Record<SheetName, unknown[][]> = {
    Products: [[...headers.Products]],
    Categories: [[...headers.Categories]],
    Settings: [[...headers.Settings]],
    Meta: [[...headers.Meta]],
    Orders: [[...headers.Orders]],
  };
  return {
    data,
    client: {
      spreadsheets: {
        get: async () => ({ data: { sheets: Object.keys(data).map((title) => ({ properties: { title } })) } }),
        batchUpdate: async () => ({ data: {} }),
        values: {
          get: async ({ range }: { range: string }) => ({ data: { values: data[sheetName(range)] || [] } }),
          clear: async ({ range }: { range: string }) => {
            const name = sheetName(range);
            if (range.includes('!A2')) data[name] = [data[name][0] || [...headers[name]]];
            else data[name] = [];
            return { data: {} };
          },
          batchUpdate: async ({ requestBody }: { requestBody: { data: { range: string; values: unknown[][] }[] } }) => {
            for (const entry of requestBody.data) {
              const name = sheetName(entry.range);
              if (entry.range.includes('!A1')) data[name] = entry.values.map((row) => [...row]);
              else if (entry.range.includes('!A2')) data[name] = [data[name][0] || [...headers[name]], ...entry.values.map((row) => [...row])];
            }
            return { data: {} };
          },
        },
      },
    },
  };
}

function categoryInput(slug: string) {
  return {
    slug,
    name_fr: `Cat ${slug}`,
    name_ar: 'تصنيف',
    description_fr: '',
    description_ar: '',
    image: 'https://res.cloudinary.com/demo/image/upload/v1/jad-home/categories/cat.webp',
    display_order: 1,
    active: true,
  };
}

function productInput(categoryId: string, slug = 'produit-cloudinary') {
  return {
    slug,
    name_fr: 'Produit Cloudinary',
    name_ar: 'منتج',
    short_description_fr: '',
    short_description_ar: '',
    description_fr: '',
    description_ar: '',
    category_id: categoryId,
    price: 1000,
    old_price: null,
    currency: 'MAD',
    stock_quantity: 3,
    featured: false,
    new_arrival: false,
    promotion: false,
    active: true,
    colors: [],
    dimensions: '',
    materials: [],
    existing_images: [],
  };
}

const image: CloudinaryImage = {
  publicId: 'jad-home/products/test-image',
  secureUrl: 'https://res.cloudinary.com/demo/image/upload/v1/jad-home/products/test-image.webp',
  width: 1200,
  height: 800,
  format: 'webp',
  bytes: 1234,
  altFr: 'Produit test',
  altAr: 'منتج',
  displayOrder: 0,
};

beforeEach(async () => {
  env.catalogueBackend = 'google-sheets';
  env.adminEmail = 'admin-google@test.local';
  env.adminPasswordHash = await bcrypt.hash('GoogleSheets!42', 4);
});

describe('GoogleSheetsCatalogueRepository', () => {
  it('cree, modifie et desactive une categorie sans duplication', async () => {
    const fake = createFakeSheets();
    const repository = new GoogleSheetsCatalogueRepository('spreadsheet-test-id', fake.client as never);
    await repository.initialize();
    const created = await repository.createCategory(categoryInput('test-google'));
    const updated = await repository.updateCategory(created.id, { ...categoryInput('test-google'), name_fr: 'Cat modifiee', version: created.version });
    await repository.deactivateCategory(created.id);

    const rows = fake.data.Categories.slice(1).filter((row) => row[0] === created.id);
    expect(rows).toHaveLength(1);
    expect(updated.name_fr).toBe('Cat modifiee');
    expect((await repository.listCategories(true)).find((category) => category.id === created.id)?.active).toBe(false);
  });

  it('compte les produits actifs par category_id et garde les APIs admin/publiques coherentes', async () => {
    const fake = createFakeSheets();
    const repository = new GoogleSheetsCatalogueRepository('spreadsheet-test-id', fake.client as never);
    await repository.initialize();
    const category = await repository.createCategory(categoryInput('tables-test'));
    await repository.createProduct(productInput(category.id), [image]);
    await repository.createProduct({ ...productInput(category.id, 'produit-inactif'), active: false }, [image]);

    const publicCategories = await repository.listCategories(false);
    expect(publicCategories.find((item) => item.id === category.id)?.product_count).toBe(1);

    const app = createApp(repository);
    const publicResponse = await request(app).get('/api/categories');
    expect(publicResponse.body.data.find((item: { id: string; product_count: number }) => item.id === category.id).product_count).toBe(1);

    const login = await request(app).post('/api/auth/login').send({ email: 'admin-google@test.local', password: 'GoogleSheets!42' });
    const cookie = (login.headers['set-cookie'] as unknown as string[]).map((item) => item.split(';')[0]).join('; ');
    const adminResponse = await request(app).get('/api/admin/categories').set('Cookie', cookie);
    expect(adminResponse.body.data.find((item: { id: string; product_count: number }) => item.id === category.id).product_count).toBe(1);
    const runtimeResponse = await request(app).get('/api/admin/me').set('Cookie', cookie);
    expect(runtimeResponse.body.data.catalogueBackend).toBe('google-sheets');
  });

  it('ajoute un produit avec reference Cloudinary et relit immediatement la mutation', async () => {
    const fake = createFakeSheets();
    const repository = new GoogleSheetsCatalogueRepository('spreadsheet-test-id', fake.client as never);
    await repository.initialize();
    const category = await repository.createCategory(categoryInput('cloudinary-test'));
    const product = await repository.createProduct(productInput(category.id), [image]);
    const updated = await repository.updateProduct(product.id, { ...productInput(category.id), name_fr: 'Produit mis a jour', version: product.version, existing_images: product.images }, []);

    expect(product.images[0]).toMatchObject({ publicId: image.publicId, secureUrl: image.secureUrl });
    expect(updated.name_fr).toBe('Produit mis a jour');
    expect(updated.id).toBe(product.id);
    expect((await repository.listProducts({ admin: true })).items.filter((item) => item.id === product.id)).toHaveLength(1);
    expect(fake.data.Meta.flat().join(' ')).toContain('catalogueVersion');
  });
});
