import { google, type sheets_v4 } from 'googleapis';
import type { Order, OrderItemSnapshot, OrderStatus, OrderStatusHistoryEntry, PaginatedOrders } from '@jad-home/shared';
import { ORDER_STATUSES } from '@jad-home/shared';
import { env } from '../config/env.js';
import type { OrderFilters, OrderMutationOptions, OrderRepository } from './OrderRepository.js';
import { OrderRepositoryError } from './OrderRepository.js';
import { paginateOrders } from './MemoryOrderRepository.js';

export const ORDER_HEADERS = [
  'id', 'orderNumber', 'clientRequestId', 'customerName', 'customerPhone',
  'customerWhatsapp', 'customerEmail', 'city', 'address', 'additionalAddress',
  'customerNote', 'itemsJson', 'currency', 'subtotal', 'deliveryFee', 'total',
  'status', 'adminNote', 'statusHistoryJson', 'createdAt', 'updatedAt',
  'confirmedAt', 'cancelledAt', 'version',
] as const;

type OrderRow = { order: Order; rowNumber: number };

function safeCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function restoredCell(value: unknown): string {
  return String(value ?? '').replace(/^'(?=[=+\-@])/, '');
}

function numberCell(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    return JSON.parse(restoredCell(value)) as T;
  } catch {
    return fallback;
  }
}

function toRow(order: Order): string[] {
  const record: Record<typeof ORDER_HEADERS[number], unknown> = {
    id: order.id,
    orderNumber: order.orderNumber,
    clientRequestId: order.clientRequestId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerWhatsapp: order.customerWhatsapp,
    customerEmail: order.customerEmail,
    city: order.city,
    address: order.address,
    additionalAddress: order.additionalAddress,
    customerNote: order.customerNote,
    itemsJson: JSON.stringify(order.items),
    currency: order.currency,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    status: order.status,
    adminNote: order.adminNote,
    statusHistoryJson: JSON.stringify(order.statusHistory),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    confirmedAt: order.confirmedAt,
    cancelledAt: order.cancelledAt,
    version: order.version,
  };
  return ORDER_HEADERS.map((header) => safeCell(record[header]));
}

function fromRecord(record: Record<string, unknown>): Order | undefined {
  const status = restoredCell(record.status) as OrderStatus;
  if (!restoredCell(record.id) || !ORDER_STATUSES.includes(status)) return undefined;
  return {
    id: restoredCell(record.id),
    orderNumber: restoredCell(record.orderNumber),
    clientRequestId: restoredCell(record.clientRequestId),
    customerName: restoredCell(record.customerName),
    customerPhone: restoredCell(record.customerPhone),
    customerWhatsapp: restoredCell(record.customerWhatsapp),
    customerEmail: restoredCell(record.customerEmail),
    city: restoredCell(record.city),
    address: restoredCell(record.address),
    additionalAddress: restoredCell(record.additionalAddress),
    customerNote: restoredCell(record.customerNote),
    items: parseJson<OrderItemSnapshot[]>(record.itemsJson, []),
    currency: restoredCell(record.currency) || 'MAD',
    subtotal: numberCell(record.subtotal),
    deliveryFee: numberCell(record.deliveryFee),
    total: numberCell(record.total),
    status,
    adminNote: restoredCell(record.adminNote),
    statusHistory: parseJson<OrderStatusHistoryEntry[]>(record.statusHistoryJson, []),
    createdAt: restoredCell(record.createdAt),
    updatedAt: restoredCell(record.updatedAt),
    confirmedAt: restoredCell(record.confirmedAt),
    cancelledAt: restoredCell(record.cancelledAt),
    version: Math.max(1, numberCell(record.version)),
  };
}

