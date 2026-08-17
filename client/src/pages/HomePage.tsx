import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, Headphones, MessageCircle, Truck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Category, PaginatedProducts, Settings } from '@jad-home/shared';
import heroImage from '../assets/hero-jad-home.webp';
import bedroomHeroImage from '../assets/home-bedroom-hero.webp';
import { api, queryString } from '../services/api';
import { useI18n } from '../i18n/I18nProvider';
import { ProductCard, ProductSkeleton } from '../components/ProductCard';
import { useSeo } from '../hooks/useSeo';
import { SafeImage } from '../components/SafeImage';

const reveal = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};

const fallbackCategories = [
  { slug: 'salon-moderne', name_fr: 'Salons modernes', name_ar: 'صالونات عصرية', description_fr: 'Lignes généreuses, confort profond et finitions contemporaines.' },
  { slug: 'table', name_fr: 'Tables', name_ar: 'طاولات', description_fr: 'Pièces centrales pour composer un espace élégant et pratique.' },
  { slug: 'lit', name_fr: 'Chambres', name_ar: 'غرف النوم', description_fr: 'Volumes doux et matières apaisantes pour une chambre accueillante.' },
  { slug: 'armoir', name_fr: 'Rangements', name_ar: 'خزائن', description_fr: 'Solutions sobres pour garder un intérieur clair et harmonieux.' },
];

export default function HomePage() {
  const { localized } = useI18n();
  useSeo('Meubles, tapisserie & décoration au Maroc', 'Découvrez les collections JAD HOME : canapés, salons, tables, fauteuils, rangements et tapisserie au Maroc.', { '@context': 'https://schema.org', '@type': 'Organization', name: 'JAD HOME', slogan: 'Tout pour votre tapisserie', url: window.location.origin, logo: `${window.location.origin}/jad-home-logo-v3.png` });

  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/api/categories') });
  const featured = useQuery({ queryKey: ['home-products', 'featured'], queryFn: () => api<PaginatedProducts>(`/api/products${queryString({ featured: true, limit: 4 })}`) });
  const news = useQuery({ queryKey: ['home-products', 'new'], queryFn: () => api<PaginatedProducts>(`/api/products${queryString({ newArrival: true, limit: 4 })}`) });
  const promos = useQuery({ queryKey: ['home-products', 'promo'], queryFn: () => api<PaginatedProducts>(`/api/products${queryString({ promotion: true, limit: 4 })}`) });
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/api/settings/public'), staleTime: 300_000 });

  const whatsapp = settings.data?.whatsapp_number?.replace(/\D/g, '') || '';
  const visualCategories = categories.data?.length ? categories.data.slice(0, 6) : fallbackCategories;
  const heroProductImage = bedroomHeroImage;

  return (
    <>
      <section className="relative isolate min-h-[680px] overflow-hidden bg-charcoal text-white sm:min-h-[760px] lg:min-h-[calc(100vh-132px)]">
        <SafeImage src={heroProductImage} alt={localized('Salon premium JAD HOME', 'صالون راق من جاد هوم')} fetchPriority="high" width="1728" height="920" className="absolute inset-0 -z-20 h-full w-full object-cover object-[66%_center] sm:object-center" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_72%_28%,rgba(241,230,209,.18),transparent_34%),linear-gradient(90deg,rgba(33,30,27,.92),rgba(33,30,27,.58)_45%,rgba(33,30,27,.14))] rtl:bg-[radial-gradient(circle_at_28%_28%,rgba(241,230,209,.18),transparent_34%),linear-gradient(270deg,rgba(33,30,27,.92),rgba(33,30,27,.58)_45%,rgba(33,30,27,.14))]" />
        <div className="absolute inset-x-5 top-5 -z-0 h-24 rounded-full bg-logoBar/70 blur-3xl sm:inset-x-20 sm:h-32" />

        <div className="container-page flex min-h-[680px] items-center py-16 sm:min-h-[760px] lg:min-h-[calc(100vh-132px)] lg:py-20">
          <motion.div variants={stagger} initial="hidden" animate="visible" className="max-w-3xl">
            <motion.div variants={reveal} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="mb-8 inline-flex items-center gap-3 rounded-full border border-copper/35 bg-logo-bar/95 py-2 pe-5 ps-2.5 shadow-lift backdrop-blur">
              <SafeImage src="/jad-home-icon-v3.png" alt="" loading="eager" width="48" height="48" className="size-12 shrink-0 rounded-full object-cover shadow-sm sm:size-14" />
              <span className="font-display text-[1.7rem] font-semibold tracking-[.12em] sm:text-4xl" dir="ltr"><span className="text-charcoal">JAD</span><span className="text-copper"> HOME</span></span>
            </motion.div>
            <motion.p variants={reveal} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="mb-5 text-[11px] font-bold uppercase tracking-[.34em] text-gold sm:text-xs">Mobilier · Tapisserie · Intérieurs</motion.p>
            <motion.h1 variants={reveal} transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }} className="display-title max-w-[10.8ch] text-[clamp(3.2rem,8vw,7.4rem)]">
              {localized('Une maison qui respire le confort.', 'بيت ينبض بالراحة والأناقة.')}
            </motion.h1>
            <motion.p variants={reveal} transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }} className="mt-7 max-w-2xl text-base leading-8 text-white/78 sm:text-lg sm:leading-9">
              {localized('Des salons, tables et pièces de tapisserie choisis pour créer un intérieur chaleureux, élégant et facile à vivre.', 'صالونات وطاولات وقطع تنجيد مختارة لبيت دافئ وأنيق ومريح في كل يوم.')}
            </motion.p>
          </motion.div>
        </div>

        <div className="absolute inset-x-0 bottom-0 hidden border-t border-white/15 bg-charcoal/45 backdrop-blur-xl lg:block">
          <div className="container-page grid grid-cols-3 divide-x divide-white/15 py-5 text-white rtl:divide-x-reverse">
            {[
              ['Sélection premium', 'Canapés, lits, tables et salons'],
              ['Conseil proche', 'Un accompagnement simple et humain'],
              ['Commande rapide', 'Validation directe via WhatsApp'],
            ].map(([title, text]) => <div className="px-8 first:ps-0" key={title}><p className="text-[10px] font-bold uppercase tracking-[.22em] text-gold">{title}</p><p className="mt-1 text-sm text-white/70">{text}</p></div>)}
          </div>
        </div>
      </section>

      <CategoryShowcase categories={visualCategories} loading={categories.isLoading} />
      <ProductSection eyebrow="Sélection JAD HOME" title={localized('Les pièces qui signent un intérieur.', 'قطع تضيف لمسة خاصة لبيتك.')} query={featured} link="/catalogue?featured=true" />
      <ProductSection eyebrow="Nouveautés" title={localized('Fraîchement arrivés', 'وصل حديثاً')} query={news} link="/nouveautes" background />
      {Boolean(promos.data?.items.length) && <ProductSection eyebrow="Offres du moment" title={localized('Sélection en promotion', 'مختارات مخفضة')} query={promos} link="/promotions" />}
      <TrustSection />
      <FinalCta whatsapp={whatsapp} />
    </>
  );
}

