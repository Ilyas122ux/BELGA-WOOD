import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Category, PaginatedProducts } from '@jad-home/shared';
import { api, queryString } from '../services/api';
import { useI18n } from '../i18n/I18nProvider';
import { ProductCard, ProductSkeleton } from '../components/ProductCard';
import { useSeo } from '../hooks/useSeo';
import { SafeImage } from '../components/SafeImage';
import { useOverlay } from '../hooks/useOverlay';

export default function CatalogPage({ mode = 'catalogue' }: { mode?: 'catalogue'|'new'|'promotions'|'search' }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFilters, setMobileFilters] = useState(false);
  const { language, t, localized } = useI18n();
  useOverlay(mobileFilters, () => setMobileFilters(false));
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/api/categories') });
  const activeCategory = categories.data?.find((category) => category.slug === slug);
  const title = mode === 'new' ? t('new') : mode === 'promotions' ? t('promotions') : mode === 'search' ? `Résultats pour « ${searchParams.get('q') || ''} »` : activeCategory ? localized(activeCategory.name_fr, activeCategory.name_ar) : t('catalogue');
  useSeo(title, activeCategory ? localized(activeCategory.description_fr, activeCategory.description_ar) : 'Explorez tous les meubles, salons, tables et objets JAD HOME.');
  const filters = {
    page: Number(searchParams.get('page') || 1), limit: 12, category: slug || searchParams.get('category') || undefined,
    search: mode === 'search' ? searchParams.get('q') || undefined : undefined,
    minPrice: searchParams.get('minPrice') || undefined, maxPrice: searchParams.get('maxPrice') || undefined,
    inStock: searchParams.get('inStock') === 'true', promotion: mode === 'promotions' || searchParams.get('promotion') === 'true',
    newArrival: mode === 'new' || searchParams.get('newArrival') === 'true', sort: searchParams.get('sort') || 'recommended',
  };
  const products = useQuery({ queryKey: ['products', filters], queryFn: () => api<PaginatedProducts>(`/api/products${queryString(filters)}`) });
  const update = (key: string, value?: string) => {
    if (key === 'category' && slug) {
      navigate(value ? `/categorie/${value}` : '/catalogue');
      return;
    }
    setSearchParams((current) => { const next = new URLSearchParams(current); if (value) next.set(key,value); else next.delete(key); if(key!=='page') next.delete('page'); return next; });
  };
  const reset = () => { const next = new URLSearchParams(); if (mode==='search' && searchParams.get('q')) next.set('q',searchParams.get('q')!); setSearchParams(next); };
  useEffect(() => { window.scrollTo({top:0,behavior:'smooth'}); }, [filters.page]);
  const activeFilterCount = [filters.minPrice,filters.maxPrice,filters.inStock,filters.promotion,filters.newArrival,filters.category].filter(Boolean).length;
  return <>
    <section className="relative overflow-hidden border-b border-line bg-cream/55">
      {activeCategory?.image && <><SafeImage src={activeCategory.image} alt="" width="1600" height="600" className="absolute inset-0 h-full w-full object-cover opacity-20"/><div className="absolute inset-0 bg-gradient-to-r from-ivory via-ivory/90 to-ivory/45 rtl:bg-gradient-to-l"/></>}
      <div className="container-page relative py-12 sm:py-16 lg:py-20"><nav className="breadcrumb mb-6" aria-label="Fil d’Ariane"><span>Accueil</span><span>/</span><span>{title}</span></nav><p className="eyebrow">JAD HOME · Collection</p><h1 className="display-title">{title}</h1><p className="mt-5 max-w-2xl text-base leading-7 text-muted">{activeCategory ? localized(activeCategory.description_fr,activeCategory.description_ar) : localized('Explorez notre sélection de mobilier et de tapisserie, filtrée selon votre espace et vos envies.','اكتشفوا مجموعتنا من الأثاث والتنجيد واختاروا ما يناسب مساحتكم ورغباتكم.')}</p></div>
    </section>
    <div className="container-page py-8 sm:py-12"><div className="mb-8 flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{products.data?.total ?? 0} {t('products')}</p>{activeFilterCount>0&&<button onClick={reset} className="mt-1 text-xs font-semibold text-copper underline">{activeFilterCount} filtre(s) actif(s) · {t('reset')}</button>}</div><div className="flex items-center gap-2"><button className="btn-secondary flex-1 px-4 lg:hidden" onClick={()=>setMobileFilters(true)} aria-expanded={mobileFilters}><SlidersHorizontal size={17}/>{t('filters')}{activeFilterCount>0&&<span className="grid size-5 place-items-center rounded-full bg-charcoal text-[10px] text-white">{activeFilterCount}</span>}</button><label className="sr-only" htmlFor="sort">Trier</label><select id="sort" value={filters.sort} onChange={(event)=>update('sort',event.target.value)} className="field w-auto min-w-[154px] flex-1 sm:flex-none"><option value="recommended">Recommandés</option><option value="newest">Nouveautés</option><option value="price_asc">Prix croissant</option><option value="price_desc">Prix décroissant</option><option value="name_asc">Nom A–Z</option><option value="promotions">Promotions</option></select></div></div>
      <div className="grid gap-10 lg:grid-cols-[270px_1fr] xl:gap-14"><aside className="hidden lg:block"><div className="sticky top-36 rounded-2xl border border-line/70 bg-white p-6"><Filters categories={categories.data || []} values={filters} update={update} reset={reset}/></div></aside><div>{products.isLoading ? <div className="product-grid">{Array.from({length:8}).map((_,i)=><ProductSkeleton key={i}/>)}</div> : products.isError ? <div className="alert-error"><p className="font-bold">Chargement du catalogue impossible.</p><p className="mt-1">Vérifiez votre connexion puis réessayez.</p><button onClick={()=>products.refetch()} className="btn-secondary mt-4">Réessayer</button></div> : products.data?.items.length ? <><div className="product-grid">{products.data.items.map((product)=><ProductCard key={product.id} product={product}/>)}</div><Pagination page={products.data.page} pages={products.data.pages} onPage={(page)=>update('page',String(page))}/></> : <div className="surface-soft grid min-h-[420px] place-items-center p-8 text-center"><div><span className="mx-auto grid size-20 place-items-center rounded-full bg-white"><SlidersHorizontal className="text-taupe" size={30}/></span><p className="mt-6 font-display text-4xl font-semibold">Aucun résultat</p><p className="mt-3 text-muted">{t('empty')}</p><button onClick={reset} className="btn-primary mt-6">{t('reset')}</button></div></div>}</div></div>
    </div>
    <AnimatePresence>{mobileFilters&&<motion.div className="fixed inset-0 z-[75] bg-charcoal/60 backdrop-blur-sm" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={()=>setMobileFilters(false)}><motion.aside role="dialog" aria-modal="true" aria-label={t('filters')} className="drawer-panel ms-auto w-[min(94vw,420px)] p-6" initial={{x:language==='ar'?'-100%':'100%'}} animate={{x:0}} exit={{x:language==='ar'?'-100%':'100%'}} transition={{duration:.3,ease:[.22,1,.36,1]}} onMouseDown={(e)=>e.stopPropagation()}><div className="mb-7 flex items-center justify-between"><div><p className="eyebrow">Catalogue</p><h2 className="font-display text-3xl font-semibold">{t('filters')}</h2></div><button className="icon-btn" onClick={()=>setMobileFilters(false)} aria-label="Fermer"><X/></button></div><Filters categories={categories.data||[]} values={filters} update={update} reset={reset}/><button className="btn-primary safe-bottom mt-8 w-full" onClick={()=>setMobileFilters(false)}>Voir {products.data?.total||0} produits</button></motion.aside></motion.div>}</AnimatePresence>
  </>;
}

