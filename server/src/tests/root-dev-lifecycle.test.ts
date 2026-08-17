import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { Readable } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(testsDirectory, '../..');
const projectRoot = path.resolve(serverRoot, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

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

describe('Commande racine npm run dev', () => {
  it('garde API et Vite actifs ensemble et attend le health check API', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jad-home-root-dev-'));
    const apiPort = await unusedPort();
    const clientPort = await unusedPort();
    const child = spawn(npmCommand, ['run', 'dev'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        CATALOGUE_BACKEND: 'excel',
        STORAGE_ROOT: root,
        PORT: String(apiPort),
        CLIENT_DEV_PORT: String(clientPort),
        ALLOW_CATALOGUE_INITIALIZATION: 'true',
        JAD_HOME_DEV_SMOKE_DURATION_MS: '5000',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    }) as ChildProcessByStdio<null, Readable, Readable>;
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });

    try {
      const [code, signal] = await once(child, 'exit') as [number | null, NodeJS.Signals | null];
      expect(signal).toBeNull();
      expect(code).toBe(0);
      expect(output).toContain(`API ready http://127.0.0.1:${apiPort} catalogueBackend=excel`);
      expect(output).toContain(`WEB ready http://127.0.0.1:${clientPort}`);
      expect(output).toMatch(/smoke completed healthChecks=\d+/);
      expect(output).not.toMatch(/ECONNREFUSED|socket hang up|ERR_SERVER_NOT_RUNNING|unhandledRejection|uncaughtException|ERR_HTTP_HEADERS_SENT/i);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
        await once(child, 'exit').catch(() => undefined);
      }
      await fs.rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }, 90_000);
});
