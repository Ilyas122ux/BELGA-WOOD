import type { Order, OrderStatus, PaginatedOrders } from '@jad-home/shared';
import type { OrderFilters, OrderMutationOptions, OrderRepository } from './OrderRepository.js';
import { OrderRepositoryError } from './OrderRepository.js';

function cloneOrder(order: Order): Order {
  return structuredClone(order);
}

function filteredOrders(source: Order[], filters: OrderFilters): Order[] {
  let orders = [...source];
  const search = filters.search?.trim().toLocaleLowerCase();
  if (search) {
    orders = orders.filter((order) => [
      order.orderNumber,
      order.customerName,
      order.customerPhone,
      order.city,
    ].some((value) => value.toLocaleLowerCase().includes(search)));
  }
  if (filters.status) orders = orders.filter((order) => order.status === filters.status);
  if (filters.dateFrom) orders = orders.filter((order) => order.createdAt.slice(0, 10) >= filters.dateFrom!);
  if (filters.dateTo) orders = orders.filter((order) => order.createdAt.slice(0, 10) <= filters.dateTo!);
  orders.sort((a, b) => filters.sort === 'oldest'
    ? a.createdAt.localeCompare(b.createdAt)
    : b.createdAt.localeCompare(a.createdAt));
  return orders;
}

function paginated(source: Order[], filters: OrderFilters = {}): PaginatedOrders {
  const all = [...source];
  const orders = filteredOrders(all, filters);
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20));
  const total = orders.length;
  return {
    items: orders.slice((page - 1) * limit, page * limit).map(cloneOrder),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    summary: {
      new: all.filter((order) => order.status === 'new').length,
      awaitingConfirmation: all.filter((order) => order.status === 'awaiting_confirmation').length,
      confirmed: all.filter((order) => order.status === 'confirmed').length,
      total: all.length,
    },
  };
}

export class MemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();
  private queue: Promise<void> = Promise.resolve();

  async initialize(): Promise<void> {}

  async verifyReadable(): Promise<void> {}

  private async exclusive<T>(operation: () => T | Promise<T>): Promise<T> {
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

  async createIfAbsent(order: Order): Promise<{ order: Order; created: boolean }> {
    return this.exclusive(() => {
      const existing = [...this.orders.values()].find((item) => item.clientRequestId === order.clientRequestId);
      if (existing) return { order: cloneOrder(existing), created: false };
      this.orders.set(order.id, cloneOrder(order));
      return { order: cloneOrder(order), created: true };
    });
  }

  async list(filters: OrderFilters = {}): Promise<PaginatedOrders> {
    return paginated([...this.orders.values()], filters);
  }

  async getById(id: string): Promise<Order | undefined> {
    const order = this.orders.get(id);
    return order ? cloneOrder(order) : undefined;
  }

  async findByClientRequestId(clientRequestId: string): Promise<Order | undefined> {
    const order = [...this.orders.values()].find((item) => item.clientRequestId === clientRequestId);
    return order ? cloneOrder(order) : undefined;
  }

  async updateStatus(id: string, status: OrderStatus, options: OrderMutationOptions): Promise<Order> {
    return this.exclusive(() => {
      const previous = this.orders.get(id);
      if (!previous) throw new OrderRepositoryError('Commande introuvable.', 404);
      if (options.expectedVersion && options.expectedVersion !== previous.version) {
        throw new OrderRepositoryError('La commande a été modifiée ailleurs. Actualisez puis réessayez.', 409);
      }
      if (previous.status === status) return cloneOrder(previous);
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
      this.orders.set(id, updated);
      return cloneOrder(updated);
    });
  }

  async updateNote(id: string, note: string, options: OrderMutationOptions): Promise<Order> {
    return this.exclusive(() => {
      const previous = this.orders.get(id);
      if (!previous) throw new OrderRepositoryError('Commande introuvable.', 404);
      if (options.expectedVersion && options.expectedVersion !== previous.version) {
        throw new OrderRepositoryError('La commande a été modifiée ailleurs. Actualisez puis réessayez.', 409);
      }
      const updated = {
        ...previous,
        adminNote: note,
        updatedAt: new Date().toISOString(),
        version: previous.version + 1,
      };
      this.orders.set(id, updated);
      return cloneOrder(updated);
    });
  }
}

export { paginated as paginateOrders };