export class GoogleSheetsOrderRepository implements OrderRepository {
  private sheets?: sheets_v4.Sheets;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly spreadsheetId = env.googleSheetsSpreadsheetId || '', sheetsClient?: sheets_v4.Sheets) {
    this.sheets = sheetsClient;
  }

  private async client(): Promise<sheets_v4.Sheets> {
    if (this.sheets) return this.sheets;
    if (!this.spreadsheetId || !env.googleServiceAccountJsonBase64) {
      throw new OrderRepositoryError('Stockage des commandes indisponible.', 503);
    }
    const credentials = JSON.parse(Buffer.from(env.googleServiceAccountJsonBase64, 'base64').toString('utf8')) as {
      client_email: string;
      private_key: string;
    };
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
    return this.sheets;
  }

  private async retry<T>(operation: () => Promise<T>): Promise<T> {
    let delay = 200;
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const status = Number((error as { code?: unknown; status?: unknown })?.code
          || (error as { status?: unknown })?.status);
        if (![429, 500, 502, 503, 504].includes(status) || attempt >= 4) {
          throw new OrderRepositoryError('Stockage des commandes momentanément indisponible.', 503);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async initialize(): Promise<void> {
    const sheets = await this.client();
    const spreadsheet = await this.retry(() => sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId }));
    const exists = spreadsheet.data.sheets?.some((sheet) => sheet.properties?.title === 'Orders');
    if (!exists) {
      await this.retry(() => sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: 'Orders' } } }] },
      }));
    }
    await this.retry(() => sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: 'Orders!A1:X1',
      valueInputOption: 'RAW',
      requestBody: { values: [[...ORDER_HEADERS]] },
    }));
  }

  async verifyReadable(): Promise<void> {
    await this.readRows();
  }

  private async readAllRows(): Promise<OrderRow[]> {
    const sheets = await this.client();
    const response = await this.retry(() => sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: 'Orders!A:X',
      valueRenderOption: 'UNFORMATTED_VALUE',
    }));
    const values = response.data.values || [];
    const headers = (values[0] || []).map((value) => String(value));
    const rows: OrderRow[] = [];
    values.slice(1).forEach((row, index) => {
      if (!row.some((cell) => cell !== '')) return;
      const record = Object.fromEntries(headers.map((header, cellIndex) => [header, row[cellIndex] ?? '']));
      const order = fromRecord(record);
      if (!order) return;
      rows.push({ order, rowNumber: index + 2 });
    });
    return rows;
  }

  private async readRows(): Promise<OrderRow[]> {
    const unique = new Map<string, OrderRow>();
    for (const row of await this.readAllRows()) {
      const { order } = row;
      const previous = unique.get(order.id);
      if (!previous || previous.order.version <= order.version) unique.set(order.id, row);
    }
    return [...unique.values()];
  }

  private async updateRow(rowNumber: number, order: Order): Promise<void> {
    const sheets = await this.client();
    await this.retry(() => sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Orders!A${rowNumber}:X${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: { values: [toRow(order)] },
    }));
  }

  async createIfAbsent(order: Order): Promise<{ order: Order; created: boolean }> {
    return this.exclusive(async () => {
      const existing = (await this.readAllRows()).find((row) => row.order.clientRequestId === order.clientRequestId);
      if (existing) return { order: existing.order, created: false };
      const sheets = await this.client();
      const response = await this.retry(() => sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Orders!A:X',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [toRow(order)] },
      }));
      const appendedRange = response.data.updates?.updatedRange || '';
      const appendedRowNumber = Number(appendedRange.match(/![A-Z]+(\d+):/)?.[1] || 0);
      const duplicates = (await this.readAllRows())
        .filter((row) => row.order.clientRequestId === order.clientRequestId)
        .sort((a, b) => a.rowNumber - b.rowNumber);
      const canonical = duplicates[0];
      if (!canonical) throw new OrderRepositoryError('La commande n’a pas pu être relue après son enregistrement.', 503);
      if (appendedRowNumber && canonical.rowNumber !== appendedRowNumber) {
        await this.retry(() => sheets.spreadsheets.values.clear({
          spreadsheetId: this.spreadsheetId,
          range: `Orders!A${appendedRowNumber}:X${appendedRowNumber}`,
        }));
      }
      return {
        order: canonical.order,
        created: !appendedRowNumber || canonical.rowNumber === appendedRowNumber,
      };
    });
  }

  async list(filters: OrderFilters = {}): Promise<PaginatedOrders> {
    return paginateOrders((await this.readRows()).map((row) => row.order), filters);
  }

  async getById(id: string): Promise<Order | undefined> {
    return (await this.readRows()).find((row) => row.order.id === id)?.order;
  }

  async findByClientRequestId(clientRequestId: string): Promise<Order | undefined> {
    return (await this.readRows()).find((row) => row.order.clientRequestId === clientRequestId)?.order;
  }

  async updateStatus(id: string, status: OrderStatus, options: OrderMutationOptions): Promise<Order> {
    return this.exclusive(async () => {
      const row = (await this.readRows()).find((item) => item.order.id === id);
      if (!row) throw new OrderRepositoryError('Commande introuvable.', 404);
      const previous = row.order;
      if (options.expectedVersion && options.expectedVersion !== previous.version) {
        throw new OrderRepositoryError('La commande a été modifiée ailleurs. Actualisez puis réessayez.', 409);
      }
      if (previous.status === status) return previous;
      const now = new Date().toISOString();
      const updated: Order = {
        ...previous,
        status,
        updatedAt: now,
        version: previous.version + 1,
        confirmedAt: status === 'confirmed' && !previous.confirmedAt ? now : previous.confirmedAt,
        cancelledAt: status === 'cancelled' && !previous.cancelledAt ? now : previous.cancelledAt,
        statusHistory: [...previous.statusHistory, {
          previousStatus: previous.status,
          newStatus: status,
          changedAt: now,
          changedBy: options.changedBy,
        }],
      };
      await this.updateRow(row.rowNumber, updated);
      return updated;
    });
  }

  async updateNote(id: string, note: string, options: OrderMutationOptions): Promise<Order> {
    return this.exclusive(async () => {
      const row = (await this.readRows()).find((item) => item.order.id === id);
      if (!row) throw new OrderRepositoryError('Commande introuvable.', 404);
      if (options.expectedVersion && options.expectedVersion !== row.order.version) {
        throw new OrderRepositoryError('La commande a été modifiée ailleurs. Actualisez puis réessayez.', 409);
      }
      const updated = {
        ...row.order,
        adminNote: note,
        updatedAt: new Date().toISOString(),
        version: row.order.version + 1,
      };
      await this.updateRow(row.rowNumber, updated);
      return updated;
    });
  }
}
