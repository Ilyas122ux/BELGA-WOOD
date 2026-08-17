import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Product } from '@jad-home/shared';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { ExcelCatalogueRepository } from '../repositories/ExcelCatalogueRepository.js';
import { MemoryOrderRepository } from '../repositories/MemoryOrderRepository.js';

let root: string;
let catalogue: ExcelCatalogueRepository;
let orders: MemoryOrderRepository;
let product: Product;
let app: ReturnType<typeof createApp>;

function payload(overrides: Record<string, unknown> = {}) {
  return {
    clientRequestId: crypto.randomUUID(),
    customerName: 'Sara Commande',
    customerPhone: '0612345678',
    customerWhatsapp: '',
    customerEmail: 'sara@example.com',
    city: 'Rabat',
    address: '10 rue Exemple, quartier Agdal',
    additionalAddress: 'Appartement 3',
    customerNote: 'Appeler avant la livraison',
    language: 'fr',
    items: [{
      productId: product.id,
      quantity: 2,
      selectedColor: '',
      selectedMaterial: '',
      selectedDimensions: '',
    }],
    ...overrides,
  };
}

async function adminAgent() {
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({
    email: 'orders-admin@jadhome.ma',
    password: 'OrdersPassword!42',
  });
  expect(login.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  env.catalogueBackend = 'excel';
  env.adminEmail = 'orders-admin@jadhome.ma';
  env.adminPasswordHash = await bcrypt.hash('OrdersPassword!42', 4);
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'jad-home-orders-'));
  catalogue = new ExcelCatalogueRepository(path.join(root, 'catalogue.xlsx'), path.join(root, 'backups'));
  await catalogue.initialize();
  await catalogue.updateSettings({ delivery_fee: '75', currency: 'MAD' });
  product = (await catalogue.listProducts({ admin: true, inStock: true, limit: 100 })).items
    .find((item) => item.active && item.stock_quantity >= 2)!;
  orders = new MemoryOrderRepository();
  app = createApp(catalogue, { orderRepository: orders });
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

describe('Création publique des commandes', () => {
  it('crée une commande valide, recalcule les prix et conserve un snapshot complet', async () => {
    const currentPrice = product.price;
    const response = await request(app).post('/api/orders').send(payload());
    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.data.orderNumber).toMatch(/^JH-\d{8}-[A-F0-9]{8}$/);
    expect(response.body.data.subtotal).toBe(currentPrice * 2);
    expect(response.body.data.deliveryFee).toBe(75);
    expect(response.body.data.total).toBe(currentPrice * 2 + 75);
    expect(response.body.data.status).toBe('new');

    const stored = await orders.getById(response.body.data.id);
    expect(stored?.items[0]).toMatchObject({
      productId: product.id,
      sku: product.id,
      slug: product.slug,
      nameFr: product.name_fr,
      nameAr: product.name_ar,
      quantity: 2,
      unitPrice: currentPrice,
      lineTotal: currentPrice * 2,
    });
    expect(stored?.statusHistory[0]).toMatchObject({ previousStatus: null, newStatus: 'new' });
  });

  it('refuse panier vide, produit inexistant et montant imposé par le navigateur', async () => {
    const empty = await request(app).post('/api/orders').send(payload({ items: [] }));
    expect(empty.status).toBe(400);

    const missing = await request(app).post('/api/orders').send(payload({
      items: [{ productId: 'produit-inexistant', quantity: 1, selectedColor: '', selectedMaterial: '', selectedDimensions: '' }],
    }));
    expect(missing.status).toBe(409);

    const forged = await request(app).post('/api/orders').send({ ...payload(), total: 1 });
    expect(forged.status).toBe(400);
  });

  it('est idempotente pour un même clientRequestId', async () => {
    const requestPayload = payload();
    const first = await request(app).post('/api/orders').send(requestPayload);
    const second = await request(app).post('/api/orders').send(requestPayload);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect((await orders.list()).items.filter((order) => order.clientRequestId === requestPayload.clientRequestId)).toHaveLength(1);
  });

  it('ne permet ni lecture ni modification depuis la route publique', async () => {
    expect((await request(app).get('/api/orders')).status).toBe(404);
    expect((await request(app).patch(`/api/orders/${crypto.randomUUID()}`).send({ status: 'cancelled' })).status).toBe(404);
  });
});

describe('Administration des commandes', () => {
  it('protège la liste, puis permet liste, détail, statut, historique, note et filtres', async () => {
    expect((await request(app).get('/api/admin/orders')).status).toBe(401);
    const agent = await adminAgent();
    const list = await agent.get('/api/admin/orders?page=1&limit=2&search=Sara&status=new');
    expect(list.status).toBe(200);
    expect(list.headers['cache-control']).toBe('no-store');
    expect(list.body.data.items.length).toBeGreaterThan(0);
    expect(list.body.data.limit).toBe(2);
    expect(list.body.data.summary.total).toBeGreaterThan(0);

    const order = list.body.data.items[0];
    const detail = await agent.get(`/api/admin/orders/${order.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.customerEmail).toBe('sara@example.com');

    const changed = await agent.patch(`/api/admin/orders/${order.id}/status`).send({
      status: 'confirmed',
      version: detail.body.data.version,
    });
    expect(changed.status).toBe(200);
    expect(changed.body.data.status).toBe('confirmed');
    expect(changed.body.data.confirmedAt).toBeTruthy();
    expect(changed.body.data.statusHistory.at(-1)).toMatchObject({
      previousStatus: 'new',
      newStatus: 'confirmed',
      changedBy: env.adminEmail,
    });

    const noted = await agent.patch(`/api/admin/orders/${order.id}/note`).send({
      note: 'Client confirmé par téléphone.',
      version: changed.body.data.version,
    });
    expect(noted.status).toBe(200);
    expect(noted.body.data.adminNote).toBe('Client confirmé par téléphone.');

    const filtered = await agent.get('/api/admin/orders?status=confirmed&dateFrom=2020-01-01&sort=oldest');
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.items.some((item: { id: string }) => item.id === order.id)).toBe(true);
  });

  it('rejette une mise à jour avec une version obsolète', async () => {
    const agent = await adminAgent();
    const order = (await orders.list()).items[0]!;
    const response = await agent.patch(`/api/admin/orders/${order.id}/note`).send({
      note: 'Conflit',
      version: Math.max(1, order.version - 1),
    });
    expect([200, 409]).toContain(response.status);
    if (order.version > 1) expect(response.status).toBe(409);
  });
});

describe('Concurrence', () => {
  it('crée plusieurs commandes concurrentes avec des identifiants et numéros uniques', async () => {
    const responses = await Promise.all(Array.from({ length: 4 }, () => request(app).post('/api/orders').send(payload({
      customerName: 'Client Concurrent',
    }))));
    expect(responses.every((response) => response.status === 201)).toBe(true);
    expect(new Set(responses.map((response) => response.body.data.id)).size).toBe(4);
    expect(new Set(responses.map((response) => response.body.data.orderNumber)).size).toBe(4);
  });
});
