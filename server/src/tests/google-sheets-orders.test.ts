import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Order } from '@jad-home/shared';
import { GoogleSheetsOrderRepository, ORDER_HEADERS } from '../repositories/GoogleSheetsOrderRepository.js';

function order(): Order {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  return {
    id,
    orderNumber: `JH-20260727-${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`,
    clientRequestId: id,
    customerName: '=IMPORTXML("https://example.com")',
    customerPhone: '0612345678',
    customerWhatsapp: '',
    customerEmail: '',
    city: 'Rabat',
    address: '@adresse',
    additionalAddress: '',
    customerNote: '',
    items: [{
      productId: 'prd-1', sku: 'prd-1', slug: 'produit', nameFr: 'Produit',
      nameAr: 'منتج', imageUrl: '', quantity: 1, unitPrice: 100, lineTotal: 100,
      selectedColor: '', selectedMaterial: '', selectedDimensions: '',
    }],
    currency: 'MAD',
    subtotal: 100,
    deliveryFee: 0,
    total: 100,
    status: 'new',
    adminNote: '',
    statusHistory: [{ previousStatus: null, newStatus: 'new', changedAt: now, changedBy: 'customer:fr' }],
    createdAt: now,
    updatedAt: now,
    confirmedAt: '',
    cancelledAt: '',
    version: 1,
  };
}

describe('GoogleSheetsOrderRepository', () => {
  it('écrit en RAW, protège les formules et relit les JSON valides sans accès réel à Google', async () => {
    const rows: unknown[][] = [[...ORDER_HEADERS]];
    const inputOptions: string[] = [];
    const fake = {
      spreadsheets: {
        get: async () => ({ data: { sheets: [{ properties: { title: 'Orders' } }] } }),
        batchUpdate: async () => ({ data: {} }),
        values: {
          get: async () => ({ data: { values: rows } }),
          update: async ({ valueInputOption, requestBody, range }: { valueInputOption: string; requestBody: { values: unknown[][] }; range: string }) => {
            inputOptions.push(valueInputOption);
            if (range.includes('A1')) rows[0] = requestBody.values[0]!;
            else rows[1] = requestBody.values[0]!;
            return { data: {} };
          },
          append: async ({ valueInputOption, requestBody }: { valueInputOption: string; requestBody: { values: unknown[][] } }) => {
            inputOptions.push(valueInputOption);
            rows.push(requestBody.values[0]!);
            return { data: { updates: { updatedRange: `Orders!A${rows.length}:X${rows.length}` } } };
          },
          clear: async () => ({ data: {} }),
        },
      },
    };
    const repository = new GoogleSheetsOrderRepository('spreadsheet-test-orders', fake as never);
    await repository.initialize();
    const source = order();
    await repository.createIfAbsent(source);

    expect(inputOptions.every((option) => option === 'RAW')).toBe(true);
    expect(String(rows[1]?.[3])).toMatch(/^'=/);
    expect(String(rows[1]?.[8])).toMatch(/^'@/);
    expect(() => JSON.parse(String(rows[1]?.[11]))).not.toThrow();
    expect(() => JSON.parse(String(rows[1]?.[18]))).not.toThrow();

    const stored = await repository.getById(source.id);
    expect(stored?.customerName).toBe(source.customerName);
    expect(stored?.items[0].unitPrice).toBe(100);
  });
});
