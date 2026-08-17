import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, MessageCircle, Minus, Plus, RotateCcw, ShieldCheck, ShoppingBag, Truck, X, ZoomIn } from 'lucide-react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { PaginatedProducts, Product, Settings } from '@jad-home/shared';
import { api, queryString } from '../services/api';
import { useI18n } from '../i18n/I18nProvider';
import { useCartStore } from '../store/cartStore';
import { formatPrice } from '../utils/cart';
import { ProductCard, ProductSkeleton } from '../components/ProductCard';
import { useSeo } from '../hooks/useSeo';
import { whatsappUrl } from '../utils/whatsapp';
import { SafeImage } from '../components/SafeImage';
import { useOverlay } from '../hooks/useOverlay';

export default function ProductPage() {
  const { slug = '' } = useParams();
  const { localized } = useI18n();
  const [imageIndex, setImageIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [color, setColor] = useState('');
  const [added, setAdded] = useState(false);
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);
  const product = useQuery({ queryKey:['product',slug], queryFn:()=>api<Product>(`/api/products/${slug}`) });
  const settings = useQuery({ queryKey:['settings'], queryFn:()=>api<Settings>('/api/settings/public') });
  const similar = useQuery({ queryKey:['similar',product.data?.category?.slug], queryFn:()=>api<PaginatedProducts>(`/api/products${queryString({category:product.data?.category?.slug,limit:4})}`), enabled:Boolean(product.data?.category?.slug) });
  const recentQueries = useQueries({ queries: recentSlugs.slice(0, 4).map((recentSlug) => ({ queryKey: ['product', recentSlug], queryFn: () => api<Product>(`/api/products/${recentSlug}`), staleTime: 60_000 })) });
  const addProduct = useCartStore((state)=>state.addProduct);
  const closeZoom = useCallback(()=>setZoom(false),[]);
  useOverlay(zoom,closeZoom);
  const data = product.data;
  const seoData = useMemo(()=>data?{'@context':'https://schema.org','@type':'Product',name:data.name_fr,image:data.images.map((image)=>typeof image==='string'?image:image.secureUrl),description:data.short_description_fr,offers:{'@type':'Offer',priceCurrency:'MAD',price:data.price,availability:data.stock_quantity>0?'https://schema.org/InStock':'https://schema.org/OutOfStock'}}:undefined,[data]);
  useSeo(data?.name_fr || 'Produit',data?.short_description_fr || 'Découvrez cette pièce JAD HOME.',seoData);
  useEffect(()=>{setImageIndex(0);setQuantity(1);setColor('');setAdded(false);},[slug]);
  useEffect(()=>{if(data){const key='jad_home_recent_v1';const current=JSON.parse(localStorage.getItem(key)||'[]') as string[];setRecentSlugs(current.filter((item)=>item!==data.slug));localStorage.setItem(key,JSON.stringify([data.slug,...current.filter((item)=>item!==data.slug)].slice(0,6)));}},[data]);
  useEffect(()=>{
    const galleryLength=data?.images.length||1;
    const onKeyDown=(event:KeyboardEvent)=>{
      if((event.target as HTMLElement)?.matches('input, textarea, select, button'))return;
      if(event.key==='ArrowLeft')setImageIndex((current)=>(current-1+galleryLength)%galleryLength);
      if(event.key==='ArrowRight')setImageIndex((current)=>(current+1)%galleryLength);
    };
    window.addEventListener('keydown',onKeyDown);
    return()=>window.removeEventListener('keydown',onKeyDown);
  },[data?.images.length]);
  if(product.isLoading)return <div className="container-page grid gap-10 py-12 lg:grid-cols-2"><div className="skeleton aspect-square"/><div className="space-y-5"><div className="skeleton h-5 w-1/3"/><div className="skeleton h-16 w-3/4"/><div className="skeleton h-8 w-1/3"/><div className="skeleton h-36"/></div></div>;
  if(!data)return <div className="container-page py-24 text-center"><h1 className="section-title">Produit introuvable</h1><Link to="/catalogue" className="btn-primary mt-8">Retour au catalogue</Link></div>;
  const images=data.images.length?data.images:['/jad-home-icon-v3.png'];
  const discount=data.old_price?Math.round((1-data.price/data.old_price)*100):0;
  const directMessage=`Bonjour JAD HOME, je souhaite commander : ${data.name_fr}, quantité ${quantity}${color?`, couleur ${color}`:''}.`;
  const addToCart=()=>{addProduct(data,quantity,color||undefined);setAdded(true);window.setTimeout(()=>setAdded(false),2200);};
  return <>
    <div className="container-page py-6 sm:py-10"><nav className="breadcrumb mb-7" aria-label="Fil d’Ariane"><Link to="/">Accueil</Link><span>/</span><Link to="/catalogue">Catalogue</Link><span>/</span><span className="line-clamp-1">{localized(data.name_fr,data.name_ar)}</span></nav>
      <div className="grid gap-9 lg:grid-cols-[1.12fr_.88fr] lg:gap-14 xl:gap-20"><div><div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] bg-cream/65"><SafeImage src={images[imageIndex]} alt={`${localized(data.name_fr,data.name_ar)} — vue ${imageIndex+1}`} width="1200" height="900" className="h-full w-full object-cover"/><button onClick={()=>setZoom(true)} className="icon-btn absolute bottom-4 end-4 shadow-md" aria-label="Agrandir l’image"><ZoomIn/></button>{images.length>1&&<><button onClick={()=>setImageIndex((imageIndex-1+images.length)%images.length)} className="icon-btn absolute start-4 top-1/2 -translate-y-1/2 shadow-md" aria-label="Image précédente"><ChevronLeft className="rtl-flip"/></button><button onClick={()=>setImageIndex((imageIndex+1)%images.length)} className="icon-btn absolute end-4 top-1/2 -translate-y-1/2 shadow-md" aria-label="Image suivante"><ChevronRight className="rtl-flip"/></button></>}<span className="absolute bottom-4 start-4 rounded-full bg-charcoal/75 px-3 py-1 text-[10px] font-bold text-white backdrop-blur">{imageIndex+1} / {images.length}</span></div><div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto">{images.map((image,index)=><button key={`${image}-${index}`} onClick={()=>setImageIndex(index)} className={`aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${index===imageIndex?'border-charcoal':'border-transparent opacity-65 hover:opacity-100'}`} aria-label={`Voir l’image ${index+1}`} aria-current={index===imageIndex}><SafeImage src={image} alt="" width="160" height="120" className="h-full w-full object-cover"/></button>)}</div></div>
        <div className="lg:sticky lg:top-[150px] lg:self-start"><div className="flex flex-wrap gap-2">{data.new_arrival&&<span className="badge bg-charcoal text-white">Nouveau</span>}{data.featured&&<span className="badge bg-gold text-charcoal">Vedette</span>}{data.promotion&&data.old_price&&data.old_price>data.price&&<span className="badge bg-copper text-white">−{discount}%</span>}</div><p className="eyebrow mt-5">{localized(data.category?.name_fr||'',data.category?.name_ar||'')}</p><h1 className="display-title !text-[clamp(2.6rem,4.5vw,4.8rem)]">{localized(data.name_fr,data.name_ar)}</h1><div className="mt-6 flex flex-wrap items-baseline gap-3"><span className="text-2xl font-extrabold">{data.price>0?formatPrice(data.price):'Prix sur demande'}</span>{data.old_price&&data.old_price>data.price&&<><del className="text-lg text-muted">{formatPrice(data.old_price)}</del><span className="badge bg-copper text-white">−{discount}%</span></>}</div><p className="mt-6 text-base leading-8 text-muted">{localized(data.short_description_fr,data.short_description_ar)}</p><div className="mt-5 flex items-center gap-2 text-sm"><span className={`size-2.5 rounded-full ${data.stock_quantity>0?'bg-green-600':'bg-red-500'}`}/><strong>{data.stock_quantity>0?`En stock — ${data.stock_quantity} disponible(s)`:'Épuisé'}</strong></div>
          {data.colors.length>0&&<fieldset className="mt-7"><legend className="label">Couleur : <span className="font-normal">{color||'Sélectionnez'}</span></legend><div className="flex flex-wrap gap-2">{data.colors.map((item)=><button key={item} onClick={()=>setColor(item)} className={`min-h-11 border px-4 text-sm ${color===item?'border-charcoal bg-charcoal text-white':'border-line bg-white'}`}>{item}</button>)}</div></fieldset>}
          <div className="mt-7 flex gap-3"><div className="flex rounded-full border border-line bg-white"><button className="grid size-12 place-items-center" onClick={()=>setQuantity(Math.max(1,quantity-1))} aria-label="Diminuer"><Minus size={16}/></button><span className="grid w-10 place-items-center font-bold">{quantity}</span><button className="grid size-12 place-items-center" onClick={()=>setQuantity(Math.min(Math.max(1,data.stock_quantity),quantity+1))} aria-label="Augmenter"><Plus size={16}/></button></div><button disabled={data.stock_quantity<1} onClick={addToCart} className="btn-primary flex-1"><ShoppingBag size={18}/>Ajouter au panier</button></div>{added&&<div role="status" className="alert-success mt-3 flex items-center gap-2"><Check size={17}/>Produit ajouté au panier.</div>}{settings.data?.whatsapp_number&&<a href={whatsappUrl(settings.data.whatsapp_number,directMessage)} target="_blank" rel="noreferrer" className="btn-primary mt-3 w-full !bg-[rgb(var(--color-whatsapp))]"><MessageCircle size={19}/>Commander via WhatsApp</a>}
          <div className="mt-8 divide-y divide-line border-y border-line"><Accordion title="Description"><p>{localized(data.description_fr,data.description_ar)}</p></Accordion><Accordion title="Dimensions & matières"><p><strong>Dimensions :</strong> {data.dimensions||'À confirmer'}</p><p className="mt-2"><strong>Matières :</strong> {data.materials.join(', ')||'À confirmer'}</p></Accordion><Accordion title="Livraison & garantie"><p>{settings.data?.delivery_text_fr||'Livraison partout au Maroc. Les délais sont confirmés à la commande.'}</p><p className="mt-2">Garantie selon les conditions communiquées lors de la commande.</p></Accordion><Accordion title="Retours"><p>Contactez-nous sous 48 heures si votre article présente une anomalie à la livraison.</p></Accordion></div>
          <div className="mt-7 grid grid-cols-3 gap-2 text-center">{[[Truck,'Livraison'],[ShieldCheck,'Qualité'],[RotateCcw,'Service']].map(([Icon,label])=><div className="rounded-xl border border-line bg-white p-3" key={String(label)}><Icon className="mx-auto text-copper" size={21}/><p className="mt-2 text-[11px] font-bold">{label as string}</p></div>)}</div>
        </div></div></div>
    <section className="section-space bg-cream/40"><div className="container-page"><p className="eyebrow">À associer</p><h2 className="section-title">Vous aimerez aussi</h2><div className="product-grid mt-9">{similar.isLoading?Array.from({length:4}).map((_,i)=><ProductSkeleton key={i}/>):similar.data?.items.filter((item)=>item.id!==data.id).slice(0,4).map((item)=><ProductCard product={item} key={item.id}/>)}</div></div></section>
    {recentQueries.some((query)=>query.data)&&<section className="section-space"><div className="container-page"><p className="eyebrow">Votre parcours</p><h2 className="section-title">Récemment consultés</h2><div className="product-grid mt-9">{recentQueries.flatMap((query)=>query.data?[query.data]:[]).map((item)=><ProductCard product={item} key={item.id}/>)}</div></div></section>}
    <AnimatePresence>{zoom&&<motion.div role="dialog" aria-modal="true" aria-label="Agrandissement de l’image" className="fixed inset-0 z-[90] grid place-items-center bg-charcoal/95 p-4" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={closeZoom}><button onClick={closeZoom} className="icon-btn absolute end-5 top-5" aria-label="Fermer"><X/></button><SafeImage src={images[imageIndex]} alt={localized(data.name_fr,data.name_ar)} className="max-h-[90vh] max-w-[95vw] object-contain"/></motion.div>}</AnimatePresence>
  </>;
}

function Accordion({title,children}:{title:string;children:React.ReactNode}) { const [open,setOpen]=useState(false); return <div><button className="flex min-h-14 w-full items-center justify-between text-left text-sm font-bold" onClick={()=>setOpen(!open)} aria-expanded={open}><span>{title}</span><Plus size={17} className={`transition ${open?'rotate-45':''}`}/></button>{open&&<div className="pb-5 text-sm leading-7 text-muted">{children}</div>}</div>; }
