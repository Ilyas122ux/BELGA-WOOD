import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUp, ChevronRight, Clock3, Instagram, Menu, Minus, Phone, Plus,
  Search, ShoppingBag, Trash2, X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Category, PaginatedProducts, Settings } from '@jad-home/shared';
import { api, queryString } from '../services/api';
import { useI18n } from '../i18n/I18nProvider';
import { useCartStore } from '../store/cartStore';
import { cartCount, cartSubtotal, formatPrice } from '../utils/cart';
import { SafeImage } from '../components/SafeImage';
import { useOverlay } from '../hooks/useOverlay';

const fallbackCategories: Pick<Category, 'id' | 'slug' | 'name_fr' | 'name_ar'>[] = [
  { id: 'fallback-table', slug: 'table', name_fr: 'Table', name_ar: 'طاولات' },
  { id: 'fallback-canape', slug: 'canape', name_fr: 'Canapé', name_ar: 'كنبات' },
  { id: 'fallback-salon-marocain', slug: 'salon-marocain', name_fr: 'Salon marocain', name_ar: 'صالون مغربي' },
  { id: 'fallback-salon-moderne', slug: 'salon-moderne', name_fr: 'Salon moderne', name_ar: 'صالون عصري' },
  { id: 'fallback-lit', slug: 'lit', name_fr: 'Lit', name_ar: 'أسرة' },
  { id: 'fallback-chaise', slug: 'chaise', name_fr: 'Chaise', name_ar: 'كراسي' },
  { id: 'fallback-matelas', slug: 'matelas', name_fr: 'Matelas', name_ar: 'مراتب' },
  { id: 'fallback-armoire', slug: 'armoire', name_fr: 'Armoire', name_ar: 'خزائن' },
  { id: 'fallback-bardage', slug: 'bardage', name_fr: 'Bardage', name_ar: 'تكسية الجدران' },
];

