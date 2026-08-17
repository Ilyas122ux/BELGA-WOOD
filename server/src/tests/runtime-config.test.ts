import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { env as runtimeEnv } from '../config/env.js';
import { createCatalogueRepository } from '../repositories/createCatalogueRepository.js';

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(testsDirectory, '../..');

function runEval(code: string, env: Record<string, string | undefined>): string {
  return execFileSync(process.execPath, ['--import', 'tsx', '--eval', code], {
    cwd: serverRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  }).trim();
}

describe('Configuration runtime catalogue', () => {
  it('charge .env automatiquement en developpement local', () => {
    const output = runEval("import('./src/config/env.ts').then(({env})=>{console.log(env.catalogueBackend);process.exit(0);})", {});
    expect(['excel', 'google-sheets']).toContain(output);
  });

  it('selectionne GoogleSheetsCatalogueRepository quand CATALOGUE_BACKEND=google-sheets', () => {
    runtimeEnv.catalogueBackend = 'google-sheets';
    expect(createCatalogueRepository().constructor.name).toBe('GoogleSheetsCatalogueRepository');
  });

  it('ne retombe pas silencieusement sur Excel si google-sheets est incomplet', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--eval', "import('./src/repositories/createCatalogueRepository.ts').catch((error)=>{console.error(error.message);process.exit(42);})"], {
      cwd: serverRoot,
      env: {
        ...process.env,
        CATALOGUE_BACKEND: 'google-sheets',
        GOOGLE_SHEETS_SPREADSHEET_ID: '',
        GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: '',
        CLOUDINARY_CLOUD_NAME: '',
        CLOUDINARY_API_KEY: '',
        CLOUDINARY_API_SECRET: '',
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(42);
    expect(result.stderr).toContain('CATALOGUE_BACKEND=google-sheets exige');
    expect(result.stderr).not.toContain('ExcelCatalogueRepository');
  });

  it('conserve le mode legacy Excel explicite', () => {
    runtimeEnv.catalogueBackend = 'excel';
    expect(createCatalogueRepository().constructor.name).toBe('ExcelCatalogueRepository');
  });
});
