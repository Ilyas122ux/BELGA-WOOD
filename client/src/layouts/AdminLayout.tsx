import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArchiveRestore, FolderTree, Languages, LayoutDashboard, LogOut, Menu, Package, Settings, ShoppingBag, Store, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { SafeImage } from '../components/SafeImage';
import { useOverlay } from '../hooks/useOverlay';
import { useI18n } from '../i18n/I18nProvider';

type AdminMe = {
  email: string;
  catalogueBackend?: 'excel' | 'google-sheets';
};

export function AdminGuard() {
  const me = useQuery({ queryKey: ['admin-me'], queryFn: () => api<AdminMe>('/api/auth/me'), retry: false });
  if (me.isLoading) return <div className="grid min-h-screen place-items-center bg-charcoal"><SafeImage src="/jad-home-icon-v3.png" alt="Chargement" width="80" height="80" className="size-20 animate-pulse" /></div>;
  if (me.isError) return <Navigate to="/admin/connexion" replace />;
  return <AdminLayout email={me.data?.email} catalogueBackend={me.data?.catalogueBackend} />;
}

function AdminLayout({ email, catalogueBackend }: { email?: string; catalogueBackend?: 'excel' | 'google-sheets' }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const close = useCallback(() => setOpen(false), []);
  const { language, setLanguage, localized } = useI18n();
  useOverlay(open, close);
  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }); queryClient.clear(); navigate('/admin/connexion'); };
  const links = [
    [LayoutDashboard, localized('Tableau de bord', 'لوحة التحكم'), '/admin'],
    [ShoppingBag, localized('Commandes', 'الطلبات'), '/admin/commandes'],
    [Package, localized('Produits', 'المنتجات'), '/admin/produits'],
    [FolderTree, localized('Catégories', 'الفئات'), '/admin/categories'],
    [Settings, localized('Paramètres', 'الإعدادات'), '/admin/parametres'],
    [ArchiveRestore, localized('Sauvegardes', 'النسخ الاحتياطية'), '/admin/sauvegardes'],
  ] as const;
  const runtimeLabel = catalogueBackend === 'google-sheets'
    ? 'Catalogue Google Sheets synchronisé'
    : 'Catalogue Excel sécurisé · Enregistré automatiquement';

  return <div className="min-h-screen bg-ivory">
    {open && <button className="fixed inset-0 z-40 bg-charcoal/55 backdrop-blur-sm lg:hidden" onClick={close} aria-label="Fermer la navigation" />}
    <aside className={`fixed inset-y-0 start-0 z-50 flex w-[min(86vw,288px)] flex-col border-e border-white/10 bg-charcoal p-5 text-white shadow-lift transition-transform duration-300 lg:w-72 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'}`}>
      <div className="flex items-center justify-between"><SafeImage src="/jad-home-logo-v3.png" alt="JAD HOME" width="210" height="64" className="h-16 w-52 object-contain" /><button className="icon-btn border-white/20 bg-transparent text-white lg:hidden" onClick={close} aria-label="Fermer"><X /></button></div>
      <div className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-gold">{localized('Administration', 'الإدارة')}</p><p className="mt-1 truncate text-xs text-white/55">{email}</p></div>
      <nav className="mt-7 grid gap-1.5" aria-label="Navigation administrateur">{links.map(([Icon, label, to]) => <NavLink end={to === '/admin'} key={to} to={to} onClick={close} className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition ${isActive ? 'bg-gold text-charcoal shadow-lg' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}><Icon size={19} />{label}</NavLink>)}</nav>
      <div className="mt-auto space-y-1 border-t border-white/10 pt-4"><a href="/" target="_blank" className="flex min-h-11 items-center gap-3 rounded-xl px-4 text-sm text-white/70 hover:bg-white/10 hover:text-white"><Store size={18} />{localized('Voir la boutique', 'عرض المتجر')}</a><button onClick={logout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 text-sm text-white/70 hover:bg-white/10 hover:text-white"><LogOut size={18} />{localized('Déconnexion', 'تسجيل الخروج')}</button></div>
    </aside>
    <div className="lg:ps-72"><header className="sticky top-0 z-30 flex min-h-16 items-center border-b border-line/70 bg-white/90 px-4 backdrop-blur-xl sm:px-7"><button className="icon-btn lg:hidden" onClick={() => setOpen(true)} aria-label="Menu" aria-expanded={open}><Menu /></button><div className="ms-auto flex items-center gap-3 text-xs font-semibold text-muted"><button className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-white px-3 font-bold text-charcoal" onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}><Languages size={15} />{language === 'fr' ? 'العربية' : 'Français'}</button><span className="size-2 rounded-full bg-green-600" /><span className="hidden sm:inline">{runtimeLabel}</span><span className="sm:hidden">{localized('En ligne', 'متصل')}</span></div></header><main className="p-4 sm:p-7 lg:p-10 xl:p-12"><Outlet /></main></div>
  </div>;
}
