import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type session from 'express-session';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { ExcelCatalogueRepository } from '../repositories/ExcelCatalogueRepository.js';
import { FileSessionStore } from '../services/FileSessionStore.js';

const roots: string[] = [];
async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jad-home-deployment-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true, maxRetries: 3 })));
});

describe('Deployment durability', () => {
  it('checks readiness without mutating the Excel catalogue', async () => {
    env.catalogueBackend = 'excel';
    const root = await temporaryRoot();
    const catalogue = path.join(root, 'catalogue.xlsx');
    const uploads = path.join(root, 'uploads');
    const sessions = path.join(root, 'sessions');
    const backups = path.join(root, 'backups');
    await fs.mkdir(uploads, { recursive: true });
    const repository = new ExcelCatalogueRepository(catalogue, backups);
    await repository.initialize();
    const beforeHash = crypto.createHash('sha256').update(await fs.readFile(catalogue)).digest('hex');
    const beforeMtime = (await fs.stat(catalogue)).mtimeMs;

    const response = await request(createApp(repository, { uploadRoot: uploads, sessionDirectory: sessions, backupDirectory: backups })).get('/api/ready');
    expect(response.status).toBe(200);
    expect(response.body.data.checks).toEqual({ catalogue: 'excel', uploads: 'ok', backups: 'ok' });
    expect(crypto.createHash('sha256').update(await fs.readFile(catalogue)).digest('hex')).toBe(beforeHash);
    expect((await fs.stat(catalogue)).mtimeMs).toBe(beforeMtime);
  });

  it('keeps an authenticated session across store recreation', async () => {
    const root = await temporaryRoot();
    const value = { cookie: { maxAge: 60_000 }, admin: { email: 'admin@test.local' } } as unknown as session.SessionData;
    const first = new FileSessionStore(root);
    await new Promise<void>((resolve, reject) => first.set('persistent-session', value, (error) => error ? reject(error) : resolve()));
    first.close();

    const second = new FileSessionStore(root);
    const restored = await new Promise<session.SessionData | null | undefined>((resolve, reject) => second.get('persistent-session', (error, sessionValue) => error ? reject(error) : resolve(sessionValue)));
    second.close();
    expect(restored?.admin?.email).toBe('admin@test.local');
  });
});
