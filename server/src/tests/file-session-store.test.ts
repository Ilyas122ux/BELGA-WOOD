import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type session from 'express-session';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileSessionStore, type FileSessionStoreOptions } from '../services/FileSessionStore.js';

const roots: string[] = [];
const stores: FileSessionStore[] = [];

function value(email: string, maxAge = 60_000, expires?: Date): session.SessionData {
  return { cookie: { maxAge, ...(expires ? { expires } : {}) }, admin: { email } } as unknown as session.SessionData;
}

async function root(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jad-home-session-store-'));
  roots.push(directory);
  return directory;
}

function store(directory: string, options: FileSessionStoreOptions = {}): FileSessionStore {
  const instance = new FileSessionStore(directory, { cleanupIntervalMs: 0, retryDelayMs: 0, ...options });
  stores.push(instance);
  return instance;
}

function setSession(instance: FileSessionStore, sid: string, sessionValue: session.SessionData): Promise<void> {
  return new Promise((resolve, reject) => instance.set(sid, sessionValue, (error) => error ? reject(error) : resolve()));
}

function touchSession(instance: FileSessionStore, sid: string, sessionValue: session.SessionData): Promise<void> {
  return new Promise((resolve, reject) => instance.touch(sid, sessionValue, (error) => error ? reject(error) : resolve()));
}

function getSession(instance: FileSessionStore, sid: string): Promise<session.SessionData | null | undefined> {
  return new Promise((resolve, reject) => instance.get(sid, (error, sessionValue) => error ? reject(error) : resolve(sessionValue)));
}

function destroySession(instance: FileSessionStore, sid: string): Promise<void> {
  return new Promise((resolve, reject) => instance.destroy(sid, (error) => error ? reject(error) : resolve()));
}

afterEach(async () => {
  stores.splice(0).forEach((instance) => instance.close());
  await Promise.all(roots.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 })));
});

