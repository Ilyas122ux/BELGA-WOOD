import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { paths } from '../config/env.js';

const productUploadRoot = path.join(paths.uploads, 'products');
const categoryUploadRoot = path.join(paths.uploads, 'categories');

async function writeOptimizedImage(input: Buffer, destination: string, width: number, height: number, fit: 'inside' | 'cover'): Promise<void> {
  const temporary = path.join(path.dirname(destination), `.${path.basename(destination)}.${crypto.randomUUID()}.tmp`);
  try {
    await sharp(input, { animated: false, failOn: 'error', limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width, height, fit, withoutEnlargement: true })
      .webp({ quality: 84, effort: 5 })
      .toFile(temporary);
    await fs.rename(temporary, destination);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function processProductImages(files: Express.Multer.File[] = [], outputRoot = productUploadRoot): Promise<string[]> {
  await fs.mkdir(outputRoot, { recursive: true });
  return Promise.all(files.slice(0, 6).map(async (file) => {
    const name = `${Date.now()}-${crypto.randomUUID()}.webp`;
    const destination = path.join(outputRoot, name);
    await writeOptimizedImage(file.buffer, destination, 1600, 1600, 'inside');
    return `/uploads/products/${name}`;
  }));
}

export async function processCategoryImage(file: Express.Multer.File, outputRoot = categoryUploadRoot): Promise<string> {
  await fs.mkdir(outputRoot, { recursive: true });
  const name = `${Date.now()}-${crypto.randomUUID()}.webp`;
  await writeOptimizedImage(file.buffer, path.join(outputRoot, name), 1400, 1400, 'cover');
  return `/uploads/categories/${name}`;
}
