import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import { ExcelCatalogueRepository } from '../repositories/ExcelCatalogueRepository.js';
import { buildWhatsAppMessage } from '../services/whatsappService.js';

let root: string;
let repository: ExcelCatalogueRepository;
beforeAll(async()=>{env.catalogueBackend='excel';env.clientUrl='http://localhost:5173';root=await fs.mkdtemp(path.join(os.tmpdir(),'jad-home-api-'));repository=new ExcelCatalogueRepository(path.join(root,'catalogue.xlsx'),path.join(root,'backups'));await repository.initialize();});
afterAll(async()=>{await fs.rm(root,{recursive:true,force:true});});

describe('Sécurité et commande',()=>{
  it('protège les routes administrateur',async()=>{const response=await request(createApp(repository,{sessionDirectory:path.join(root,'sessions')})).get('/api/admin/products');expect(response.status).toBe(401);expect(response.body.success).toBe(false);});
  it('laisse publiques les routes catalogue',async()=>{const response=await request(createApp(repository,{sessionDirectory:path.join(root,'sessions')})).get('/api/products');expect(response.status).toBe(200);expect(response.body.data.total).toBe(8);});
  it('accepte localhost et 127.0.0.1 en développement mais refuse une origine externe',async()=>{
    const app=createApp(repository,{sessionDirectory:path.join(root,'sessions')});
    const loopback=await request(app).post('/api/auth/logout').set('Origin','http://127.0.0.1:5173');
    expect(loopback.status).toBe(200);
    expect(loopback.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    const external=await request(app).post('/api/auth/logout').set('Origin','https://evil.example');
    expect(external.status).toBe(403);
    expect(external.body.message).toBe('Origine non autorisée.');
  });
  it('génère un message WhatsApp complet avec total',()=>{const message=buildWhatsAppMessage({reference:'JH-TEST',fullName:'Sara Test',phone:'0612345678',city:'Rabat',address:'10 rue Exemple'},[{productId:'1',slug:'nora',name:'Canapé Nora',image:'',price:1500,quantity:2,color:'Ivoire',maxStock:5}]);expect(message).toContain('JH-TEST');expect(message).toContain('Canapé Nora');expect(message).toContain('3 000,00 DH');});
});
