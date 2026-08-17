import type { CatalogueRepository } from './CatalogueRepository.js';
import { UnconfiguredCatalogueRepository } from './UnconfiguredCatalogueRepository.js';

export function createCatalogueRepository(): CatalogueRepository {
  return new UnconfiguredCatalogueRepository();
}
