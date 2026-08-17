import path from 'node:path';
import bcrypt from 'bcrypt';
import { Router, type RequestHandler } from 'express';
import {
  createOrderSchema,
  loginSchema,
  updateOrderNoteSchema,
  updateOrderStatusSchema,
} from '@jad-home/shared';
import type { CartItem, OrderStatus } from '@jad-home/shared';
import { env } from '../config/env.js';
import type { CatalogueRepository } from '../repositories/CatalogueRepository.js';
import type { OrderFilters, OrderRepository } from '../repositories/OrderRepository.js';
import { OrderRepositoryError } from '../repositories/OrderRepository.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAdmin } from '../middleware/auth.js';
import { productImages } from '../middleware/upload.js';
import { clearAdminCookie, readAdmin, setAdminCookie } from '../services/statelessAuth.js';
import { durableRateLimit } from '../services/rateLimit.js';
import { OrderService } from '../services/OrderService.js';

function parseBoolean(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  return value === true || value === 'true' || value === '1';
}

function productFilters(query: Record<string, unknown>, admin = false) {
  return {
    page: Number(query.page || 1), limit: Number(query.limit || 12), category: query.category ? String(query.category) : undefined,
    search: query.search ? String(query.search) : undefined,
    minPrice: query.minPrice !== undefined && query.minPrice !== '' ? Number(query.minPrice) : undefined,
    maxPrice: query.maxPrice !== undefined && query.maxPrice !== '' ? Number(query.maxPrice) : undefined,
    inStock: parseBoolean(query.inStock), featured: parseBoolean(query.featured), promotion: parseBoolean(query.promotion),
    newArrival: parseBoolean(query.newArrival), active: parseBoolean(query.active), sort: query.sort ? String(query.sort) : undefined, admin,
  };
}

function orderFilters(query: Record<string, unknown>): OrderFilters {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const status = query.status ? String(query.status) as OrderStatus : undefined;
  return {
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) ? limit : 20,
    search: query.search ? String(query.search).trim().slice(0, 120) : undefined,
    status,
    dateFrom: query.dateFrom ? String(query.dateFrom).slice(0, 10) : undefined,
    dateTo: query.dateTo ? String(query.dateTo).slice(0, 10) : undefined,
    sort: query.sort === 'oldest' ? 'oldest' : 'newest',
  };
}

const orderPayloadLimit: RequestHandler = (req, res, next) => {
  const length = Number(req.get('content-length') || 0);
  if (length > 64 * 1024) {
    res.status(413).json({ success: false, data: null, message: 'La commande est trop volumineuse.' });
    return;
  }
  next();
};

