import type { CatalogueRepository } from '../repositories/CatalogueRepository.js';
import { env } from '../config/env.js';

export type ReadinessResult = { ready: boolean; catalogueBackend: string; checks: Record<string, string> };

export async function checkReadiness(
  repository: CatalogueRepository,
  _directories: { uploads: string; backups: string },
): Promise<ReadinessResult> {
  const checks: Record<string, string> = {};
  let ready = true;

  try {
    await repository.verifyReadable();
    checks.catalogue = env.catalogueBackend;
  } catch (error) {
    ready = false;
    checks.catalogue = error instanceof Error ? error.message : 'unreadable';
  }

  return { ready, catalogueBackend: env.catalogueBackend, checks };
}