function CategoryShowcase({ categories, loading }: { categories: Array<Category | typeof fallbackCategories[number]>; loading: boolean }) {
  const { localized } = useI18n();
  return (
    <section className="section-space overflow-hidden bg-logoBar/55">
      <div className="container-page">
        <SectionHeading eyebrow="La maison, pièce par pièce" title={localized('Explorer nos univers', 'اكتشف عوالمنا')} link="/catalogue" />
        <div className="hide-scrollbar mt-10 flex snap-x gap-4 overflow-x-auto pb-5 lg:grid lg:grid-cols-3 lg:overflow-visible xl:grid-cols-6">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeleton aspect-[4/5] min-w-[76vw] sm:min-w-[42vw] lg:min-w-0" />)
            : categories.map((category, index) => {
              const image = 'image' in category ? category.image : undefined;
              const count = 'product_count' in category ? category.product_count : undefined;
              const descriptionAr = 'description_ar' in category ? category.description_ar : category.name_ar;
              return (
                <motion.article key={category.slug} variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} transition={{ delay: index * 0.04, duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="min-w-[76vw] snap-start sm:min-w-[42vw] lg:min-w-0">
                  <Link to={`/categorie/${category.slug}`} className="group block overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-card transition duration-500 hover:-translate-y-1 hover:shadow-lift">
                    <div className="relative aspect-[4/5] overflow-hidden bg-cream">
                      <SafeImage src={image || heroImage} alt={localized(category.name_fr, category.name_ar)} loading="lazy" width="520" height="650" className="image-zoom h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-charcoal/82 via-charcoal/10 to-transparent" />
                      {count !== undefined && <span className="badge absolute start-4 top-4 bg-white/90 text-charcoal backdrop-blur">{count || 0} articles</span>}
                    </div>
                    <div className="p-5">
                      <h3 className="font-display text-3xl font-semibold">{localized(category.name_fr, category.name_ar)}</h3>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{localized(category.description_fr || 'Une sélection pensée pour donner du caractère à votre espace.', descriptionAr)}</p>
                      <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-copper">Découvrir<ArrowRight size={14} className="rtl-flip" /></span>
                    </div>
                  </Link>
                </motion.article>
              );
            })}
        </div>
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section className="bg-charcoal py-16 text-white sm:py-20">
      <div className="container-page">
        <p className="eyebrow text-gold">Pourquoi JAD HOME ?</p>
        <h2 className="section-title max-w-2xl">Un service pensé pour choisir sans stress.</h2>
        <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/15 lg:grid-cols-4">
          {[
            [Truck, 'Livraison', 'Partout au Maroc'],
            [BadgeCheck, 'Sélection', 'Finitions soignées'],
            [Headphones, 'Conseil', 'Accompagnement simple'],
            [MessageCircle, 'WhatsApp', 'Commande rapide'],
          ].map(([Icon, title, text]) => (
            <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="bg-charcoal p-5 sm:p-8" key={String(title)}>
              <Icon className="text-gold" size={27} />
              <h3 className="mt-5 font-display text-2xl font-semibold">{title as string}</h3>
              <p className="mt-2 text-xs text-white/55 sm:text-sm">{text as string}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ whatsapp }: { whatsapp: string }) {
  const { localized } = useI18n();
  return (
    <section className="section-space bg-white">
      <div className="container-page">
        <motion.div variants={reveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }} className="relative overflow-hidden rounded-[var(--radius-xl)] bg-logoBar p-7 shadow-card sm:p-10 lg:p-14">
          <div className="absolute -end-16 -top-16 size-64 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="eyebrow">Votre intérieur commence ici</p>
              <h2 className="section-title">{localized('Explorez les collections ou commandez directement.', 'اكتشف المجموعات أو اطلب مباشرة.')}</h2>
              <p className="mt-5 max-w-2xl leading-7 text-muted">{localized('Parcourez les catégories, ouvrez une fiche produit et envoyez votre sélection sur WhatsApp en quelques instants.', 'تصفح التصنيفات وافتح صفحة المنتج ثم أرسل اختيارك عبر واتساب بسهولة.')}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link to="/catalogue" className="btn-primary">{localized('Voir tous les produits', 'كل المنتجات')}<ArrowRight size={17} className="rtl-flip" /></Link>
              <Link to="/catalogue" className="btn-secondary">{localized('Explorer les catégories', 'تصفح التصنيفات')}</Link>
              {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="btn-secondary !border-[rgb(var(--color-whatsapp))] !text-[rgb(var(--color-whatsapp))] hover:!bg-[rgb(var(--color-whatsapp))] hover:!text-white"><MessageCircle size={18} />WhatsApp</a>}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, link }: { eyebrow: string; title: string; link: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="section-title">{title}</h2>
      </div>
      <Link className="btn-text hidden sm:inline-flex" to={link}>Tout voir<ArrowRight size={15} className="rtl-flip" /></Link>
    </div>
  );
}

function ProductSection({ eyebrow, title, query, link, background = false }: { eyebrow: string; title: string; query: ReturnType<typeof useQuery<PaginatedProducts>>; link: string; background?: boolean }) {
  if (!query.isLoading && !query.data?.items.length) return null;
  return (
    <section className={`section-space ${background ? 'bg-cream/35' : ''}`}>
      <div className="container-page">
        <SectionHeading eyebrow={eyebrow} title={title} link={link} />
        <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} className="product-grid mt-10">
          {query.isLoading
            ? Array.from({ length: 4 }).map((_, index) => <ProductSkeleton key={index} />)
            : query.data?.items.map((product) => <motion.div key={product.id} variants={reveal} transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}><ProductCard product={product} /></motion.div>)}
        </motion.div>
        <Link className="btn-secondary mt-10 w-full sm:hidden" to={link}>Tout voir</Link>
      </div>
    </section>
  );
}
