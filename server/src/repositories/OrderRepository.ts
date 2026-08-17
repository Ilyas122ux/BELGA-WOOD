import type { Order, OrderStatus, PaginatedOrders } from '@jad-home/shared';

export type OrderFilters = {
  page?: number;
  limit?: number;
  search?: string;
  status?: OrderStatus;
  dateFrom?: string;
  dateTo?: string;
  sort?: 'newest' | 'oldest';
};

export type OrderMutationOptions = {
  expectedVersion?: number;
  changedBy: string;
};

export interface OrderRepository {
  initialize(): Promise<void>;
  verifyReadable(): Promise<void>;
  createIfAbsent(order: Order): Promise<{ order: Order; created: boolean }>;
  list(filters?: OrderFilters): Promise<PaginatedOrders>;
  getById(id: string): Promise<Order | undefined>;
  findByClientRequestId(clientRequestId: string): Promise<Order | undefined>;
  updateStatus(id: string, status: OrderStatus, options: OrderMutationOptions): Promise<Order>;
  updateNote(id: string, note: string, options: OrderMutationOptions): Promise<Order>;
}

export class OrderRepositoryError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = 'OrderRepositoryError';
  }
}
