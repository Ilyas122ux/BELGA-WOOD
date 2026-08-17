import type { Category, PaginatedProducts, Product, Settings } from '@jad-home/shared';
import type { CatalogueRepository, ProductFilters } from './CatalogueRepository.js';

const message = 'La nouvelle source de données BELGA WOOD n’est pas encore configurée.';

export class UnconfiguredCatalogueRepository implements CatalogueRepository {
  async initialize(): Promise<void> {}
  async verifyReadable(): Promise<void> { throw new Error(message); }
  async listProducts(filters: ProductFilters = {}): Promise<PaginatedProducts> {
    return { items: [], total: 0, page: filters.page || 1, limit: filters.limit || 12, pages: 1 };
  }
  async getProduct(): Promise<Product | undefined> { return undefined; }
  async listCategories(): Promise<Category[]> { return []; }
  async getSettings(): Promise<Settings> { return {}; }
  async createProduct(): Promise<Product> { throw new Error(message); }
  async updateProduct(): Promise<Product> { throw new Error(message); }
  async patchProduct(): Promise<Product> { throw new Error(message); }
  async deactivateProduct(): Promise<Product> { throw new Error(message); }
  async createCategory(): Promise<Category> { throw new Error(message); }
  async updateCategory(): Promise<Category> { throw new Error(message); }
  async deactivateCategory(): Promise<Category> { throw new Error(message); }
  async updateSettings(): Promise<Settings> { throw new Error(message); }
  async exportCatalogue(): Promise<unknown> { return { products: [], categories: [], settings: {}, configured: false }; }
}
