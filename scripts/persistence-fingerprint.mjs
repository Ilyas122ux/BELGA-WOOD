#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const [mode, cataloguePath, uploadDirectory, manifestPath] = process.argv.slice(2);
if (!['write', 'check'].includes(mode) || !cataloguePath || !uploadDirectory || !manifestPath) {
  console.error('Usage: node persistence-fingerprint.mjs <write|check> <catalogue.xlsx> <uploads-dir> <manifest.json>');
  process.exit(2);
}

async function digest(file) {
  return crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

async function filesBelow(root, current = root) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const result = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) result.push(...await filesBelow(root, full));
    else if (entry.isFile()) result.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return result;
}

async function fingerprint() {
  const uploads = {};
  for (const relative of await filesBelow(uploadDirectory)) {
    uploads[relative] = await digest(path.join(uploadDirectory, relative));
  }
  return {
    schema: 1,
    catalogue: await digest(cataloguePath),
    uploads,
  };
}

try {
  const current = await fingerprint();
  if (mode === 'write') {
    await fs.writeFile(manifestPath, `${JSON.stringify(current, null, 2)}\n`, { mode: 0o640 });
    console.log(`Fingerprint écrit: ${manifestPath}`);
  } else {
    const expected = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('la base Excel ou les uploads diffèrent de la référence');
    console.log('Fingerprint persistant identique.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
