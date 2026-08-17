import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import yauzl from 'yauzl';
import { describe, expect, it, vi } from 'vitest';

const repositoryRoot = path.resolve(process.cwd(), '..');
const functionPath = path.join(repositoryRoot, 'netlify', 'functions', 'api.mts');
const npmCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

async function readZipEntry(zipPath: string, entryName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(openError || new Error(`Archive Netlify illisible: ${zipPath}`));
        return;
      }
      zipFile.readEntry();
      zipFile.on('entry', (entry) => {
        if (entry.fileName !== entryName) {
          zipFile.readEntry();
          return;
        }
        zipFile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            zipFile.close();
            reject(streamError || new Error(`Entrée Netlify illisible: ${entryName}`));
            return;
          }
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('error', (error) => {
            zipFile.close();
            reject(error);
          });
          stream.on('end', () => {
            zipFile.close();
            resolve(Buffer.concat(chunks));
          });
        });
      });
      zipFile.on('end', () => {
        reject(new Error(`Entrée Netlify absente: ${entryName}`));
      });
      zipFile.on('error', reject);
    });
  });
}

describe('Netlify API function runtime', () => {
  it('uses the modern Netlify default export wrapped with Lambda compatibility', async () => {
    const source = await fs.readFile(functionPath, 'utf8');

    expect(source).toContain("@netlify/aws-lambda-compat");
    expect(source).toContain('withLambda');
    expect(source).toContain('export default withLambda(lambdaHandler)');
    expect(source).toContain('createOrderRepository');
    expect(source).not.toContain('export const handler');
    expect(source).not.toContain('from \'@netlify/functions\'');
  });

  it('can be imported without starting an HTTP listener', async () => {
    const listenSpy = vi.spyOn(http.Server.prototype, 'listen');

    try {
      const moduleUrl = `${pathToFileURL(functionPath).href}?runtime-test=${Date.now()}`;
      const importedFunction = await import(moduleUrl);

      expect(typeof importedFunction.default).toBe('function');
      expect(listenSpy).not.toHaveBeenCalled();
    } finally {
      listenSpy.mockRestore();
    }
  }, 30_000);

  it('runs the real Netlify bundled ESM function without fileURLToPath/import.meta.url crashes', async () => {
    const temporaryParent = path.join(repositoryRoot, '.tmp');
    await fs.mkdir(temporaryParent, { recursive: true });
    const functionsOutput = await fs.mkdtemp(path.join(temporaryParent, 'netlify-functions-build-'));
    const extractedOutput = await fs.mkdtemp(path.join(temporaryParent, 'netlify-functions-unzipped-'));
    const listenSpy = vi.spyOn(http.Server.prototype, 'listen');
    const previousEnv = {
      NETLIFY: process.env.NETLIFY,
      AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
      NODE_ENV: process.env.NODE_ENV,
      CATALOGUE_BACKEND: process.env.CATALOGUE_BACKEND,
      CLIENT_URL: process.env.CLIENT_URL,
      ADMIN_EMAIL: process.env.ADMIN_EMAIL,
      ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
      SESSION_SECRET: process.env.SESSION_SECRET,
      GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64,
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    };

    try {
      const buildResult = spawnSync(npmCommand, [
        'netlify',
        'functions:build',
        '--filter',
        '@jad-home/client',
        '--src',
        'netlify/functions',
        '--functions',
        functionsOutput,
      ], {
        cwd: repositoryRoot,
        env: { ...process.env },
        encoding: 'utf8',
        shell: process.platform === 'win32',
      });
      expect(`${buildResult.stdout}\n${buildResult.stderr}`).not.toMatch(/api\.cjs/);
      expect(buildResult.status).toBe(0);

      const manifest = JSON.parse(await fs.readFile(path.join(functionsOutput, 'manifest.json'), 'utf8')) as {
        functions: Array<{ mainFile: string; path: string }>;
      };
      expect(manifest.functions[0]?.mainFile.replace(/\\/g, '/')).toContain('/netlify/functions/api.mts');

      const functionDirectory = path.join(extractedOutput, 'netlify', 'functions');
      await fs.mkdir(functionDirectory, { recursive: true });
      const zipPath = path.join(functionsOutput, 'api.zip');
      const bundlePath = path.join(functionDirectory, 'api.mjs');
      const bundleBuffer = await readZipEntry(zipPath, 'netlify/functions/api.mjs');
      await fs.writeFile(bundlePath, bundleBuffer);

      await expect(readZipEntry(zipPath, 'netlify/functions/api.cjs')).rejects.toThrow('Entrée Netlify absente');

      const entrypoint = (await readZipEntry(zipPath, '___netlify-entry-point.mjs')).toString('utf8');
      expect(entrypoint).toContain('./netlify/functions/api.mjs');
      expect(entrypoint).not.toContain('./netlify/functions/api.cjs');

      const bundleSource = bundleBuffer.toString('utf8');
      expect(bundleSource).toContain('import.meta.url');
      expect(bundleSource).toContain('fileURLToPath');
      expect(bundleSource).not.toContain('fileURLToPath(void 0)');
      expect(bundleSource).not.toContain('fileURLToPath(undefined)');

      process.env.NETLIFY = 'true';
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'jad-home-api-test';
      process.env.NODE_ENV = 'production';
      delete process.env.CATALOGUE_BACKEND;
      process.env.CLIENT_URL = 'https://jad-home.example';
      process.env.ADMIN_EMAIL = 'admin@example.com';
      process.env.ADMIN_PASSWORD_HASH = '$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1';
      process.env.SESSION_SECRET = 'test-session-secret-with-more-than-32-characters';
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID = 'abcdefghijklmnopqrstuvwxyz';
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 = Buffer.from(JSON.stringify({
        client_email: 'jad-home-test@example.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nTEST PRIVATE KEY\n-----END PRIVATE KEY-----\n',
      })).toString('base64');
      process.env.CLOUDINARY_CLOUD_NAME = 'jad-home-test';
      process.env.CLOUDINARY_API_KEY = '123456789';
      process.env.CLOUDINARY_API_SECRET = 'test-cloudinary-secret';

      const importedFunction = await import(`${pathToFileURL(bundlePath).href}?runtime-test=${Date.now()}`) as {
        default: (request: Request, context: { requestId: string }) => Promise<Response>;
      };
      expect(typeof importedFunction.default).toBe('function');

      const context = { requestId: 'netlify-runtime-test' };
      const healthResponse = await importedFunction.default(new Request('https://jad-home.example/api/health'), context);
      expect(healthResponse.status).toBe(200);
      const healthBody = await healthResponse.json() as { data: { catalogueBackend: string } };
      expect(healthBody.data.catalogueBackend).toBe('google-sheets');

      const readyResponse = await importedFunction.default(new Request('https://jad-home.example/api/ready'), context);
      expect([200, 503]).toContain(readyResponse.status);
      const readyBody = await readyResponse.json() as { data: { catalogueBackend: string } };
      expect(readyBody.data.catalogueBackend).toBe('google-sheets');
      expect(listenSpy).not.toHaveBeenCalled();
    } finally {
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      listenSpy.mockRestore();
      await fs.rm(functionsOutput, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(() => undefined);
      await fs.rm(extractedOutput, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(() => undefined);
    }
  }, 120_000);
});