describe('FileSessionStore', () => {
  it('sérialise 50 set sur la même session et conserve un JSON valide', async () => {
    const directory = await root();
    const instance = store(directory);
    await Promise.all(Array.from({ length: 50 }, (_, index) => setSession(instance, 'same-session', value(`admin-${index}@test.local`))));

    const restored = await getSession(instance, 'same-session');
    expect(restored?.admin?.email).toBe('admin-49@test.local');
    expect(instance.pendingOperationCount).toBe(0);
    const files = await fs.readdir(directory);
    expect(files.filter((name) => name.endsWith('.json'))).toHaveLength(1);
    expect(files.filter((name) => name.endsWith('.tmp'))).toHaveLength(0);
    const json = await fs.readFile(path.join(directory, files[0]), 'utf8');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('fusionne 50 touch concurrents sans réécrire une expiration inchangée', async () => {
    const directory = await root();
    let writes = 0;
    const instance = store(directory, {
      touchIntervalMs: 60_000,
      fileSystem: {
        writeFile: async (target, data, options) => {
          writes += 1;
          await fs.writeFile(target, data, options);
        },
      },
    });
    const expires = new Date(Date.now() + 10 * 60_000);
    const sessionValue = value('touch@test.local', 10 * 60_000, expires);
    await setSession(instance, 'touch-session', sessionValue);
    await Promise.all(Array.from({ length: 50 }, () => touchSession(instance, 'touch-session', sessionValue)));

    expect(writes).toBe(1);
    expect((await getSession(instance, 'touch-session'))?.admin?.email).toBe('touch@test.local');
    expect(instance.pendingOperationCount).toBe(0);
  });

  it('ordonne set, touch et get sans qu’un touch obsolète écrase la session', async () => {
    const directory = await root();
    const instance = store(directory, { touchIntervalMs: 0 });
    await setSession(instance, 'mixed-session', value('initial@test.local'));

    const updated = value('updated@test.local', 120_000, new Date(Date.now() + 120_000));
    const staleTouch = value('stale@test.local', 180_000, new Date(Date.now() + 180_000));
    const setPromise = setSession(instance, 'mixed-session', updated);
    const touchPromise = touchSession(instance, 'mixed-session', staleTouch);
    const getPromise = getSession(instance, 'mixed-session');
    const [, , restored] = await Promise.all([setPromise, touchPromise, getPromise]);

    expect(restored?.admin?.email).toBe('updated@test.local');
    expect(instance.pendingOperationCount).toBe(0);
  });

  it('fait attendre destroy derrière les écritures précédentes', async () => {
    const directory = await root();
    const instance = store(directory);
    await setSession(instance, 'destroy-session', value('initial@test.local'));

    const write = setSession(instance, 'destroy-session', value('updated@test.local'));
    const destroy = destroySession(instance, 'destroy-session');
    const read = getSession(instance, 'destroy-session');
    const [, , restored] = await Promise.all([write, destroy, read]);
    expect(restored).toBeNull();
    expect(instance.pendingOperationCount).toBe(0);
  });

  it('laisse plusieurs identifiants de session s’écrire en parallèle', async () => {
    const directory = await root();
    let activeWrites = 0;
    let maximumParallelWrites = 0;
    const instance = store(directory, {
      fileSystem: {
        writeFile: async (target, data, options) => {
          activeWrites += 1;
          maximumParallelWrites = Math.max(maximumParallelWrites, activeWrites);
          await new Promise<void>((resolve) => setTimeout(resolve, 5));
          await fs.writeFile(target, data, options);
          activeWrites -= 1;
        },
      },
    });

    await Promise.all(Array.from({ length: 20 }, (_, index) => setSession(instance, `session-${index}`, value(`admin-${index}@test.local`))));
    expect(maximumParallelWrites).toBeGreaterThan(1);
    expect((await fs.readdir(directory)).filter((name) => name.endsWith('.json'))).toHaveLength(20);
    expect(instance.pendingOperationCount).toBe(0);
  });

  it('restaure une session admin après recréation du store', async () => {
    const directory = await root();
    const first = store(directory);
    await setSession(first, 'persistent-session', value('persistent@test.local'));
    first.close();

    const second = store(directory);
    expect((await getSession(second, 'persistent-session'))?.admin?.email).toBe('persistent@test.local');
  });

  it('réessaie un EPERM temporaire puis réussit', async () => {
    const directory = await root();
    let attempts = 0;
    const instance = store(directory, {
      maxRetries: 2,
      fileSystem: {
        writeFile: async (target, data, options) => {
          attempts += 1;
          if (attempts === 1) throw Object.assign(new Error('verrou Windows temporaire'), { code: 'EPERM' });
          await fs.writeFile(target, data, options);
        },
      },
    });

    await setSession(instance, 'retry-session', value('retry@test.local'));
    expect(attempts).toBe(2);
    expect((await getSession(instance, 'retry-session'))?.admin?.email).toBe('retry@test.local');
  });

  it('remonte un EPERM permanent proprement sans fichier temporaire', async () => {
    const directory = await root();
    let attempts = 0;
    const instance = store(directory, {
      maxRetries: 2,
      fileSystem: {
        writeFile: async () => {
          attempts += 1;
          throw Object.assign(new Error('verrou Windows permanent'), { code: 'EPERM' });
        },
      },
    });

    await expect(setSession(instance, 'blocked-session', value('blocked@test.local'))).rejects.toMatchObject({ code: 'EPERM' });
    expect(attempts).toBe(3);
    expect(instance.pendingOperationCount).toBe(0);
    expect((await fs.readdir(directory)).filter((name) => name.endsWith('.tmp'))).toHaveLength(0);
  });

  it('expire les anciennes sessions et supprime les fichiers temporaires historiques', async () => {
    const directory = await root();
    let now = Date.now();
    const instance = store(directory, { now: () => now });
    await setSession(instance, 'expired-session', value('expired@test.local', 1_000));
    await fs.writeFile(path.join(directory, `${'a'.repeat(64)}.json.legacy.tmp`), '{}', 'utf8');
    now += 2_000;

    await instance.prune();
    expect(await getSession(instance, 'expired-session')).toBeNull();
    const files = await fs.readdir(directory);
    expect(files.filter((name) => name.endsWith('.json'))).toHaveLength(0);
    expect(files.filter((name) => name.endsWith('.tmp'))).toHaveLength(0);
    expect(instance.pendingOperationCount).toBe(0);
  });

  it('capture les erreurs du timer de prune sans rejet non géré', async () => {
    const directory = await root();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const instance = store(directory, {
        cleanupIntervalMs: 10,
        fileSystem: {
          readdir: async () => { throw new Error('prune simulé'); },
        },
      });
      await setSession(instance, 'timer-session', value('timer@test.local'));
      await new Promise<void>((resolve) => setTimeout(resolve, 45));

      expect(instance.cleanupRunCount).toBeGreaterThanOrEqual(2);
      expect(consoleError).toHaveBeenCalled();
      expect((await getSession(instance, 'timer-session'))?.admin?.email).toBe('timer@test.local');
    } finally {
      consoleError.mockRestore();
    }
  });
});
