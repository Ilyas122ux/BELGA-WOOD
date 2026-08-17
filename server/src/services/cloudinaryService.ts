import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

export type CloudinarySignatureRequest = {
  folder: 'products' | 'categories';
};

const allowedFolders = new Set(['products', 'categories']);

export function configureCloudinary(): void {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) return;
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
}

export function cloudinaryReady(): boolean {
  return Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
}

export function assertCloudinaryPublicId(publicId: string): void {
  const root = `${env.cloudinaryUploadFolder}/`;
  if (!publicId.startsWith(root) || !/^jad-home\/(?:products|categories|legacy-migration)\/[a-zA-Z0-9/_-]+$/.test(publicId)) {
    throw new Error('Reference Cloudinary invalide.');
  }
}

export function createUploadSignature(input: CloudinarySignatureRequest) {
  if (!cloudinaryReady()) throw new Error('Cloudinary n est pas configure.');
  if (!allowedFolders.has(input.folder)) throw new Error('Dossier Cloudinary invalide.');
  configureCloudinary();
  const timestamp = Math.round(Date.now() / 1000);
  const folder = `${env.cloudinaryUploadFolder}/${input.folder}`;
  const publicId = `${Date.now()}-${crypto.randomUUID()}`;
  const params = {
    folder,
    public_id: publicId,
    timestamp,
  };
  const signature = cloudinary.utils.api_sign_request(params, env.cloudinaryApiSecret!);
  return {
    signatureVersion: 2,
    cloudName: env.cloudinaryCloudName,
    apiKey: env.cloudinaryApiKey,
    timestamp,
    signature,
    folder,
    publicId,
    maxBytes: 8 * 1024 * 1024,
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
  };
}

export async function deleteCloudinaryAsset(publicId: string): Promise<void> {
  assertCloudinaryPublicId(publicId);
  configureCloudinary();
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}

export function optimizedCloudinaryUrl(secureUrl: string, width = 1600): string {
  return secureUrl.replace('/upload/', `/upload/f_auto,q_auto,c_limit,w_${width}/`);
}
