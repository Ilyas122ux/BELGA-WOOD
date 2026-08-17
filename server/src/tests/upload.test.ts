import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processProductImages } from '../services/uploadService.js';

let root: string;
beforeAll(async()=>{root=await fs.mkdtemp(path.join(os.tmpdir(),'jad-home-upload-'));});
afterAll(async()=>{await new Promise((resolve)=>setTimeout(resolve,100));await fs.rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});});

describe('Upload produit',()=>{
  it('enregistre plusieurs images avec des noms sûrs au format WebP',async()=>{
    const first=await sharp({create:{width:40,height:40,channels:3,background:'#d2aa18'}}).png().toBuffer();
    const second=await sharp({create:{width:40,height:40,channels:3,background:'#211e1b'}}).jpeg().toBuffer();
    const files=[{buffer:first},{buffer:second}] as Express.Multer.File[];
    const paths=await processProductImages(files,root);
    expect(paths).toHaveLength(2);
    expect(paths.every(item=>/^\/uploads\/products\/[a-zA-Z0-9-]+\.webp$/.test(item))).toBe(true);
    const saved=await fs.readdir(root);
    expect(saved).toHaveLength(2);
    const savedBuffer=await fs.readFile(path.join(root,saved[0]));
    expect((await sharp(savedBuffer).metadata()).format).toBe('webp');
  });
});
