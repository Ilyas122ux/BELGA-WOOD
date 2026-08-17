import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync, { type Dirent } from 'node:fs';
import path from 'node:path';
import session from 'express-session';

declare module 'express-session' {
  interface SessionData { admin?: { email: string }; }
}

type Callback = (error?: unknown) => void;
type GetCallback = (error: unknown, value?: session.SessionData | null) => void;

type StoredSession = {
  expiresAt: number;
  session: session.SessionData;
};

type SessionFileSystem = {
  mkdir(target: string, options: { recursive: true; mode?: number }): Promise<void>;
  readFile(target: string, encoding: 'utf8'): Promise<string>;
  writeFile(target: string, data: string, options: { encoding: 'utf8'; mode: number }): Promise<void>;
  rm(target: string, options: { force: true }): Promise<void>;
  readdir(target: string, options: { withFileTypes: true }): Promise<Dirent[]>;
};

export type FileSessionStoreOptions = {
  cleanupIntervalMs?: number;
  touchIntervalMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  now?: () => number;
  fileSystem?: Partial<SessionFileSystem>;
};

const transientWindowsErrors = new Set(['EPERM', 'EACCES', 'EBUSY']);
const nodeFileSystem: SessionFileSystem = {
  mkdir: async (target, options) => { await fs.mkdir(target, options); },
  readFile: (target, encoding) => fs.readFile(target, encoding),
  writeFile: (target, data, options) => fs.writeFile(target, data, options),
  rm: async (target, options) => { await fs.rm(target, options); },
  readdir: (target, options) => fs.readdir(target, options),
};

/** A durable store for this application's low-volume, single-instance admin sessions. */
export class FileSessionStore extends session.Store {
  private readonly directory: string;
  private readonly cleanupTimer?: NodeJS.Timeout;
  private readonly pending = new Map<string, Promise<void>>();
  private readonly fileSystem: SessionFileSystem;
  private readonly touchIntervalMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly now: () => number;
  private cleanupRuns = 0;

  constructor(directory: string, options: FileSessionStoreOptions = {}) {
    super();
    this.directory = path.resolve(directory);
    this.fileSystem = { ...nodeFileSystem, ...options.fileSystem };
    this.touchIntervalMs = Math.max(0, options.touchIntervalMs ?? 60_000);
    this.maxRetries = Math.max(0, options.maxRetries ?? 4);
    this.retryDelayMs = Math.max(0, options.retryDelayMs ?? 15);
    this.now = options.now ?? Date.now;
    fsSync.mkdirSync(this.directory, { recursive: true, mode: 0o750 });
    const cleanupIntervalMs = options.cleanupIntervalMs ?? 60 * 60_000;
    if (cleanupIntervalMs > 0) {
      this.cleanupTimer = setInterval(() => {
        void this.prune().catch((error: unknown) => {
          console.error('Nettoyage des sessions impossible.', error);
        });
      }, cleanupIntervalMs);
      this.cleanupTimer.unref();
    }
  }

  get pendingOperationCount(): number {
    return this.pending.size;
  }

  get cleanupRunCount(): number {
    return this.cleanupRuns;
  }

  private sessionKey(sid: string): string {
    return crypto.createHash('sha256').update(sid).digest('hex');
  }

  private filePathForKey(key: string): string {
    return path.join(this.directory, `${key}.json`);
  }

  private filePath(sid: string): string {
    return this.filePathForKey(this.sessionKey(sid));
  }

  private expiry(value: session.SessionData): number {
    const cookieExpiry = value.cookie?.expires;
    if (cookieExpiry) return new Date(cookieExpiry).getTime();
    return this.now() + (value.cookie?.maxAge ?? 8 * 60 * 60_000);
  }

  private clone(value: session.SessionData): session.SessionData {
    return JSON.parse(JSON.stringify(value)) as session.SessionData;
  }

  private parse(value: string): StoredSession {
    const parsed = JSON.parse(value) as Partial<StoredSession>;
    if (!Number.isFinite(parsed.expiresAt) || !parsed.session || typeof parsed.session !== 'object') {
      throw new Error('Fichier de session JSON invalide.');
    }
    return parsed as StoredSession;
  }

