#!/usr/bin/env node
import './load-env.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { auditLocalData, sha256 } from './catalogue-audit-lib.mjs';

const apply = process.argv.includes('--apply');
const report = await auditLocalData();
const entries = [];
for (const product of report.catalogue.products) {
  for (let index = 1; index <= 6; index += 1) {
    const value = product[`image_${index}`];
    if (value?.startsWith('/uploads/')) entries.push({ ownerType: 'product', owner: product.id || product.slug, oldPath: value });
  }
}
for (const category of report.catalogue.categories) {
  if (category.image?.startsWith('/uploads/')) entries.push({ ownerType: 'category', owner: category.id || category.slug, oldPath: category.image });
}
for (const entry of entries) {
  const localPath = path.join('server/storage', entry.oldPath.replace(/^\/uploads\//, 'uploads/'));
  entry.localPath = localPath;
  entry.exists = await fs.access(localPath).then(() => true, () => false);
  entry.checksum = entry.exists ? await sha256(localPath) : null;
  entry.publicId = `jad-home/legacy-migration/${entry.checksum || entry.oldPath.replace(/[^a-z0-9]/gi, '-')}`;
}
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', total: entries.length, missing: entries.filter((entry) => !entry.exists).length, entries }, null, 2));
if (!apply) process.exit(entries.some((entry) => !entry.exists) ? 1 : 0);
for (const name of ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']) {
  if (!process.env[name] || process.env[name] === 'CHANGE_ME') throw new Error(`${name} est requis pour --apply.`);
}
if (entries.some((entry) => !entry.exists)) throw new Error('Migration interrompue: des images locales referencees sont manquantes.');
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
for (const entry of entries) {
  try {
    const result = await cloudinary.uploader.upload(entry.localPath, {
      public_id: entry.publicId,
      overwrite: false,
      resource_type: 'image',
    });
    entry.result = 'uploaded';
    entry.secureUrl = result.secure_url;
    entry.cloudinaryPublicId = result.public_id;
    entry.width = result.width;
    entry.height = result.height;
    entry.format = result.format;
    entry.bytes = result.bytes;
  } catch (error) {
    if (String(error?.message || error).includes('already exists')) {
      entry.result = 'already-exists';
      continue;
    }
    entry.result = 'error';
    entry.error = String(error?.message || error);
  }
}
await fs.mkdir('.tmp/migrations', { recursive: true });
await fs.writeFile(`.tmp/migrations/images-to-cloudinary-${Date.now()}.json`, JSON.stringify({ appliedAt: new Date().toISOString(), entries, note: 'Les originaux locaux sont conserves. Relance possible: publicId stable par checksum.' }, null, 2));
console.log('Manifest image cree. Les originaux locaux sont conserves.');