function Filters({categories,values,update,reset}:{categories:Category[];values:Record<string,any>;update:(key:string,value?:string)=>void;reset:()=>void}) { const {t,localized}=useI18n(); return <div className="space-y-7"><div className="flex items-center justify-between"><h2 className="font-bold">{t('filters')}</h2><button onClick={reset} className="text-xs font-semibold text-copper underline">{t('reset')}</button></div><FilterGroup title="Catégories"><div className="space-y-2"><label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm"><input type="radio" name="category" className="size-4 accent-charcoal" checked={!values.category} onChange={()=>update('category')}/>Toutes les catégories</label>{categories.map((category)=><label key={category.id} className="flex min-h-9 cursor-pointer items-center justify-between gap-3 text-sm"><span className="flex items-center"><input type="radio" name="category" className="me-2 size-4 accent-charcoal" checked={values.category===category.slug} onChange={()=>update('category',category.slug)}/>{localized(category.name_fr,category.name_ar)}</span><span className="text-xs text-muted">{category.product_count}</span></label>)}</div></FilterGroup><FilterGroup title="Prix"><div className="grid grid-cols-2 gap-2"><label><span className="sr-only">Prix minimum</span><input className="field px-3" type="number" min="0" placeholder="Min" value={values.minPrice||''} onChange={(e)=>update('minPrice',e.target.value)}/></label><label><span className="sr-only">Prix maximum</span><input className="field px-3" type="number" min="0" placeholder="Max" value={values.maxPrice||''} onChange={(e)=>update('maxPrice',e.target.value)}/></label></div></FilterGroup><FilterGroup title="Sélections"><div className="space-y-3">{[['inStock','En stock'],['promotion','En promotion'],['newArrival','Nouveautés']].map(([key,label])=><label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm" key={key}><input type="checkbox" checked={Boolean(values[key])} onChange={(e)=>update(key,e.target.checked?'true':undefined)} className="size-4 accent-charcoal"/>{label}</label>)}</div></FilterGroup></div>; }
function FilterGroup({title,children}:{title:string;children:React.ReactNode}){return <div className="border-t border-line pt-5"><h3 className="mb-4 text-xs font-bold uppercase tracking-[.16em]">{title}</h3>{children}</div>}
function Pagination({page,pages,onPage}:{page:number;pages:number;onPage:(page:number)=>void}) { if(pages<=1)return null; return <nav className="mt-14 flex flex-wrap justify-center gap-2" aria-label="Pagination"><button className="icon-btn" disabled={page<=1} onClick={()=>onPage(page-1)} aria-label="Page précédente"><ChevronLeft className="rtl-flip"/></button>{Array.from({length:pages},(_,i)=>i+1).map((value)=><button key={value} className={`size-11 rounded-full border text-sm font-bold transition ${value===page?'border-charcoal bg-charcoal text-white':'border-line bg-white hover:border-charcoal'}`} onClick={()=>onPage(value)} aria-current={value===page?'page':undefined}>{value}</button>)}<button className="icon-btn" disabled={page>=pages} onClick={()=>onPage(page+1)} aria-label="Page suivante"><ChevronRight className="rtl-flip"/></button></nav>; }
