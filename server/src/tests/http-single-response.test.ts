import express, { type Express, type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcrypt';
import sharp from 'sharp';
import request, { type Response as SupertestResponse, type Test } from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { ExcelCatalogueRepository } from '../repositories/ExcelCatalogueRepository.js';

let root: string;
let uploadRoot: string;
let app: Express;
let agent: ReturnType<typeof request.agent>;
let image: Buffer;
let completedResponses = 0;
const forbiddenErrors: string[] = [];
let consoleError: ReturnType<typeof vi.spyOn>;

async function expectOneResponse(operation: Test): Promise<SupertestResponse> {
  const before = completedResponses;
  const response = await operation;
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(completedResponses - before).toBe(1);
  return response;
}

beforeAll(async () => {
  env.catalogueBackend = 'excel';
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'jad-home-http-once-'));
  uploadRoot = path.join(root, 'uploads');
  const repository = new ExcelCatalogueRepository(path.join(root, 'catalogue.xlsx'), path.join(root, 'backups'));
  await repository.initialize();

  env.adminEmail = 'single-response@jadhome.ma';
  env.adminPasswordHash = await bcrypt.hash('SingleResponse!42', 4);
  image = await sharp({ create: { width: 96, height: 64, channels: 3, background: '#f1e6d1' } }).png().toBuffer();
  await fs.mkdir(path.join(uploadRoot, 'products'), { recursive: true });
  await sharp(image).webp().toFile(path.join(uploadRoot, 'products', 'existing.webp'));

  const observed = express();
  observed.use((_req, res, next) => {
    res.once('finish', () => { completedResponses += 1; });
    next();
  });
  observed.use(createApp(repository, {
    uploadRoot,
    sessionDirectory: path.join(root, 'sessions'),
    backupDirectory: path.join(root, 'backups'),
  }));
  app = observed;
  agent = request.agent(app);
  consoleError = vi.spyOn(console, 'error').mockImplementation((...values: unknown[]) => {
    const line = values.map(String).join(' ');
    if (/ERR_HTTP_HEADERS_SENT|ECONNRESET|socket hang up|UnhandledPromiseRejection/i.test(line)) forbiddenErrors.push(line);
  });

  const login = await expectOneResponse(agent.post('/api/auth/login').send({
    email: 'single-response@jadhome.ma',
    password: 'SingleResponse!42',
  }));
  expect(login.status).toBe(200);
});

afterAll(async () => {
  consoleError.mockRestore();
  expect(forbiddenErrors).toEqual([]);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await fs.rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

describe('Réponses HTTP uniques', () => {
  it('sert le catalogue, les catégories et les paramètres une seule fois', async () => {
    const products = await expectOneResponse(request(app).get('/api/products'));
    const categories = await expectOneResponse(request(app).get('/api/categories'));
    const settings = await expectOneResponse(request(app).get('/api/settings/public'));
    expect(products.status).toBe(200);
    expect(categories.status).toBe(200);
    expect(settings.status).toBe(200);
  });

  it('répond une fois pour un produit existant et un produit inexistant', async () => {
    expect((await expectOneResponse(request(app).get('/api/products/canape-nora'))).status).toBe(200);
    const missing = await expectOneResponse(request(app).get('/api/products/produit-inexistant'));
    expect(missing.status).toBe(404);
    expect(missing.body.success).toBe(false);
  });

  it('sert une image existante et produit un seul 404 pour une image absente', async () => {
    const existing = await expectOneResponse(request(app).get('/uploads/products/existing.webp'));
    const missing = await expectOneResponse(request(app).get('/uploads/products/missing.webp'));
    expect(existing.status).toBe(200);
    expect(existing.headers['content-type']).toMatch(/^image\/webp/);
    expect(missing.status).toBe(404);
    expect(missing.body.success).toBe(false);
  });

  it('ajoute une catégorie avec image et sert ensuite cette image', async () => {
    const uploaded = await expectOneResponse(
      agent.post('/api/admin/categories/upload').attach('image', image, 'categorie.png'),
    );
    expect(uploaded.status).toBe(201);
    const created = await expectOneResponse(agent.post('/api/admin/categories').send({
      slug: 'categorie-http-once',
      name_fr: 'Catégorie HTTP',
      name_ar: 'فئة اختبار',
      description_fr: 'Catégorie créée pendant le test.',
      description_ar: 'فئة تم إنشاؤها أثناء الاختبار.',
      image: uploaded.body.data.path,
      display_order: 90,
      active: true,
    }));
    expect(created.status).toBe(201);
    expect((await expectOneResponse(request(app).get(uploaded.body.data.path))).status).toBe(200);
  });

  it('ajoute un produit avec image et sert ensuite sa fiche et son image', async () => {
    const product = {
      slug: 'produit-http-once',
      name_fr: 'Produit HTTP Once',
      name_ar: 'منتج اختبار',
      short_description_fr: 'Produit de test',
      short_description_ar: 'منتج للاختبار',
      description_fr: 'Validation de la réponse HTTP unique.',
      description_ar: 'التحقق من استجابة واحدة.',
      category_id: 'cat-canapes',
      price: 3490,
      old_price: '',
      currency: 'MAD',
      stock_quantity: 2,
      featured: false,
      new_arrival: true,
      promotion: false,
      active: true,
      colors: ['Ivoire'],
      dimensions: '180 × 90 cm',
      materials: ['Tissu'],
      existing_images: [],
    };
    const created = await expectOneResponse(
      agent.post('/api/admin/products').field('product', JSON.stringify(product)).attach('images', image, 'produit.png'),
    );
    expect(created.status).toBe(201);
    const detail = await expectOneResponse(request(app).get('/api/products/produit-http-once'));
    expect(detail.status).toBe(200);
    expect(detail.body.data.images).toHaveLength(1);
    expect((await expectOneResponse(request(app).get(detail.body.data.images[0]))).status).toBe(200);
  });

  it('supporte les requêtes newArrival concurrentes sans fermeture de socket', async () => {
    const before = completedResponses;
    const responses = await Promise.all(Array.from({ length: 24 }, () =>
      request(app).get('/api/products?newArrival=true&limit=4'),
    ));
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(completedResponses - before).toBe(24);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(responses.every((response) => response.body.data.limit === 4)).toBe(true);
  });

  it('renvoie une seule erreur de validation et protège les routes admin', async () => {
    const invalid = await expectOneResponse(agent.post('/api/admin/products').send({ slug: 'invalide' }));
    const unauthenticated = await expectOneResponse(request(app).get('/api/admin/products'));
    expect(invalid.status).toBe(400);
    expect(invalid.body.success).toBe(false);
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.success).toBe(false);
  });

  it('délègue une erreur si les en-têtes ont déjà été envoyés', () => {
    const error = new Error('stream interrompu');
    const next = vi.fn();
    errorHandler(error, {} as Request, { headersSent: true } as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(error);
  });
});