export function PublicLayout() {
  const { language, setLanguage, t, localized } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/api/categories') });
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/api/settings/public'), staleTime: 300_000 });
  const suggestions = useQuery({
    queryKey: ['search-suggestions', query],
    queryFn: () => api<PaginatedProducts>(`/api/products${queryString({ search: query, limit: 5 })}`),
    enabled: query.trim().length > 1,
  });
  const cart = useCartStore();
  const count = useMemo(() => cartCount(cart.items), [cart.items]);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const closeCart = useCallback(() => cart.setOpen(false), [cart]);
  useOverlay(menuOpen, closeMenu);
  useOverlay(searchOpen, closeSearch);
  useOverlay(cart.open, closeCart);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 36);
      setShowTop(window.scrollY > 650);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    navigate(`/recherche?q=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
  };
  const whatsapp = settings.data?.whatsapp_number?.replace(/\D/g, '') || '';
  const categoryNavSource = categories.data?.length ? categories.data : fallbackCategories;
  const categoryNav = categoryNavSource.map((category) => ({
    to: `/categorie/${category.slug}`,
    label: localized(category.name_fr, category.name_ar),
    id: category.id,
  }));
  const nav = [
    { to: '/', label: t('home') },
    { to: '/nouveautes', label: t('new') },
    { to: '/promotions', label: t('promotions') },
    { to: '/contact', label: t('contact') },
  ];
  const desktopNav = [nav[0], ...categoryNav, nav[2]];
  const isHomePage = location.pathname === '/';
  const chromeVisible = !isHomePage || scrolled || menuOpen || searchOpen || cart.open;
  const homeChromeState = chromeVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-full opacity-0';
  const topBarClassName = isHomePage
    ? `fixed inset-x-0 top-0 z-[60] bg-charcoal text-cream transition-all duration-500 ease-out ${homeChromeState}`
    : 'bg-charcoal text-cream';
  const headerClassName = isHomePage
    ? `fixed inset-x-0 top-9 z-50 border-b border-line/70 bg-logo-bar transition-all duration-500 ease-out ${chromeVisible ? 'translate-y-0 opacity-100 shadow-[0_12px_35px_rgb(33_30_27/.08)]' : 'pointer-events-none -translate-y-[135%] opacity-0'}`
    : `sticky top-0 z-50 border-b border-line/70 bg-logo-bar transition-shadow duration-300 ${scrolled ? 'shadow-[0_12px_35px_rgb(33_30_27/.08)]' : ''}`;

  return <div className="min-h-screen bg-white text-charcoal">
    <div className={topBarClassName}>
      <div className="container-page flex min-h-9 items-center justify-between gap-3 text-[10px] font-semibold tracking-wide sm:text-[11px]">
        <span className="truncate">{t('delivery')}</span>
        <button className="min-h-9 shrink-0 px-2 font-bold text-gold" onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}>
          {language === 'fr' ? 'العربية' : 'Français'}
        </button>
      </div>
    </div>

    <header className={headerClassName}>
      <div className={`container-page grid grid-cols-[auto_1fr_auto] items-center gap-3 transition-[height] duration-300 lg:grid-cols-[260px_1fr_260px] ${scrolled ? 'h-16 lg:h-[70px]' : 'h-[76px] lg:h-[88px]'}`}>
        <div className="flex items-center gap-1.5">
          <button className="icon-btn lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu" aria-expanded={menuOpen} aria-controls="mobile-navigation"><Menu size={20}/></button>
          <button className="icon-btn lg:hidden" onClick={() => setSearchOpen(true)} aria-label={t('search')}><Search size={19}/></button>
          <Link to="/" aria-label="JAD HOME — Accueil" className="hidden lg:block">
            <SafeImage src="/jad-home-logo-v3.png" alt="JAD HOME" width="224" height="62" className={`w-[210px] object-contain object-left transition-[height] duration-300 ${scrolled ? 'h-12' : 'h-14'}`}/>
          </Link>
        </div>

        <Link to="/" aria-label="JAD HOME — Accueil" className="justify-self-center lg:hidden">
          <SafeImage src="/jad-home-logo-v3.png" alt="JAD HOME" width="180" height="52" className="h-12 w-[145px] object-contain sm:w-[180px]"/>
        </Link>
        <button onClick={() => setSearchOpen(true)} className="mx-auto hidden min-h-12 w-full max-w-xl items-center gap-3 rounded-full border border-line bg-white px-5 text-left text-sm text-muted transition hover:border-taupe hover:shadow-sm lg:flex">
          <Search size={18}/><span className="truncate">{t('search')}</span><span className="ms-auto text-[10px] font-bold uppercase tracking-[.14em] text-taupe">JAD HOME</span>
        </button>

        <div className="flex items-center justify-end gap-1.5">
          {whatsapp && <a className="hidden min-h-11 items-center gap-2 rounded-full px-3 text-xs font-bold transition hover:bg-cream xl:flex" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer"><Phone size={17}/>{settings.data?.phone_number || 'WhatsApp'}</a>}
          <button className="icon-btn relative" onClick={() => cart.setOpen(true)} aria-label={`${t('cart')}, ${count} articles`} aria-expanded={cart.open} aria-controls="cart-drawer">
            <ShoppingBag size={20}/>{count > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-gold text-[10px] font-extrabold text-charcoal">{count}</span>}
          </button>
        </div>
      </div>
      <nav className="hidden border-t border-line/55 bg-white/90 lg:block" aria-label="Navigation principale">
        <div className="hide-scrollbar container-page flex min-h-12 items-center justify-start gap-5 overflow-x-auto xl:justify-center xl:gap-7">
          {desktopNav.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `relative flex min-h-12 shrink-0 items-center whitespace-nowrap text-[11px] font-bold uppercase tracking-[.1em] transition hover:text-copper ${isActive ? 'text-copper after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-copper' : ''}`}>{item.label}</NavLink>)}
        </div>
      </nav>
    </header>

    <main><Outlet/></main>

    <footer className="bg-charcoal text-cream">
      <div className="container-page grid gap-11 py-16 sm:grid-cols-2 lg:grid-cols-[1.3fr_.9fr_.9fr_1.15fr] lg:py-20">
        <div>
          <SafeImage src="/jad-home-logo-v3.png" alt="JAD HOME" width="260" height="86" className="h-20 w-64 object-contain object-left"/>
          <p className="mt-5 max-w-sm text-sm leading-7 text-cream/70">{localized('Maison marocaine de mobilier et de tapisserie. Des lignes généreuses, des matières choisies et un accompagnement réellement personnel.', 'دار مغربية للأثاث والتنجيد، بخطوط مريحة وخامات مختارة ومواكبة شخصية.')}</p>
          {whatsapp && <a href={`https://wa.me/${whatsapp}`} className="mt-6 inline-flex min-h-11 items-center gap-2 border-b border-gold/70 text-sm font-bold text-gold" target="_blank" rel="noreferrer"><Phone size={17}/>WhatsApp · {settings.data?.phone_number || 'WhatsApp'}</a>}
        </div>
        <FooterLinks title={localized('La boutique', 'المتجر')} links={[[t('catalogue'),'/catalogue'],[t('new'),'/nouveautes'],[t('promotions'),'/promotions'],[t('cart'),'/panier']]}/>
        <FooterLinks title={localized('Informations', 'معلومات')} links={[[t('about'),'/a-propos'],[localized('Livraison','التوصيل'),'/livraison'],[localized('Retours','الإرجاع'),'/retours'],['FAQ','/faq'],[localized('Confidentialité','الخصوصية'),'/confidentialite']]}/>
        <div>
          <h3 className="font-display text-2xl font-semibold">{localized('Contact & horaires', 'التواصل والمواعيد')}</h3>
          <p className="mt-5 text-sm leading-6 text-cream/65">{settings.data?.address}</p>
          <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-cream/65"><Clock3 size={17} className="mt-1 shrink-0 text-gold"/>Lun–Sam · 09:30–19:00</p>
          <div className="mt-5 flex gap-3">
            {settings.data?.instagram_url && <a href={settings.data.instagram_url} className="icon-btn border-white/20 bg-transparent text-white hover:border-gold hover:bg-gold hover:text-charcoal" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18}/></a>}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-3 py-5 text-xs text-cream/50 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} JAD HOME. Tous droits réservés.</span>
          <div className="flex flex-wrap gap-5"><Link to="/conditions">Conditions générales</Link><Link to="/confidentialite">Confidentialité</Link></div>
        </div>
      </div>
    </footer>

    <AnimatePresence>{menuOpen && <motion.div className="fixed inset-0 z-[70] bg-charcoal/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={closeMenu}>
      <motion.aside id="mobile-navigation" role="dialog" aria-modal="true" aria-label="Navigation mobile" initial={{ x: language === 'ar' ? '100%' : '-100%' }} animate={{ x: 0 }} exit={{ x: language === 'ar' ? '100%' : '-100%' }} transition={{ duration: .3, ease: [.22,1,.36,1] }} onMouseDown={(event) => event.stopPropagation()} className="drawer-panel w-[min(91vw,410px)] p-5 sm:p-7">
        <div className="flex items-center justify-between"><SafeImage src="/jad-home-logo-v3.png" alt="JAD HOME" width="190" height="58" className="h-14 w-48 object-contain"/><button className="icon-btn" onClick={closeMenu} aria-label="Fermer"><X/></button></div>
        <nav className="mt-7 grid">{nav.map((item) => <NavLink key={item.to} to={item.to} className={({isActive}) => `flex min-h-[52px] items-center justify-between border-b border-line font-display text-[1.7rem] font-semibold ${isActive ? 'text-copper' : ''}`}><span>{item.label}</span><ChevronRight size={17} className="rtl-flip text-taupe"/></NavLink>)}</nav>
        <p className="mt-8 text-[10px] font-bold uppercase tracking-[.2em] text-muted">{localized('Toutes les catégories', 'كل الفئات')}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">{categoryNavSource.map((category) => <Link className="flex min-h-12 items-center rounded-xl border border-line bg-white px-3 text-sm font-semibold" to={`/categorie/${category.slug}`} key={category.id}>{localized(category.name_fr, category.name_ar)}</Link>)}</div>
        <button className="btn-secondary mt-8 w-full" onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}>{language === 'fr' ? 'العربية' : 'Français'}</button>
        {whatsapp && <a href={`https://wa.me/${whatsapp}`} className="btn-primary mt-3 w-full !bg-[rgb(var(--color-whatsapp))]" target="_blank" rel="noreferrer"><Phone size={18}/>WhatsApp</a>}
      </motion.aside>
    </motion.div>}</AnimatePresence>

    <AnimatePresence>{searchOpen && <motion.div className="fixed inset-0 z-[75] bg-charcoal/70 p-3 pt-12 backdrop-blur-sm sm:p-6 sm:pt-24" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={closeSearch}>
      <motion.div role="dialog" aria-modal="true" aria-label={t('search')} initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onMouseDown={(event) => event.stopPropagation()} className="modal-panel mx-auto max-w-3xl p-5 sm:p-8">
        <div className="flex items-center justify-between gap-4"><div><p className="eyebrow">JAD HOME</p><h2 className="font-display text-3xl font-semibold sm:text-4xl">{t('search')}</h2></div><button className="icon-btn" onClick={closeSearch} aria-label="Fermer"><X/></button></div>
        <form onSubmit={submitSearch} className="mt-6 flex gap-2"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="field" placeholder={t('search')} aria-label={t('search')}/><button className="icon-btn !size-12 !bg-charcoal !text-white" aria-label="Lancer la recherche"><Search/></button></form>
        {query.length > 1 && <div className="mt-4 divide-y divide-line">{suggestions.isLoading ? <div className="skeleton h-20"/> : suggestions.data?.items.length ? suggestions.data.items.map((product) => <Link key={product.id} to={`/produit/${product.slug}`} className="flex min-h-20 items-center gap-4 py-3 transition hover:bg-cream/30"><SafeImage src={product.images[0]} alt="" width="64" height="64" className="size-16 rounded-lg bg-cream object-cover"/><div className="min-w-0"><p className="truncate font-semibold">{localized(product.name_fr, product.name_ar)}</p><p className="mt-1 text-sm text-muted">{formatPrice(product.price)}</p></div></Link>) : <p className="py-7 text-sm text-muted">{t('empty')}</p>}</div>}
      </motion.div>
    </motion.div>}</AnimatePresence>

    <AnimatePresence>{cart.open && <motion.div className="fixed inset-0 z-[80] bg-charcoal/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={closeCart}>
      <motion.aside id="cart-drawer" role="dialog" aria-modal="true" aria-label={t('cart')} initial={{ x: language === 'ar' ? '-100%' : '100%' }} animate={{ x: 0 }} exit={{ x: language === 'ar' ? '-100%' : '100%' }} transition={{ duration: .3, ease: [.22,1,.36,1] }} onMouseDown={(event) => event.stopPropagation()} className="drawer-panel ms-auto flex w-full max-w-md flex-col">
        <div className="flex items-center justify-between border-b border-line p-5 sm:p-6"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-copper">JAD HOME</p><h2 className="mt-1 font-display text-3xl font-semibold">{t('cart')} <span className="text-base text-muted">({count})</span></h2></div><button className="icon-btn" onClick={closeCart} aria-label="Fermer"><X/></button></div>
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">{cart.items.length ? <div className="space-y-5">{cart.items.map((item) => <div key={`${item.productId}-${item.color}`} className="grid grid-cols-[88px_1fr_auto] gap-3 border-b border-line pb-5"><Link to={`/produit/${item.slug}`}><SafeImage src={item.image} alt={item.name} width="88" height="104" className="h-[104px] w-[88px] rounded-lg bg-cream object-cover"/></Link><div className="min-w-0"><Link to={`/produit/${item.slug}`} className="line-clamp-2 font-display text-xl font-semibold leading-tight">{item.name}</Link>{item.color && <p className="mt-1 text-xs text-muted">Couleur · {item.color}</p>}<p className="mt-2 text-sm font-bold">{formatPrice(item.price)}</p><div className="mt-3 flex w-fit rounded-full border border-line bg-white"><button className="grid size-10 place-items-center" onClick={() => cart.updateQuantity(item.productId,item.quantity-1,item.color)} aria-label="Diminuer"><Minus size={14}/></button><span className="grid w-9 place-items-center text-sm font-bold">{item.quantity}</span><button className="grid size-10 place-items-center" onClick={() => cart.updateQuantity(item.productId,item.quantity+1,item.color)} aria-label="Augmenter"><Plus size={14}/></button></div></div><button onClick={() => cart.removeItem(item.productId,item.color)} className="grid size-10 place-items-center rounded-full text-muted transition hover:bg-red-50 hover:text-red-700" aria-label="Supprimer"><Trash2 size={17}/></button></div>)}</div> : <div className="grid h-full min-h-[420px] place-items-center text-center"><div><span className="mx-auto grid size-24 place-items-center rounded-full bg-cream/60"><ShoppingBag className="text-taupe" size={42}/></span><p className="mt-6 font-display text-3xl font-semibold">{localized('Votre panier est vide', 'سلتك فارغة')}</p><Link to="/catalogue" onClick={closeCart} className="btn-primary mt-7">{t('continue')}</Link></div></div>}</div>
        {cart.items.length > 0 && <div className="safe-bottom border-t border-line bg-white p-5 sm:p-6"><div className="flex justify-between text-lg font-bold"><span>{t('total')}</span><span>{formatPrice(cartSubtotal(cart.items))}</span></div><p className="mt-2 text-xs text-muted">Livraison confirmée avec notre équipe.</p><Link to="/commande" onClick={closeCart} className="btn-primary mt-5 w-full">{t('checkout')}</Link><Link to="/panier" onClick={closeCart} className="btn-text mt-2 w-full justify-center border-0">Voir le panier</Link></div>}
      </motion.aside>
    </motion.div>}</AnimatePresence>

    {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="fixed bottom-5 end-5 z-40 grid size-14 place-items-center rounded-full bg-[rgb(var(--color-whatsapp))] text-white shadow-lift transition hover:-translate-y-1" aria-label="Commander sur WhatsApp"><Phone/></a>}
    {showTop && <button className="icon-btn fixed bottom-5 start-5 z-40 shadow-lg" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Retour en haut"><ArrowUp/></button>}
  </div>;
}

function FooterLinks({ title, links }: { title: string; links: [string,string][] }) {
  return <div><h3 className="font-display text-2xl font-semibold">{title}</h3><ul className="mt-5 space-y-3 text-sm text-cream/70">{links.map(([label,to]) => <li key={to}><Link className="inline-flex min-h-7 items-center transition hover:translate-x-1 hover:text-gold rtl:hover:-translate-x-1" to={to}>{label}</Link></li>)}</ul></div>;
}
