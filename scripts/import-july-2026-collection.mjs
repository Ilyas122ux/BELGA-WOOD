import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ExcelCatalogueRepository } from '../server/dist/repositories/ExcelCatalogueRepository.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reviewDirectory = path.join(projectRoot, '.tmp', 'product-review');
const uploadDirectory = path.join(projectRoot, 'server', 'storage', 'uploads', 'products');
const cataloguePath = path.join(projectRoot, 'server', 'storage', 'jad-home-catalogue.xlsx');

const imageSources = {
  nuage: 'exec-e74027a7-7b31-4917-af95-e63fa586ca35.png',
  amani: 'exec-6787db3f-1209-42be-9ecc-a96c8c38f4c7.png',
  sirocco: 'exec-a88a470a-9e38-4b8c-ad1c-966fd2abd0f5.png',
  selma: 'exec-619c14c8-9b7b-4a81-9a89-9c9d7584ad08.png',
  riad: 'exec-e86d0030-5abb-4ecc-8ce4-7612a2145430.png',
  alba: 'exec-1b45147f-61c4-4f53-88dd-34085ff07b6e.png',
  moka: 'exec-0a3fa354-9968-48c0-be4e-9040c3221497.png',
  dalia: 'exec-9b0c1f2c-4750-417b-a1e2-c600e0185582.png',
  lina: 'exec-10fc2157-5deb-4381-b049-797eabc3679e.png',
  nour: 'exec-ecb77dd9-7f82-4bfb-9598-e296d58afa41.png',
  yasmin: 'exec-b31c9b5d-8d3b-420e-bb19-fc4211bba4ec.png',
  sahara: 'exec-7f7e206d-6119-42aa-97c7-ea131947394b.png',
  atlas: 'exec-949059de-9fa3-4a63-9d8d-8794632df765.png',
  zen: 'exec-cea5a171-f9b7-4367-9105-79978e7cccd6.png',
  kasbah: 'exec-e4a5185a-a5fe-4e85-a58a-dff86f1084eb.png',
};

const imageUrl = (key) => `/uploads/products/jad-collection-${key}.webp`;

