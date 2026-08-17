import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { ExcelCatalogueRepository } from '../repositories/ExcelCatalogueRepository.js';

let root: string;
let repository: ExcelCatalogueRepository;
let sessionDirectory: string;

beforeAll(async () => {
  env.catalogueBackend = 'excel';
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'jad-home-session-integration-'));
  sessionDirectory = path.join(root, 'sessions');
  repository = new ExcelCatalogueRepository(path.join(root, 'catalogue.xlsx'), path.join(root, 'backups'));
  await repository.initialize();
  env.adminEmail = 'session-integration@jadhome.ma';
  env.adminPasswordHash = await bcrypt.hash('SessionIntegration!42', 4);
});

afterAll(async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
  await fs.rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

describe('Sessions administrateur concurrentes', () => {
  it('sert les routes authentifiées en parallèle et conserve la session après redémarrage', async () => {
    const app = createApp(repository, { sessionDirectory, uploadRoot: path.join(root, 'uploads') });
    const login = await request(app).post('/api/auth/login').send({
      email: 'session-integration@jadhome.ma',
      password: 'SessionIntegration!42',
    });
    expect(login.status).toBe(200);
    const cookie = (login.headers['set-cookie'] as unknown as string[]).map((item) => item.split(';')[0]).join('; ');
    const paths = ['/api/admin/me', '/api/admin/products', '/api/admin/categories', '/api/settings/public'];
    const responses = await Promise.all(Array.from({ length: 10 }, () => paths.map((route) =>
      request(app).get(route).set('Cookie', cookie),
    )).flat());

    expect(responses).toHaveLength(40);
    expect(responses.every((response) => response.status === 200)).toBe(true);

    const restartedApp = createApp(repository, { sessionDirectory, uploadRoot: path.join(root, 'uploads') });
    const afterRestart = await request(restartedApp).get('/api/admin/me').set('Cookie', cookie);
    expect(afterRestart.status).toBe(200);
    expect(afterRestart.body.data.email).toBe('session-integration@jadhome.ma');

    const files = await fs.readdir(sessionDirectory).catch(() => []);
    expect(files.filter((name) => name.endsWith('.json') || name.endsWith('.tmp'))).toHaveLength(0);
  }, 20_000);
});
