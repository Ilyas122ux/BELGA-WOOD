import { describe, expect, it } from 'vitest';
import { env } from '../config/env.js';
import { createUploadSignature } from '../services/cloudinaryService.js';

describe('Signature upload Cloudinary', () => {
  it('signe un upload avec dossier controle et public_id non imbrique', () => {
    env.cloudinaryCloudName = 'demo-cloud';
    env.cloudinaryApiKey = 'demo-key';
    env.cloudinaryApiSecret = 'demo-secret';
    env.cloudinaryUploadFolder = 'jad-home';

    const signature = createUploadSignature({ folder: 'products' });

    expect(signature.cloudName).toBe('demo-cloud');
    expect(signature.apiKey).toBe('demo-key');
    expect(signature.folder).toBe('jad-home/products');
    expect(signature.publicId).toMatch(/^\d+-[0-9a-f-]{36}$/);
    expect(signature.publicId).not.toContain('jad-home/products');
    expect(signature.signature).toMatch(/^[a-f0-9]{40}$/);
  });
});
