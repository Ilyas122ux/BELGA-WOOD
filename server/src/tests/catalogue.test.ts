import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExcelCatalogueRepository } from '../repositories/ExcelCatalogueRepository.js';

let root: string;
let repository: ExcelCatalogueRepository;
const productInput = {
  slug: 'produit-test', name_fr: 'Produit Test', name_ar: 'منتج تجريبي',
  short_description_fr: 'Résumé', short_description_ar: 'ملخص', description_fr: 'Description', description_ar: 'وصف',
  category_id: 'cat-canapes', price: 1000, old_price: 1200, currency: 'MAD', stock_quantity: 4,
  featured: false, new_arrival: true, promotion: true, active: true, colors: ['Ivoire'],
  dimensions: '100 × 50 cm', materials: ['Bois'], existing_images: [],
};

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'jad-home-catalogue-'));
  repository = new ExcelCatalogueRepository(path.join(root, 'catalogue.xlsx'), path.join(root, 'backups'));
  await repository.initialize();
});

afterAll(async () => { await fs.rm(root, { recursive: true, force: true }); });

describe('Catalogue Excel', () => {
  it('crée et lit les trois feuilles et les données de démonstration', async () => {
    const products = await repository.listProducts({ admin: true, limit: 100 });
    const categories = await repository.listCategories(true);
    const settings = await repository.getSettings();
    expect(products.total).toBe(8);
    expect(categories).toHaveLength(9);
    expect(categories.map((category) => category.slug)).toEqual([
      'table', 'canape', 'salon-marocain', 'salon-moderne', 'lit',
      'chaise', 'matelas', 'armoire', 'bardage',
    ]);
    expect(settings.business_name).toBe('JAD HOME');
  });

  it('ajoute un produit validé dans Excel', async () => {
    const created = await repository.createProduct(productInput);
    expect(created.slug).toBe('produit-test');
    expect((await repository.getProduct(created.id, true))?.name_fr).toBe('Produit Test');
  });

  it('modifie puis désactive un produit', async () => {
    const created = (await repository.listProducts({ admin: true, search: 'Produit Test', limit: 10 })).items[0];
    const updated = await repository.updateProduct(created.id, { ...productInput, name_fr: 'Produit Test Modifié', price: 1090 });
    expect(updated.price).toBe(1090);
    const inactive = await repository.deactivateProduct(created.id);
    expect(inactive.active).toBe(false);
    expect(await repository.getProduct(created.slug)).toBeUndefined();
  });

  it('ajoute une catégorie', async () => {
    const category = await repository.createCategory({ slug: 'test-cat', name_fr: 'Test catégorie', name_ar: 'فئة', description_fr: '', description_ar: '', image: '', display_order: 99, active: true });
    expect((await repository.listCategories()).some((item) => item.id === category.id)).toBe(true);
  });

  it('crée et restaure une sauvegarde fiable', async () => {
    await repository.updateSettings({ slogan: 'Version sauvegardée' });
    const backup = await repository.createBackup();
    await repository.updateSettings({ slogan: 'Version récente' });
    expect((await repository.getSettings()).slogan).toBe('Version récente');
    await repository.restoreBackup(backup);
    expect((await repository.getSettings()).slogan).toBe('Version sauvegardée');
    expect((await repository.listBackups()).length).toBeGreaterThan(0);
  });
});
