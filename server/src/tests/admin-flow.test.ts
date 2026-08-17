import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcrypt';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { ExcelCatalogueRepository } from '../repositories/ExcelCatalogueRepository.js';

let root: string;
let repository: ExcelCatalogueRepository;

beforeAll(async()=>{
  env.catalogueBackend='excel';
  root=await fs.mkdtemp(path.join(os.tmpdir(),'jad-home-admin-flow-'));
  repository=new ExcelCatalogueRepository(path.join(root,'catalogue.xlsx'),path.join(root,'backups'));
  await repository.initialize();
  env.adminEmail='admin-test@jadhome.ma';
  env.adminPasswordHash=await bcrypt.hash('TestPassword!42',4);
});
afterAll(async()=>{await new Promise((resolve)=>setTimeout(resolve,100));await fs.rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});});

describe('Parcours administrateur principal',()=>{
  it('se connecte, ajoute un produit avec deux photos et le publie sans redéploiement',async()=>{
    const uploadRoot=path.join(root,'uploads');
    const app=createApp(repository,{uploadRoot,sessionDirectory:path.join(root,'sessions')});
    const agent=request.agent(app);
    const login=await agent.post('/api/auth/login').send({email:'admin-test@jadhome.ma',password:'TestPassword!42'});
    expect(login.status).toBe(200);
    const cookie=(login.headers['set-cookie'] as unknown as string[]).map((value)=>value.split(';')[0]).join('; ');
    const first=await sharp({create:{width:60,height:60,channels:3,background:'#f1e6d1'}}).png().toBuffer();
    const second=await sharp({create:{width:60,height:60,channels:3,background:'#d2aa18'}}).jpeg().toBuffer();
    const input={slug:'produit-flux-admin',name_fr:'Produit Flux Admin',name_ar:'منتج الإدارة',short_description_fr:'Ajouté pendant le test',short_description_ar:'اختبار',description_fr:'Produit de validation',description_ar:'اختبار',category_id:'cat-canapes',price:2490,old_price:'',currency:'MAD',stock_quantity:5,featured:true,new_arrival:true,promotion:false,active:true,colors:['Ivoire'],dimensions:'120 × 60 cm',materials:['Bois'],existing_images:[]};
    const created=await agent.post('/api/admin/products').field('product',JSON.stringify(input)).attach('images',first,'face.png').attach('images',second,'detail.jpg');
    expect(created.status).toBe(201);
    expect(created.body.data.images).toHaveLength(2);
    const uploadedFiles=await fs.readdir(path.join(uploadRoot,'products'));
    expect(uploadedFiles).toHaveLength(2);
    await Promise.all(uploadedFiles.map((name)=>fs.access(path.join(uploadRoot,'products',name))));

    const restartedApp=createApp(repository,{uploadRoot,sessionDirectory:path.join(root,'sessions')});
    const publicProduct=await request(restartedApp).get('/api/products/produit-flux-admin');
    expect(publicProduct.status).toBe(200);
    expect(publicProduct.body.data.price).toBe(2490);
    const updatedInput={...input,price:2590,existing_images:created.body.data.images};
    const updated=await request(restartedApp).put(`/api/admin/products/${created.body.data.id}`).set('Cookie',cookie).field('product',JSON.stringify(updatedInput));
    expect(updated.status).toBe(200);
    expect(updated.body.data.price).toBe(2590);
    expect((await repository.getProduct(created.body.data.id,true))?.price).toBe(2590);
    const categoryImage=await agent.post('/api/admin/categories/upload').attach('image',first,'categorie.png');
    expect(categoryImage.status).toBe(201);
    expect(categoryImage.body.data.path).toMatch(/^\/uploads\/categories\/.+\.webp$/);
    expect((await fs.readdir(path.join(uploadRoot,'categories')))).toHaveLength(1);
  });
});
