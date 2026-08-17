import path from 'node:path';
import { ExcelCatalogueRepository } from '../server/dist/repositories/ExcelCatalogueRepository.js';
import { createApp } from '../server/dist/app.js';

const root = path.resolve(import.meta.dirname, '..');
const slugs = [
  'canape-angle-jade',
  'canape-angle-zohra',
  'salon-modulaire-naima',
  'salon-panoramique-malika',
  'canape-angle-layla',
  'canape-angle-soraya',
];

const repository = new ExcelCatalogueRepository(
  path.join(root, 'server/storage/jad-home-catalogue.xlsx'),
  path.join(root, 'server/storage/backups'),
);
await repository.initialize();

const app = createApp(repository, {
  uploadRoot: path.join(root, 'server/storage/uploads'),
  sessionDirectory: path.join(root, 'server/storage/sessions'),
  backupDirectory: path.join(root, 'server/storage/backups'),
});
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const { port } = server.address();
let valid = true;

try {
  const catalogue = await fetch(`http://127.0.0.1:${port}/api/products?limit=100`).then((response) => response.json());
  const categoryCounts = catalogue.data.items.reduce((counts, product) => {
    counts[product.category_id] = (counts[product.category_id] || 0) + 1;
    return counts;
  }, {});
  console.log(`public_total=${catalogue.data.total}`);
  console.log(`active_categories=${JSON.stringify(categoryCounts)}`);

  for (const slug of slugs) {
    const response = await fetch(`http://127.0.0.1:${port}/api/products/${slug}`);
    const body = await response.json();
    const imagePath = body.data?.images?.[0];
    const imageResponse = imagePath
      ? await fetch(`http://127.0.0.1:${port}${imagePath}`)
      : { status: 0 };
    console.log(`${slug}: product=${response.status}, image=${imageResponse.status}, images=${body.data?.images?.length || 0}`);
    if (response.status !== 200 || imageResponse.status !== 200) valid = false;
  }
} finally {
  server.close();
}

if (!valid) process.exit(1);
