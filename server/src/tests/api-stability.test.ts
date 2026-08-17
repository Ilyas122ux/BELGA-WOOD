import { once } from 'node:events';
import fs from 'node:fs/promises';
import type { Server } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcrypt';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { ExcelCatalogueRepository } from '../repositories/ExcelCatalogueRepository.js';

let root: string;
let repository: ExcelCatalogueRepository;

beforeAll(async () => {
  env.catalogueBackend = 'excel';
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'jad-home-api-stability-'));
  repository = new ExcelCatalogueRepository(path.join(root, 'catalogue.xlsx'), path.join(root, 'backups'));
  await repository.initialize();
  env.adminEmail = 'stability@jadhome.ma';
  env.adminPasswordHash = await bcrypt.hash('StabilityPassword!42', 4);
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

describe('Stabilite longue de l API', () => {
  it('reste en ecoute apres 200 requetes et 40 requetes concurrentes', async () => {
    const sessionDirectory = path.join(root, 'sessions');
    const app = createApp(repository, {
      sessionDirectory,
      uploadRoot: path.join(root, 'uploads'),
    });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Adresse HTTP de test indisponible.');
    const base = `http://127.0.0.1:${address.port}`;

    try {
      const login = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'stability@jadhome.ma', password: 'StabilityPassword!42' }),
      });
      expect(login.status).toBe(200);
      const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
      expect(cookie).toContain('jad_home_admin_session=');

      for (let index = 0; index < 200; index += 1) {
        const route = index % 2 === 0 ? '/api/health' : '/api/admin/me';
        const response = await fetch(`${base}${route}`, { headers: { cookie } });
        expect(response.status).toBe(200);
      }

      const routes = ['/api/admin/me', '/api/admin/products', '/api/admin/categories', '/api/settings/public'];
      const concurrent = await Promise.all(Array.from({ length: 10 }, () => routes.map((route) =>
        fetch(`${base}${route}`, { headers: { cookie } }),
      )).flat());
      expect(concurrent).toHaveLength(40);
      expect(concurrent.every((response) => response.status === 200)).toBe(true);

      const finalHealth = await fetch(`${base}/api/health`);
      expect(finalHealth.status).toBe(200);
      expect(server.listening).toBe(true);
      const sessionFiles = await fs.readdir(sessionDirectory).catch(() => []);
      expect(sessionFiles.filter((name) => name.endsWith('.json') || name.endsWith('.tmp'))).toHaveLength(0);
    } finally {
      await closeServer(server);
    }
  }, 30_000);
});
