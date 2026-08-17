import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ExcelCatalogueRepository } from '../server/dist/repositories/ExcelCatalogueRepository.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userRoot = path.resolve(projectRoot, '..', '..');
const generatedDirectory = path.join(
  userRoot,
  '.codex',
  'generated_images',
  '019f81f3-8e7a-7480-912d-7c854a6c6c45',
);
const uploadDirectory = path.join(projectRoot, 'server', 'storage', 'uploads', 'products');
const cataloguePath = path.join(projectRoot, 'server', 'storage', 'jad-home-catalogue.xlsx');

const imageSources = {
  zohra: 'exec-0131f5ba-be5d-4b69-8bfe-85f83d3f8517.png',
  naima: 'exec-507cbab8-bd49-42ae-b5df-9869e1b16030.png',
  malika: 'exec-fe538a73-16c3-422f-9ed7-a5b55dbd08ca.png',
  layla: 'exec-a0fb3f79-fb1e-4530-8a52-886c1e1679c9.png',
  soraya: 'exec-d4f9ddd1-b5c7-40e7-9e64-1889a8b80deb.png',
  jade: 'exec-4e49b520-76b1-4afe-a5c4-f972ef1d6148.png',
};

const imageUrl = (key) => `/uploads/products/jad-collection-${key}.webp`;