  private async retryTransient<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (!code || !transientWindowsErrors.has(code) || attempt >= this.maxRetries) throw error;
        const delay = this.retryDelayMs * (attempt + 1);
        if (delay > 0) await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private runExclusive<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.pending.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    const tail = current.then(() => undefined, () => undefined);
    this.pending.set(key, tail);
    void tail.then(() => {
      if (this.pending.get(key) === tail) this.pending.delete(key);
    });
    return current;
  }

  private async removeFile(file: string): Promise<void> {
    await this.retryTransient(() => this.fileSystem.rm(file, { force: true }));
  }

  private async readStored(file: string): Promise<StoredSession | null> {
    try {
      return this.parse(await this.retryTransient(() => this.fileSystem.readFile(file, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  private async writeStored(file: string, stored: StoredSession): Promise<void> {
    const serialized = JSON.stringify(stored);
    this.parse(serialized);
    await this.fileSystem.mkdir(this.directory, { recursive: true, mode: 0o750 });
    await this.retryTransient(() => this.fileSystem.writeFile(file, serialized, { encoding: 'utf8', mode: 0o640 }));
    try {
      this.parse(await this.retryTransient(() => this.fileSystem.readFile(file, 'utf8')));
    } catch (error) {
      await this.removeFile(file).catch(() => undefined);
      throw error;
    }
  }

  override get(sid: string, callback: GetCallback): void {
    const key = this.sessionKey(sid);
    void this.runExclusive(key, async () => {
      const file = this.filePathForKey(key);
      const stored = await this.readStored(file);
      if (!stored) return null;
      if (!stored.expiresAt || stored.expiresAt <= this.now()) {
        await this.removeFile(file);
        return null;
      }
      return stored.session;
    }).then((value) => callback(null, value), (error) => callback(error));
  }

  override set(sid: string, value: session.SessionData, callback: Callback = () => undefined): void {
    const key = this.sessionKey(sid);
    const snapshot = this.clone(value);
    const expiresAt = this.expiry(snapshot);
    void this.runExclusive(key, () => this.writeStored(this.filePathForKey(key), { expiresAt, session: snapshot }))
      .then(() => callback(), (error) => callback(error));
  }

  override destroy(sid: string, callback: Callback = () => undefined): void {
    const key = this.sessionKey(sid);
    void this.runExclusive(key, () => this.removeFile(this.filePathForKey(key)))
      .then(() => callback(), (error) => callback(error));
  }

  override touch(sid: string, value: session.SessionData, callback: Callback = () => undefined): void {
    const key = this.sessionKey(sid);
    const snapshot = this.clone(value);
    const nextExpiresAt = this.expiry(snapshot);
    void this.runExclusive(key, async () => {
      const file = this.filePathForKey(key);
      const stored = await this.readStored(file);
      if (!stored) return;
      if (stored.expiresAt <= this.now()) {
        await this.removeFile(file);
        return;
      }
      if (nextExpiresAt <= stored.expiresAt + this.touchIntervalMs) return;
      const updated: session.SessionData = { ...stored.session, cookie: snapshot.cookie ?? stored.session.cookie };
      await this.writeStored(file, { expiresAt: nextExpiresAt, session: updated });
    }).then(() => callback(), (error) => callback(error));
  }

  async prune(): Promise<void> {
    this.cleanupRuns += 1;
    await this.fileSystem.mkdir(this.directory, { recursive: true, mode: 0o750 });
    const entries = await this.fileSystem.readdir(this.directory, { withFileTypes: true });
    await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => {
      if (entry.name.endsWith('.tmp')) {
        const key = entry.name.slice(0, 64);
        await this.runExclusive(key, () => this.removeFile(path.join(this.directory, entry.name)));
        return;
      }
      if (!entry.name.endsWith('.json')) return;
      const key = entry.name.slice(0, -'.json'.length);
      await this.runExclusive(key, async () => {
        const file = path.join(this.directory, entry.name);
        try {
          const stored = await this.readStored(file);
          if (!stored || !stored.expiresAt || stored.expiresAt <= this.now()) await this.removeFile(file);
        } catch {
          await this.removeFile(file);
        }
      });
    }));
  }

  close(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
}
