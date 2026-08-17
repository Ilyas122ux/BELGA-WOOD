import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(testsDirectory, '../..');

async function unusedPort(): Promise<number> {
  const server = http.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Port de test indisponible.');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
  description: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Delai depasse: ${description}`);
}

describe('Cycle de vie du processus HTTP', () => {
  it('reste actif sous charge et ne s arrete proprement qu apres SIGTERM', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jad-home-process-lifecycle-'));
    const port = await unusedPort();
    const base = `http://127.0.0.1:${port}`;
    const entry = path.join(serverRoot, 'src', 'index.ts');
    const child = spawn(process.execPath, ['--import', 'tsx', entry], {
      cwd: serverRoot,
      env: {
        ...process.env,
        PORT: String(port),
        STORAGE_ROOT: root,
        ALLOW_CATALOGUE_INITIALIZATION: 'true',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    }) as ChildProcessWithoutNullStreams;
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });

    try {
      try {
        await waitFor(async () => {
          try {
            const response = await fetch(`${base}/api/health`);
            return response.status === 200;
          } catch {
            return false;
          }
        }, 30_000, 'demarrage du serveur');
      } catch (error) {
        throw new Error(`${String(error)}\nchildPid=${child.pid} exitCode=${child.exitCode} signal=${child.signalCode}\n${output}`);
      }
      expect(child.exitCode).toBeNull();

      for (let index = 0; index < 200; index += 1) {
        const response = await fetch(`${base}/api/health`);
        expect(response.status).toBe(200);
      }
      const concurrent = await Promise.all(Array.from({ length: 40 }, () => fetch(`${base}/api/health`)));
      expect(concurrent.every((response) => response.status === 200)).toBe(true);
      expect(child.exitCode).toBeNull();
      expect((await fetch(`${base}/api/health`)).status).toBe(200);
      expect(child.kill('SIGTERM')).toBe(true);
      const [code, signal] = await once(child, 'exit') as [number | null, NodeJS.Signals | null];
      if (process.platform === 'win32') {
        expect(signal).toBe('SIGTERM');
        expect(code).toBeNull();
        expect(output).not.toContain('[process] SIGTERM');
      } else {
        expect(signal).toBeNull();
        expect(code).toBe(0);
        expect(output).toContain('[process] SIGTERM');
        expect(output).toContain('[server] close');
        expect(output).toContain('[server] stopped cause=SIGTERM code=0');
      }
      expect(output).not.toMatch(/uncaughtException|unhandledRejection|EPERM|EACCES|EBUSY/);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
        await once(child, 'exit').catch(() => undefined);
      }
      await fs.rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  }, 60_000);
});