const products = [
  {
    key: 'jade',
    slug: 'canape-angle-jade',
    name_fr: 'Canapé d’angle Jade',
    name_ar: 'كنبة الزاوية جاد',
    short_description_fr: 'Un angle vert émeraude aux lignes rétro chic, prolongé par une méridienne généreuse.',
    short_description_ar: 'كنبة زاوية خضراء زمردية بخطوط أنيقة مستوحاة من الطابع الريترو وشيزلونغ واسع.',
    description_fr: 'Jade associe un velours chenillé vert profond, des assises structurées et de fins pieds en noyer. Sa méridienne droite et ses coussins rayés apportent une présence élégante sans alourdir la pièce. Dimensions indicatives, orientation, tissu et couleur personnalisables sur commande.',
    description_ar: 'تجمع جاد بين قماش أخضر عميق ومقاعد منظمة وأرجل رفيعة من خشب الجوز. يضيف الشيزلونغ الأيمن والوسائد المخططة حضوراً أنيقاً دون إثقال المساحة. القياسات والاتجاه والقماش واللون قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-canapes',
    price: 10900,
    old_price: 11900,
    stock_quantity: 3,
    featured: true,
    new_arrival: true,
    promotion: true,
    colors: ['Vert émeraude', 'Violet'],
    dimensions: '285 × 180 × 84 cm',
    materials: ['Velours chenillé', 'Bois massif', 'Noyer', 'Mousse haute résilience'],
  },
  {
    key: 'zohra',
    slug: 'canape-angle-zohra',
    name_fr: 'Canapé d’angle Zohra',
    name_ar: 'كنبة الزاوية زهرة',
    short_description_fr: 'Une composition terracotta chaleureuse, avec dossiers hauts et pieds noirs fuselés.',
    short_description_ar: 'كنبة زاوية بلون التيراكوتا الدافئ بظهور مرتفعة وأرجل سوداء رفيعة.',
    description_fr: 'Zohra revisite le canapé d’angle familial avec un tissu terracotta lumineux, des dossiers bien dessinés et une assise accueillante. Ses pieds noirs dégagent visuellement la silhouette. Dimensions indicatives, sens de l’angle, tissu et couleur personnalisables sur commande.',
    description_ar: 'تعيد زهرة تقديم كنبة الزاوية العائلية بقماش تيراكوتا مشرق وظهور واضحة ومقاعد مريحة. تمنح الأرجل السوداء التصميم خفة بصرية. القياسات واتجاه الزاوية والقماش واللون قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-canapes',
    price: 9990,
    old_price: 10900,
    stock_quantity: 3,
    featured: false,
    new_arrival: true,
    promotion: true,
    colors: ['Terracotta', 'Rouille'],
    dimensions: '290 × 200 × 86 cm',
    materials: ['Tissu tissé', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'naima',
    slug: 'salon-modulaire-naima',
    name_fr: 'Salon modulaire Naïma',
    name_ar: 'صالون مودولار نعيمة',
    short_description_fr: 'Un grand salon ivoire aux assises côtelées, profondes et enveloppantes.',
    short_description_ar: 'صالون عاجي كبير بمقاعد عميقة ومخططة تمنح إحساساً محيطاً ومريحاً.',
    description_fr: 'Naïma se distingue par sa base côtelée, sa large méridienne et ses volumes très moelleux. Le bouclé ivoire accentue son caractère lumineux et contemporain. Dimensions indicatives, nombre de modules, orientation et coloris personnalisables sur commande.',
    description_ar: 'تتميز نعيمة بقاعدتها المخططة وشيزلونغها الواسع وأحجامها شديدة النعومة. يعزز البوكليه العاجي طابعها المضيء والعصري. القياسات وعدد الوحدات والاتجاه والألوان قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-salons',
    price: 16900,
    old_price: null,
    stock_quantity: 2,
    featured: true,
    new_arrival: true,
    promotion: false,
    colors: ['Ivoire', 'Crème'],
    dimensions: '360 × 250 × 72 cm',
    materials: ['Bouclé côtelé', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'malika',
    slug: 'salon-panoramique-malika',
    name_fr: 'Salon panoramique Malika',
    name_ar: 'صالون بانورامي مليكة',
    short_description_fr: 'Un salon en U minimaliste, équilibré par deux méridiennes et des touches bordeaux.',
    short_description_ar: 'صالون بسيط على شكل U متوازن بشيزلونغين ولمسات باللون العنابي.',
    description_fr: 'Malika forme une composition symétrique avec deux longues méridiennes, trois modules centraux et des accoudoirs cylindriques. Les coussins bordeaux signent son élégance graphique. Dimensions indicatives, tissu, modules et coloris personnalisables sur commande.',
    description_ar: 'تشكل مليكة جلسة متوازنة بشيزلونغين طويلين وثلاث وحدات مركزية ومساند أسطوانية. تضيف الوسائد العنابية لمسة رسومية أنيقة. القياسات والقماش والوحدات والألوان قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-salons',
    price: 18900,
    old_price: 19900,
    stock_quantity: 1,
    featured: true,
    new_arrival: true,
    promotion: true,
    colors: ['Blanc cassé', 'Bordeaux'],
    dimensions: '390 × 250 × 70 cm',
    materials: ['Tissu bouclé', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'layla',
    slug: 'canape-angle-layla',
    name_fr: 'Canapé d’angle Layla',
    name_ar: 'كنبة الزاوية ليلى',
    short_description_fr: 'Une grande méridienne greige accompagnée d’une généreuse collection de coussins.',
    short_description_ar: 'كنبة بلون غريج مع شيزلونغ كبير ومجموعة غنية من الوسائد المريحة.',
    description_fr: 'Layla privilégie le confort décontracté avec une méridienne extra-large, une assise continue et de nombreux coussins souples. Son tissu greige s’intègre facilement aux palettes naturelles. Dimensions indicatives, orientation, tissu et finition personnalisables sur commande.',
    description_ar: 'تعتمد ليلى الراحة الهادئة مع شيزلونغ عريض ومقعد متصل ووسائد ناعمة كثيرة. ينسجم قماش الغريج بسهولة مع الألوان الطبيعية. القياسات والاتجاه والقماش والتشطيب قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-canapes',
    price: 12900,
    old_price: null,
    stock_quantity: 2,
    featured: true,
    new_arrival: true,
    promotion: false,
    colors: ['Greige', 'Taupe clair'],
    dimensions: '315 × 205 × 76 cm',
    materials: ['Tissu effet lin', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'soraya',
    slug: 'canape-angle-soraya',
    name_fr: 'Canapé d’angle Soraya',
    name_ar: 'كنبة الزاوية ثريا',
    short_description_fr: 'Un angle beige aérien sur piètement noir, rehaussé de coussins rouille.',
    short_description_ar: 'كنبة زاوية بيج خفيفة على قاعدة سوداء مع وسائد بلون الصدأ.',
    description_fr: 'Soraya combine des lignes droites, un piètement métallique fin et une méridienne droite confortable. Les coussins rouille contrastent avec le tissu beige pour un résultat sobre et chaleureux. Dimensions indicatives, orientation et finitions personnalisables sur commande.',
    description_ar: 'تجمع ثريا بين الخطوط المستقيمة والقاعدة المعدنية الرفيعة والشيزلونغ الأيمن المريح. تتباين الوسائد بلون الصدأ مع القماش البيج لتمنح مظهراً هادئاً ودافئاً. القياسات والاتجاه والتشطيبات قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-canapes',
    price: 11900,
    old_price: 12900,
    stock_quantity: 3,
    featured: false,
    new_arrival: true,
    promotion: true,
    colors: ['Beige', 'Rouille'],
    dimensions: '305 × 190 × 78 cm',
    materials: ['Tissu tissé', 'Bois massif', 'Métal noir', 'Mousse haute résilience'],
  },
].map((product) => ({
  ...product,
  currency: 'MAD',
  active: true,
}));

await fs.mkdir(uploadDirectory, { recursive: true });

for (const [key, sourceName] of Object.entries(imageSources)) {
  const sourcePath = path.join(generatedDirectory, sourceName);
  const outputPath = path.join(uploadDirectory, `jad-collection-${key}.webp`);
  try {
    await fs.access(outputPath);
  } catch {
    await sharp(sourcePath)
      .rotate()
      .webp({ quality: 86, effort: 5, smartSubsample: true })
      .toFile(outputPath);
  }
}

const repository = new ExcelCatalogueRepository(cataloguePath);
await repository.initialize();
const current = await repository.listProducts({ admin: true, limit: 100 });
const existingBySlug = new Map(current.items.map((product) => [product.slug, product]));
const results = [];

for (const product of products) {
  const existing = existingBySlug.get(product.slug);
  const input = { ...product, existing_images: existing ? [imageUrl(product.key)] : [] };
  const saved = existing
    ? await repository.updateProduct(existing.id, input)
    : await repository.createProduct(input, [imageUrl(product.key)]);
  results.push(`${existing ? 'updated' : 'created'}: ${saved.slug}`);
}

const finalProducts = await repository.listProducts({ admin: true, limit: 100 });
console.log(results.join('\n'));
console.log(`catalogue products: ${finalProducts.total}`);
