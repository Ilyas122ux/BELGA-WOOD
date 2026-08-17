import { MemoryOrderRepository } from './MemoryOrderRepository.js';
import type { OrderRepository } from './OrderRepository.js';

export function createOrderRepository(): OrderRepository {
  return new MemoryOrderRepository();
}