export function createRoutes(
  repository: CatalogueRepository,
  orders: OrderRepository,
  _options: { uploadRoot?: string } = {},
): Router {
  const router = Router();
  const ok = <T>(data: T, message = '') => ({ success: true, data, message });
  const publicCache = 'no-store';
  const orderService = new OrderService(repository, orders);

  router.get('/products', asyncHandler(async (req, res) => {
    res.setHeader('cache-control', publicCache);
    return res.json(ok(await repository.listProducts(productFilters(req.query))));
  }));
  router.get('/products/:slug', asyncHandler(async (req, res) => {
    const product = await repository.getProduct(String(req.params.slug));
    if (!product) return res.status(404).json({ success: false, data: null, message: 'Produit introuvable.' });
    res.setHeader('cache-control', publicCache);
    return res.json(ok(product));
  }));
  router.get('/categories', asyncHandler(async (_req, res) => {
    res.setHeader('cache-control', publicCache);
    return res.json(ok(await repository.listCategories()));
  }));
  router.get(['/settings', '/settings/public'], asyncHandler(async (_req, res) => {
    res.setHeader('cache-control', publicCache);
    return res.json(ok(await repository.getSettings()));
  }));
  router.post('/cart/validate', asyncHandler(async (req, res) => {
    const requested: CartItem[] = Array.isArray(req.body?.items) ? req.body.items : [];
    const validated = [];
    for (const item of requested) {
      const product = await repository.getProduct(item.productId);
      const quantity = Math.floor(Number(item.quantity));
      if (product && product.active && product.stock_quantity > 0 && quantity > 0) validated.push({
        productId: product.id, slug: product.slug, name: product.name_fr, image: typeof product.images[0] === 'string' ? product.images[0] : product.images[0]?.secureUrl || '',
        price: product.price, maxStock: product.stock_quantity,
        quantity: Math.min(quantity, product.stock_quantity), color: item.color,
        material: item.material, dimensions: item.dimensions,
      });
    }
    return res.json(ok(validated, requested.length === validated.length ? 'Panier a jour.' : 'Certains articles indisponibles ont ete retires.'));
  }));
  router.use('/orders', (_req, res, next) => {
    res.setHeader('cache-control', 'no-store');
    next();
  });
  router.post(
    '/orders',
    orderPayloadLimit,
    durableRateLimit({ name: 'create-order', windowMs: 10 * 60_000, limit: 12 }),
    asyncHandler(async (req, res) => {
      const input = createOrderSchema.parse(req.body);
      let created;
      try {
        created = await orderService.create(input);
      } catch (error) {
        if (error instanceof OrderRepositoryError) throw error;
        throw new OrderRepositoryError('Impossible d’enregistrer la commande pour le moment.', 503);
      }
      return res.status(created.duplicate ? 200 : 201).json(ok(
        created,
        created.duplicate ? 'Commande déjà enregistrée.' : 'Commande enregistrée.',
      ));
    }),
  );

  router.post('/auth/login', durableRateLimit({ name: 'admin-login', windowMs: 15 * 60_000, limit: 8 }), asyncHandler(async (req, res) => {
    const credentials = loginSchema.parse(req.body);
    const emailMatches = credentials.email.toLowerCase() === env.adminEmail.toLowerCase();
    const passwordMatches = await bcrypt.compare(credentials.password, env.adminPasswordHash);
    if (!emailMatches || !passwordMatches) return res.status(401).json({ success: false, data: null, message: 'Identifiants invalides.' });
    const admin = { id: 'admin', email: env.adminEmail, sessionVersion: env.adminSessionVersion };
    setAdminCookie(res, admin);
    return res.json(ok({ email: env.adminEmail }, 'Connexion reussie.'));
  }));
  router.post('/auth/logout', (_req, res) => {
    clearAdminCookie(res);
    return res.json(ok(null, 'Deconnexion reussie.'));
  });
  router.get('/auth/me', (req, res) => {
    const admin = readAdmin(req);
    return admin ? res.json(ok({ email: admin.email, catalogueBackend: env.catalogueBackend })) : res.status(401).json({ success: false, data: null, message: 'Non connecte.' });
  });

  router.use('/admin', requireAdmin);
  router.use('/admin', (_req, res, next) => {
    res.setHeader('cache-control', 'no-store');
    next();
  });
  router.get('/admin/me', (req, res) => res.json(ok({ email: req.admin!.email, catalogueBackend: env.catalogueBackend })));
  router.get('/admin/dashboard', asyncHandler(async (_req, res) => {
    const products = (await repository.listProducts({ admin: true, limit: 100 })).items;
    const categories = await repository.listCategories(true);
    return res.json(ok({ total: products.length, active: products.filter((p) => p.active).length, outOfStock: products.filter((p) => !p.stock_quantity).length, promotions: products.filter((p) => p.promotion).length, categories: categories.length, latest: products.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5) }));
  }));
  router.get('/admin/orders', asyncHandler(async (req, res) => {
    return res.json(ok(await orders.list(orderFilters(req.query))));
  }));
  router.get('/admin/orders/:id', asyncHandler(async (req, res) => {
    const order = await orders.getById(String(req.params.id));
    return order
      ? res.json(ok(order))
      : res.status(404).json({ success: false, data: null, message: 'Commande introuvable.' });
  }));
  router.patch('/admin/orders/:id/status', asyncHandler(async (req, res) => {
    const input = updateOrderStatusSchema.parse(req.body);
    const order = await orders.updateStatus(String(req.params.id), input.status, {
      expectedVersion: input.version,
      changedBy: req.admin!.email,
    });
    return res.json(ok(order, 'Statut mis à jour.'));
  }));
  router.patch('/admin/orders/:id/note', asyncHandler(async (req, res) => {
    const input = updateOrderNoteSchema.parse(req.body);
    const order = await orders.updateNote(String(req.params.id), input.note, {
      expectedVersion: input.version,
      changedBy: req.admin!.email,
    });
    return res.json(ok(order, 'Note enregistrée.'));
  }));
  router.get('/admin/products', asyncHandler(async (req, res) => res.json(ok(await repository.listProducts(productFilters(req.query, true))))));
  router.get('/admin/products/:id', asyncHandler(async (req, res) => {
    const product = await repository.getProduct(String(req.params.id), true);
    return product ? res.json(ok(product)) : res.status(404).json({ success: false, data: null, message: 'Produit introuvable.' });
  }));
  router.post('/admin/products', productImages, asyncHandler(async (req, res) => {
    return res.status(503).json({ success: false, data: null, message: 'Stockage BELGA WOOD non configuré.' });
  }));
  router.put('/admin/products/:id', productImages, asyncHandler(async (req, res) => {
    return res.status(503).json({ success: false, data: null, message: 'Stockage BELGA WOOD non configuré.' });
  }));
  router.patch('/admin/products/:id/status', asyncHandler(async (req, res) => res.json(ok(await repository.patchProduct(String(req.params.id), req.body), 'Statut mis a jour.'))));
  router.post('/admin/products/:id/duplicate', asyncHandler(async (req, res) => {
    const source = await repository.getProduct(String(req.params.id), true);
    if (!source) return res.status(404).json({ success: false, data: null, message: 'Produit introuvable.' });
    const suffix = Date.now().toString().slice(-6);
    const copy = await repository.createProduct({ ...source, slug: `${source.slug}-copie-${suffix}`, name_fr: `${source.name_fr} (copie)`, name_ar: `${source.name_ar} (نسخة)`, existing_images: source.images }, []);
    return res.status(201).json(ok(copy, 'Produit duplique.'));
  }));
  router.delete('/admin/products/:id', asyncHandler(async (req, res) => res.json(ok(await repository.deactivateProduct(String(req.params.id)), 'Produit desactive.'))));

  router.get('/admin/categories', asyncHandler(async (_req, res) => res.json(ok(await repository.listCategories(true)))));
  router.post('/admin/categories/upload', (_req, res) => res.status(503).json({ success: false, data: null, message: 'Stockage BELGA WOOD non configuré.' }));
  router.post('/admin/categories', asyncHandler(async (req, res) => res.status(201).json(ok(await repository.createCategory(req.body), 'Categorie ajoutee.'))));
  router.put('/admin/categories/:id', asyncHandler(async (req, res) => res.json(ok(await repository.updateCategory(String(req.params.id), req.body), 'Categorie mise a jour.'))));
  router.delete('/admin/categories/:id', asyncHandler(async (req, res) => res.json(ok(await repository.deactivateCategory(String(req.params.id)), 'Categorie desactivee.'))));
  router.get('/admin/settings', asyncHandler(async (_req, res) => res.json(ok(await repository.getSettings()))));
  router.put('/admin/settings', asyncHandler(async (req, res) => res.json(ok(await repository.updateSettings(req.body), 'Parametres enregistres.'))));

  router.post('/admin/cloudinary/signature', durableRateLimit({ name: 'cloudinary-signature', windowMs: 60_000, limit: 60 }), asyncHandler(async (req, res) => {
    return res.status(503).json({ success: false, data: null, message: 'Stockage BELGA WOOD non configuré.' });
  }));
  router.delete('/admin/cloudinary/assets/:publicId', durableRateLimit({ name: 'cloudinary-delete', windowMs: 60_000, limit: 20 }), asyncHandler(async (req, res) => {
    return res.status(503).json({ success: false, data: null, message: 'Stockage BELGA WOOD non configuré.' });
  }));

  router.get('/admin/backups', asyncHandler(async (_req, res) => res.json(ok(repository.listBackups ? await repository.listBackups() : []))));
  router.post('/admin/backups', asyncHandler(async (_req, res) => {
    if (!repository.createBackup) return res.status(404).json({ success: false, data: null, message: 'Sauvegardes locales indisponibles.' });
    return res.status(201).json(ok({ name: await repository.createBackup() }, 'Sauvegarde creee.'));
  }));
  router.post('/admin/backups/:name/restore', asyncHandler(async (req, res) => {
    if (!repository.restoreBackup) return res.status(404).json({ success: false, data: null, message: 'Restauration locale indisponible.' });
    await repository.restoreBackup(String(req.params.name));
    return res.json(ok(null, 'Sauvegarde restauree.'));
  }));
  router.get('/admin/backups/export', asyncHandler(async (_req, res) => {
    const payload = repository.exportCatalogue ? await repository.exportCatalogue() : { exportedAt: new Date().toISOString() };
    res.setHeader('content-disposition', `attachment; filename="jad-home-export-${new Date().toISOString().slice(0, 10)}.json"`);
    return res.json(payload);
  }));
  router.get('/admin/backups/:name/download', asyncHandler(async (req, res, next) => {
    if (!repository.getBackupPath) return res.status(404).json({ success: false, data: null, message: 'Sauvegardes locales indisponibles.' });
    res.download(path.resolve(repository.getBackupPath(String(req.params.name))), (error) => {
      if (error) return next(error);
      return;
    });
  }));
  return router;
}