const products = [
  {
    key: 'alba', slug: 'canape-angle-alba', name_fr: 'Canapé d’angle Alba', name_ar: 'كنبة الزاوية ألبا',
    short_description_fr: 'Un grand canapé d’angle ivoire, profond et lumineux, pensé pour les moments en famille.',
    short_description_ar: 'كنبة زاوية كبيرة بلون عاجي، عميقة ومضيئة ومثالية للجلسات العائلية.',
    description_fr: 'Alba associe des assises généreuses, des dossiers souples et une ligne contemporaine facile à intégrer. Sa structure en bois massif, sa mousse haute résilience et son tissu texturé offrent un confort durable. Dimensions indicatives, tissu, couleur et orientation personnalisables sur commande.',
    description_ar: 'تجمع ألبا بين المقاعد الواسعة والظهور المريحة والتصميم العصري. هيكلها من الخشب الصلب وحشوتها عالية الكثافة وقماشها المنسوج تمنح راحة تدوم. القياسات واللون والقماش واتجاه الزاوية قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-canapes', price: 12900, old_price: 13900, stock_quantity: 2, featured: true, new_arrival: true, promotion: true,
    colors: ['Ivoire', 'Beige'], dimensions: '300 × 220 × 78 cm', materials: ['Tissu texturé', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'moka', slug: 'canape-modulaire-moka', name_fr: 'Canapé modulaire Moka', name_ar: 'كنبة مودولار موكا',
    short_description_fr: 'Une assise lounge caramel aux volumes généreux et au toucher chenille chaleureux.',
    short_description_ar: 'كنبة لاونج بلون الكراميل، بحجم مريح وملمس شنيل دافئ.',
    description_fr: 'Moka se distingue par ses modules profonds, ses accoudoirs arrondis et son revêtement chenille caramel. Les coussins graphiques soulignent son caractère chaleureux. Dimensions indicatives, composition, tissu et couleur personnalisables sur commande.',
    description_ar: 'تتميز موكا بوحداتها العميقة ومساندها الدائرية وقماش الشنيل بلون الكراميل. الوسائد المخططة تضيف لمسة دافئة. القياسات والتشكيلة والقماش واللون قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-canapes', price: 11900, old_price: 12900, stock_quantity: 2, featured: true, new_arrival: true, promotion: true,
    colors: ['Caramel', 'Brun'], dimensions: '330 × 105 × 72 cm', materials: ['Chenille texturée', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'dalia', slug: 'salon-panoramique-dalia', name_fr: 'Salon panoramique Dalia', name_ar: 'صالون بانورامي داليا',
    short_description_fr: 'Une composition panoramique ivoire conçue pour les grands espaces et les familles nombreuses.',
    short_description_ar: 'تشكيلة بانورامية عاجية مصممة للمساحات الكبيرة والعائلات.',
    description_fr: 'Dalia offre une composition familiale très généreuse avec de longues assises, des retours d’angle et une méridienne arrondie indépendante. Son tissu clair et sa base discrète allègent visuellement l’ensemble. Dimensions indicatives et configuration personnalisable sur commande.',
    description_ar: 'يقدم داليا جلسة عائلية واسعة بمقاعد طويلة وزوايا مريحة وشيزلونغ دائري مستقل. القماش الفاتح والقاعدة الهادئة يمنحان التشكيلة خفة وأناقة. القياسات والتوزيع قابلان للتخصيص حسب الطلب.',
    category_id: 'cat-salons', price: 18900, old_price: null, stock_quantity: 1, featured: true, new_arrival: true, promotion: false,
    colors: ['Ivoire', 'Écru'], dimensions: '430 × 300 × 80 cm', materials: ['Tissu bouclé', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'nuage', slug: 'salon-panoramique-nuage', name_fr: 'Salon panoramique Nuage', name_ar: 'صالون بانورامي سحاب',
    short_description_fr: 'Des modules arrondis et enveloppants pour une composition panoramique au confort nuageux.',
    short_description_ar: 'وحدات دائرية ومريحة لتشكيلة بانورامية بنعومة السحاب.',
    description_fr: 'Nuage enveloppe l’espace avec ses modules bas, ses courbes douces et ses assises profondes. La finition bouclée ivoire renforce son aspect sculptural et apaisant. Dimensions indicatives, nombre de modules et coloris personnalisables sur commande.',
    description_ar: 'يملأ سحاب المكان بوحداته المنخفضة ومنحنياته الناعمة ومقاعده العميقة. قماش البوكليه العاجي يعزز طابعه النحتي والهادئ. القياسات وعدد الوحدات والألوان قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-salons', price: 16900, old_price: 17900, stock_quantity: 2, featured: true, new_arrival: true, promotion: true,
    colors: ['Ivoire', 'Crème'], dimensions: '360 × 250 × 74 cm', materials: ['Bouclé premium', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'amani', slug: 'canape-courbe-amani', name_fr: 'Canapé courbe Amani', name_ar: 'كنبة أماني المنحنية',
    short_description_fr: 'Une silhouette courbe, basse et sculpturale pour un salon minimaliste et élégant.',
    short_description_ar: 'تصميم منحني ومنخفض بنَفَس نحتي لصالون أنيق وبسيط.',
    description_fr: 'Amani déroule une ligne continue aux accoudoirs arrondis et aux assises profondes. Son dessin fluide convient aux intérieurs contemporains tout en conservant un excellent maintien. Dimensions indicatives, tissu et coloris personnalisables sur commande.',
    description_ar: 'تتميز أماني بخط متواصل ومساند دائرية ومقاعد عميقة. تصميمها الانسيابي يناسب الديكور العصري مع دعم مريح. القياسات والقماش والألوان قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-canapes', price: 10900, old_price: null, stock_quantity: 3, featured: false, new_arrival: true, promotion: false,
    colors: ['Ivoire', 'Blanc cassé'], dimensions: '285 × 105 × 70 cm', materials: ['Bouclé doux', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'sirocco', slug: 'canape-angle-sirocco', name_fr: 'Canapé d’angle Sirocco', name_ar: 'كنبة الزاوية سيروكو',
    short_description_fr: 'Un angle gris anthracite aux lignes nettes, avec méridienne longue et modules pratiques.',
    short_description_ar: 'كنبة زاوية رمادية فحمية بخطوط واضحة وشيزلونغ طويل ووحدات عملية.',
    description_fr: 'Sirocco privilégie une silhouette structurée, un tissu chiné résistant et une méridienne généreuse. Ses modules droits facilitent l’aménagement d’un espace contemporain. Dimensions indicatives et orientation de l’angle personnalisable sur commande.',
    description_ar: 'تجمع سيروكو بين التصميم المنظم والقماش المتين والشيزلونغ الواسع. وحداتها المستقيمة تسهّل تنسيق المساحات العصرية. القياسات واتجاه الزاوية قابلان للتخصيص حسب الطلب.',
    category_id: 'cat-canapes', price: 8990, old_price: 9990, stock_quantity: 3, featured: false, new_arrival: true, promotion: true,
    colors: ['Anthracite', 'Gris'], dimensions: '285 × 210 × 76 cm', materials: ['Tissu chiné', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'selma', slug: 'canape-modulaire-selma', name_fr: 'Canapé modulaire Selma', name_ar: 'كنبة مودولار سلمى',
    short_description_fr: 'Une méridienne généreuse, des courbes douces et une pluie de coussins écrus.',
    short_description_ar: 'شيزلونغ واسع ومنحنيات ناعمة ومجموعة وسائد بلون كريمي.',
    description_fr: 'Selma combine une grande méridienne, des assises continues et un dossier bas souligné par des coussins souples. Sa forme arrondie apporte une présence douce et contemporaine. Dimensions indicatives, tissu, couleur et configuration personnalisables sur commande.',
    description_ar: 'تجمع سلمى بين شيزلونغ كبير ومقاعد متصلة وظهر منخفض مع وسائد ناعمة. شكلها الدائري يضيف حضوراً عصرياً وهادئاً. القياسات والقماش واللون والتوزيع قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-canapes', price: 13900, old_price: null, stock_quantity: 2, featured: true, new_arrival: true, promotion: false,
    colors: ['Écru', 'Crème'], dimensions: '315 × 190 × 72 cm', materials: ['Bouclé texturé', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'riad', slug: 'salon-panoramique-riad', name_fr: 'Salon panoramique Riad', name_ar: 'صالون بانورامي رياض',
    short_description_fr: 'Une composition majestueuse en trois îlots, rehaussée de détails camel et d’un esprit riad.',
    short_description_ar: 'تشكيلة فخمة من ثلاث وحدات بلمسات جلدية بلون الجملي وروح الرياض المغربي.',
    description_fr: 'Riad est une composition très grand format articulée autour de trois îlots généreux. Les liaisons et le socle camel contrastent avec le bouclé ivoire pour un résultat haut de gamme. Dimensions indicatives et composition entièrement personnalisable sur commande.',
    description_ar: 'رياض تشكيلة كبيرة جداً مكوّنة من ثلاث وحدات واسعة. التفاصيل والقاعدة بلون الجملي تتباين مع البوكليه العاجي لتمنحها مظهراً راقياً. القياسات والتوزيع قابلان للتخصيص الكامل حسب الطلب.',
    category_id: 'cat-salons', price: 21900, old_price: 23900, stock_quantity: 1, featured: true, new_arrival: true, promotion: true,
    colors: ['Ivoire', 'Camel'], dimensions: '480 × 270 × 72 cm', materials: ['Bouclé premium', 'Similicuir camel', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'lina', slug: 'canape-courbe-lina', name_fr: 'Canapé courbe Lina', name_ar: 'كنبة لينا المنحنية',
    short_description_fr: 'Un quatre-places ivoire aux lignes fines et à la courbe subtilement asymétrique.',
    short_description_ar: 'كنبة عاجية لأربعة أشخاص بخطوط ناعمة وانحناء غير متماثل بلمسة أنيقة.',
    description_fr: 'Lina revisite le canapé quatre-places avec un dossier rythmé, une façade continue et un accoudoir terminal arrondi. Sa profondeur maîtrisée convient aussi aux espaces plus sobres. Dimensions indicatives, tissu et couleur personnalisables sur commande.',
    description_ar: 'تعيد لينا تقديم كنبة الأربعة مقاعد بظهر منظم وواجهة متصلة ومسند طرفي دائري. عمقها المتوازن يناسب أيضاً المساحات الهادئة. القياسات والقماش واللون قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-canapes', price: 9490, old_price: null, stock_quantity: 4, featured: false, new_arrival: true, promotion: false,
    colors: ['Ivoire', 'Blanc cassé'], dimensions: '290 × 96 × 74 cm', materials: ['Tissu bouclé', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'nour', slug: 'canape-modulaire-nour', name_fr: 'Canapé modulaire Nour', name_ar: 'كنبة مودولار نور',
    short_description_fr: 'Une assise extra-profonde taupe, reconnaissable à sa base côtelée et ses volumes doux.',
    short_description_ar: 'كنبة تاوب عميقة تتميز بقاعدتها المخططة وأحجامها الناعمة.',
    description_fr: 'Nour marie une assise lounge extra-profonde à une base composée de volumes côtelés. Les coussins écrus, terracotta et moutarde réchauffent sa teinte taupe. Dimensions indicatives, longueur, tissu et couleur personnalisables sur commande.',
    description_ar: 'تجمع نور بين مقعد لاونج عميق وقاعدة مكوّنة من وحدات مخططة. الوسائد الكريمية والتيراكوتا والخردلية تضيف دفئاً للون التاوب. القياسات والطول والقماش واللون قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-canapes', price: 11900, old_price: null, stock_quantity: 3, featured: true, new_arrival: true, promotion: false,
    colors: ['Taupe', 'Beige'], dimensions: '320 × 115 × 70 cm', materials: ['Bouclé côtelé', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'yasmin', slug: 'salon-modulaire-yasmin', name_fr: 'Salon modulaire Yasmin', name_ar: 'صالون مودولار ياسمين',
    short_description_fr: 'Un grand salon enveloppant aux modules côtelés, pensé pour une convivialité maximale.',
    short_description_ar: 'صالون كبير ومحيط بوحدات مخططة مصمم لأقصى درجات الراحة والضيافة.',
    description_fr: 'Yasmin forme un large cocon grâce à sa méridienne, son angle courbe et sa longue assise. La base côtelée et les nombreux coussins renforcent son confort visuel et réel. Dimensions indicatives et nombre de modules personnalisables sur commande.',
    description_ar: 'تصنع ياسمين جلسة محيطة بفضل الشيزلونغ والزاوية المنحنية والمقعد الطويل. القاعدة المخططة والوسائد الكثيرة تعززان الراحة. القياسات وعدد الوحدات قابلان للتخصيص حسب الطلب.',
    category_id: 'cat-salons', price: 19900, old_price: null, stock_quantity: 1, featured: true, new_arrival: true, promotion: false,
    colors: ['Écru', 'Sauge'], dimensions: '420 × 300 × 74 cm', materials: ['Bouclé côtelé', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'sahara', slug: 'salon-angle-sahara', name_fr: 'Salon d’angle Sahara', name_ar: 'صالون الزاوية صحرا',
    short_description_fr: 'Une composition sable conviviale avec deux méridiennes et un grand pouf assorti.',
    short_description_ar: 'تشكيلة رملية مريحة بشيزلونغين وبوف كبير متناسق.',
    description_fr: 'Sahara réunit une assise centrale, deux retours généreux et un grand pouf mobile. Ses coussins terracotta et graphiques donnent du relief à la teinte sable. Dimensions indicatives, pouf, orientation et tissu personnalisables sur commande.',
    description_ar: 'يجمع صحرا بين مقعد مركزي وطرفين واسعين وبوف كبير متحرك. تضيف وسائد التيراكوتا والزخارف عمقاً للون الرملي. القياسات والبوف والاتجاه والقماش قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-salons', price: 17900, old_price: 18900, stock_quantity: 2, featured: true, new_arrival: true, promotion: true,
    colors: ['Sable', 'Terracotta'], dimensions: '380 × 260 × 76 cm + pouf', materials: ['Tissu texturé', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'atlas', slug: 'salon-panoramique-atlas', name_fr: 'Salon panoramique Atlas', name_ar: 'صالون بانورامي أطلس',
    short_description_fr: 'Un salon en U équilibré, ponctué de coussins aux motifs inspirés de l’Atlas.',
    short_description_ar: 'صالون متوازن على شكل U بوسائد مزخرفة مستوحاة من الأطلس.',
    description_fr: 'Atlas dessine un U accueillant avec deux ailes profondes, une longue assise centrale et une base noire discrète. Les coussins aux tons charbon et terracotta lui donnent une signature marocaine contemporaine. Dimensions indicatives et composition personnalisable sur commande.',
    description_ar: 'يشكل أطلس جلسة مرحبة على شكل U بجناحين عميقين ومقعد مركزي طويل وقاعدة سوداء هادئة. تمنحه وسائد الفحم والتيراكوتا هوية مغربية عصرية. القياسات والتوزيع قابلان للتخصيص حسب الطلب.',
    category_id: 'cat-salons', price: 18900, old_price: null, stock_quantity: 1, featured: true, new_arrival: true, promotion: false,
    colors: ['Ivoire', 'Charbon', 'Terracotta'], dimensions: '410 × 280 × 76 cm', materials: ['Tissu bouclé', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'zen', slug: 'canape-angle-zen', name_fr: 'Canapé d’angle Zen', name_ar: 'كنبة الزاوية زين',
    short_description_fr: 'Une ligne blanche fluide et minimaliste, prolongée par une méridienne arrondie.',
    short_description_ar: 'خط أبيض انسيابي وبسيط يمتد إلى شيزلونغ دائري.',
    description_fr: 'Zen se reconnaît à son dossier continu, ses extrémités douces et sa méridienne ronde. Son profil bas et ses coussins noir et blanc créent une présence graphique très contemporaine. Dimensions indicatives, orientation et finitions personnalisables sur commande.',
    description_ar: 'تتميز زين بظهر متصل ونهايات ناعمة وشيزلونغ دائري. تصميمها المنخفض ووسائدها بالأبيض والأسود يمنحانها حضوراً عصرياً. القياسات والاتجاه والتشطيبات قابلة للتخصيص حسب الطلب.',
    category_id: 'cat-canapes', price: 11900, old_price: null, stock_quantity: 2, featured: true, new_arrival: true, promotion: false,
    colors: ['Blanc cassé', 'Noir'], dimensions: '320 × 185 × 70 cm', materials: ['Bouclé doux', 'Bois massif', 'Mousse haute résilience'],
  },
  {
    key: 'kasbah', slug: 'salon-angle-kasbah', name_fr: 'Salon d’angle Kasbah', name_ar: 'صالون الزاوية قصبة',
    short_description_fr: 'Un grand angle beige à base côtelée, relevé de coussins noirs aux motifs berbères.',
    short_description_ar: 'صالون زاوية بيج بقاعدة مخططة ووسائد سوداء بزخارف أمازيغية.',
    description_fr: 'Kasbah offre de larges assises, une méridienne confortable et une base côtelée très présente. Les coussins noirs et berbères créent un contraste chaleureux dans un intérieur marocain contemporain. Dimensions indicatives et configuration personnalisable sur commande.',
    description_ar: 'تقدم قصبة مقاعد واسعة وشيزلونغ مريحاً وقاعدة مخططة بارزة. تصنع الوسائد السوداء والأمازيغية تبايناً دافئاً في ديكور مغربي عصري. القياسات والتوزيع قابلان للتخصيص حسب الطلب.',
    category_id: 'cat-salons', price: 16900, old_price: 17900, stock_quantity: 2, featured: true, new_arrival: true, promotion: true,
    colors: ['Beige', 'Noir'], dimensions: '370 × 260 × 78 cm', materials: ['Tissu tissé', 'Bois massif', 'Mousse haute résilience'],
  },
].map((product) => ({
  ...product,
  currency: 'MAD',
  active: true,
}));

await fs.mkdir(uploadDirectory, { recursive: true });

for (const [key, sourceName] of Object.entries(imageSources)) {
  const sourcePath = path.join(reviewDirectory, sourceName);
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
