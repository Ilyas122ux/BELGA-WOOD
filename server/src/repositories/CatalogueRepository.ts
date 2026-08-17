import type { Category, PaginatedProducts, Product, Settings } from '@jad-home/shared';

export type ProductFilters = {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
  promotion?: boolean;
  newArrival?: boolean;
  active?: boolean;
  sort?: string;
  admin?: boolean;
};

export interface CatalogueRepository {
  initialize(): Promise<void>;
  verifyReadable(): Promise<void>;
  listProducts(filters?: ProductFilters): Promise<PaginatedProducts>;
  getProduct(identifier: string, includeInactive?: boolean): Promise<Product | undefined>;
  createProduct(input: unknown, images?: Product['images']): Promise<Product>;
  updateProduct(id: string, input: unknown, images?: Product['images']): Promise<Product>;
  patchProduct(id: string, patch: Partial<Pick<Product, 'active' | 'featured' | 'new_arrival' | 'promotion'>>): Promise<Product>;
  deactivateProduct(id: string): Promise<Product>;
  listCategories(includeInactive?: boolean): Promise<Category[]>;
  createCategory(input: unknown): Promise<Category>;
  updateCategory(id: string, input: unknown): Promise<Category>;
  deactivateCategory(id: string): Promise<Category>;
  getSettings(): Promise<Settings>;
  updateSettings(input: Record<string, unknown>): Promise<Settings>;
  exportCatalogue?(): Promise<unknown>;
  listBackups?(): Promise<{ name: string; size: number; date: string }[]>;
  createBackup?(): Promise<string>;
  restoreBackup?(name: string): Promise<void>;
  getBackupPath?(name: string): string;
}
