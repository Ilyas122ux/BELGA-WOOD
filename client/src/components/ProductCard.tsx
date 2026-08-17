import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, ShoppingBag, Star, X } from 'lucide-react';
import type { Product } from '@jad-home/shared';
import { useI18n } from '../i18n/I18nProvider';
import { useCartStore } from '../store/cartStore';
import { formatPrice } from '../utils/cart';
import { SafeImage } from './SafeImage';
import { useOverlay } from '../hooks/useOverlay';

export function ProductCard({ product }: { product: Product }) {
  const [quick, setQuick] = useState(false);
  const { localized, t } = useI18n();
  const addProduct = useCartStore((state) => state.addProduct);
  const closeQuick = useCallback(() => setQuick(false), []);
  useOverlay(quick, closeQuick);
  const hasPromotion = Boolean(product.promotion && product.old_price && product.old_price > product.price);
  const discount = hasPromotion && product.old_price ? Math.round((1 - product.price / product.old_price) * 100) : 0;
  const soldOut = product.stock_quantity < 1;
  return <>
    <motion.article layout initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} className="group min-w-0">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] bg-cream/65">
        <Link to={`/produit/${product.slug}`} aria-label={localized(product.name_fr, product.name_ar)}>
          <SafeImage src={product.images[0]} alt={localized(product.name_fr, product.name_ar)} loading="lazy" width="600" height="750" className="image-zoom h-full w-full object-cover" />
          {product.images[1] && <SafeImage src={product.images[1]} alt="" loading="lazy" width="600" height="750" className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100" />}
        </Link>
        <div className="absolute start-2 top-2 flex max-w-[calc(100%-3.5rem)] flex-wrap items-start gap-1.5 sm:start-3 sm:top-3">
          {product.new_arrival && <span className="badge bg-charcoal text-white">Nouveau</span>}
          {hasPromotion && <span className="badge bg-copper text-white">−{discount}%</span>}
          {product.featured && <span className="badge gap-1 bg-gold text-charcoal"><Star size={10} fill="currentColor"/>Vedette</span>}
          {soldOut && <span className="badge bg-white text-charcoal shadow-sm">Épuisé</span>}
        </div>
        <button onClick={() => setQuick(true)} className="icon-btn absolute bottom-3 end-3 shadow-md sm:translate-y-14 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100" aria-label={t('quick')}><Eye size={18}/></button>
      </div>
      <div className="pt-4">
        <p className="mb-1 truncate text-[11px] font-semibold uppercase tracking-[.16em] text-muted">{localized(product.category?.name_fr || '', product.category?.name_ar || '')}</p>
        <Link to={`/produit/${product.slug}`} className="line-clamp-2 min-h-[2.5em] font-display text-xl font-semibold leading-[1.08] transition hover:text-copper sm:text-2xl">{localized(product.name_fr, product.name_ar)}</Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <strong className="text-sm sm:text-base">{product.price > 0 ? formatPrice(product.price) : 'Prix sur demande'}</strong>
          {hasPromotion && product.old_price && <del className="text-xs text-muted sm:text-sm">{formatPrice(product.old_price)}</del>}
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 sm:translate-y-1 sm:opacity-0 sm:transition sm:duration-300 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100">
          <button disabled={soldOut} onClick={() => addProduct(product)} className="btn-primary min-h-11 px-4 text-xs"><ShoppingBag size={16}/>{soldOut ? 'Indisponible' : t('add')}</button>
          <Link to={`/produit/${product.slug}`} className="icon-btn" aria-label="Consulter la fiche"><ArrowRight size={17} className="rtl-flip"/></Link>
        </div>
      </div>
    </motion.article>
    {quick && <div className="fixed inset-0 z-[80] grid place-items-center bg-charcoal/65 p-3 backdrop-blur-sm sm:p-5" onMouseDown={closeQuick}>
      <motion.div initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} role="dialog" aria-modal="true" aria-labelledby={`quick-${product.id}`} onMouseDown={(event) => event.stopPropagation()} className="modal-panel relative grid max-h-[92vh] w-full max-w-4xl overflow-auto md:grid-cols-2">
        <button className="icon-btn absolute end-3 top-3 z-10" onClick={closeQuick} aria-label="Fermer"><X/></button>
        <SafeImage src={product.images[0]} alt={localized(product.name_fr, product.name_ar)} width="800" height="800" className="aspect-square h-full w-full bg-cream object-cover"/>
        <div className="flex flex-col justify-center p-7 sm:p-10">
          <p className="eyebrow">{localized(product.category?.name_fr || '', product.category?.name_ar || '')}</p>
          <h2 id={`quick-${product.id}`} className="font-display text-4xl font-semibold">{localized(product.name_fr, product.name_ar)}</h2>
          <p className="mt-4 text-lg font-bold">{formatPrice(product.price)}</p>
          <p className="mt-5 leading-7 text-muted">{localized(product.short_description_fr, product.short_description_ar)}</p>
          <div className="mt-7 grid gap-3"><button disabled={soldOut} className="btn-primary" onClick={() => { addProduct(product); closeQuick(); }}><ShoppingBag size={18}/>{t('add')}</button><Link className="btn-secondary" to={`/produit/${product.slug}`}>Voir la fiche complète</Link></div>
        </div>
      </motion.div>
    </div>}
  </>;
}

export function ProductSkeleton() {
  return <div aria-hidden="true"><div className="skeleton aspect-[4/5] rounded-[var(--radius-lg)]"/><div className="skeleton mt-4 h-3 w-1/3"/><div className="skeleton mt-3 h-6 w-3/4"/><div className="skeleton mt-3 h-4 w-1/2"/></div>;
}
