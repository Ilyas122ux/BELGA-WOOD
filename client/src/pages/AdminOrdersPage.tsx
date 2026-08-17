import { useCallback, useDeferredValue, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Eye, LoaderCircle,
  MessageCircle, PackageCheck, RefreshCw, Save, Search, ShoppingBag, X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ORDER_STATUSES, type Order, type OrderStatus, type PaginatedOrders } from '@jad-home/shared';
import { api, queryString } from '../services/api';
import { SafeImage } from '../components/SafeImage';
import { useI18n } from '../i18n/I18nProvider';
import { useOverlay } from '../hooks/useOverlay';
import { buildAdminOrderMessage, whatsappUrl } from '../utils/whatsapp';
import {
  formatOrderDate,
  formatOrderMoney,
  orderStatusClass,
  orderStatusLabel,
} from '../utils/orders';

export default function AdminOrdersPage() {
  const { language, localized } = useI18n();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const params = { page, limit: 20, search: deferredSearch, status, dateFrom, dateTo, sort: 'newest' };
  const orders = useQuery({
    queryKey: ['admin-orders', params],
    queryFn: () => api<PaginatedOrders>(`/api/admin/orders${queryString(params)}`),
  });

  useEffect(() => { setPage(1); }, [deferredSearch, status, dateFrom, dateTo]);

  const cards = [
    [localized('Nouvelles commandes', 'الطلبات الجديدة'), orders.data?.summary.new || 0, 'bg-blue-50 text-blue-800', ShoppingBag],
    [localized('En attente de confirmation', 'في انتظار التأكيد'), orders.data?.summary.awaitingConfirmation || 0, 'bg-orange-50 text-orange-800', CalendarDays],
    [localized('Commandes confirmées', 'الطلبات المؤكدة'), orders.data?.summary.confirmed || 0, 'bg-green-50 text-green-800', PackageCheck],
    [localized('Total des commandes', 'إجمالي الطلبات'), orders.data?.summary.total || 0, 'bg-charcoal text-white', ShoppingBag],
  ] as const;

  return <>
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="eyebrow">{localized('Suivi commercial', 'متابعة المبيعات')}</p><h1 className="section-title">{localized('Commandes', 'الطلبات')}</h1><p className="mt-3 text-sm text-muted">{localized('Suivez, confirmez et préparez chaque commande client.', 'تابعوا وأكدوا وجهزوا كل طلب.')}</p></div>
      <button className="btn-secondary shrink-0" onClick={() => orders.refetch()} disabled={orders.isFetching}><RefreshCw size={17} className={orders.isFetching ? 'animate-spin' : ''} />{localized('Actualiser', 'تحديث')}</button>
    </div>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value, color, Icon]) => <article key={label} className="card flex items-center gap-4 p-5">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${color}`}><Icon size={21} /></span>
        <div><strong className="block text-2xl" dir="ltr">{value}</strong><span className="mt-1 block text-xs font-semibold text-muted">{label}</span></div>
      </article>)}
    </section>

    <section className="card mt-6 overflow-hidden">
      <div className="grid gap-3 border-b border-line bg-cream/20 p-4 md:grid-cols-[minmax(240px,1fr)_220px_170px_170px]">
        <label className="relative"><Search className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} className="field ps-11" placeholder={localized('N°, client, téléphone, ville…', 'الرقم، العميل، الهاتف، المدينة…')} maxLength={120} /></label>
        <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{localized('Tous les statuts', 'كل الحالات')}</option>{ORDER_STATUSES.map((item) => <option key={item} value={item}>{orderStatusLabel(item, language)}</option>)}</select>
        <input aria-label={localized('Date de début', 'تاريخ البداية')} title={localized('Date de début', 'تاريخ البداية')} className="field" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input aria-label={localized('Date de fin', 'تاريخ النهاية')} title={localized('Date de fin', 'تاريخ النهاية')} className="field" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
      </div>

      {orders.isLoading ? <LoadingState text={localized('Chargement des commandes…', 'جارٍ تحميل الطلبات…')} />
        : orders.isError ? <ErrorState text={orders.error instanceof Error ? orders.error.message : localized('Impossible de charger les commandes.', 'تعذر تحميل الطلبات.')} retry={() => orders.refetch()} />
          : !orders.data?.items.length ? <EmptyState text={localized('Aucune commande ne correspond à ces critères.', 'لا توجد طلبات مطابقة لهذه المعايير.')} />
            : <>
              <div className="hidden overflow-x-auto xl:block">
                <table className="w-full min-w-[1080px] text-start text-sm">
                  <thead className="bg-charcoal text-[10px] uppercase tracking-[.12em] text-white/70"><tr>
                    {[localized('N° de commande', 'رقم الطلب'), localized('Date', 'التاريخ'), localized('Client', 'العميل'), localized('Téléphone', 'الهاتف'), localized('Ville', 'المدينة'), localized('Articles', 'المنتجات'), localized('Total', 'المجموع'), localized('Statut', 'الحالة'), localized('Actions', 'الإجراءات')].map((label) => <th key={label} className="px-4 py-4 text-start font-bold">{label}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-line">{orders.data.items.map((order) => <tr key={order.id} onClick={() => setSelectedId(order.id)} className="cursor-pointer transition hover:bg-cream/25">
                    <td className="whitespace-nowrap px-4 py-4 font-bold" dir="ltr">{order.orderNumber}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-muted">{formatOrderDate(order.createdAt, language)}</td>
                    <td className="max-w-44 truncate px-4 py-4 font-semibold">{order.customerName}</td>
                    <td className="whitespace-nowrap px-4 py-4" dir="ltr">{order.customerPhone}</td>
                    <td className="px-4 py-4">{order.city}</td>
                    <td className="px-4 py-4 text-center" dir="ltr">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-bold" dir="ltr">{formatOrderMoney(order.total, order.currency)}</td>
                    <td className="px-4 py-4"><OrderStatusBadge status={order.status} /></td>
                    <td className="px-4 py-4"><div className="flex gap-2" onClick={(event) => event.stopPropagation()}><button className="icon-btn !size-9" onClick={() => setSelectedId(order.id)} aria-label={localized('Voir', 'عرض')}><Eye size={16} /></button><a className="icon-btn !size-9 !border-green-200 !bg-green-50 !text-green-700" href={adminWhatsApp(order, language)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle size={16} /></a></div></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <div className="grid gap-3 p-3 xl:hidden">{orders.data.items.map((order) => <article key={order.id} className="rounded-2xl border border-line bg-white p-4" onClick={() => setSelectedId(order.id)}>
                <div className="flex items-start justify-between gap-3"><div><strong className="text-sm" dir="ltr">{order.orderNumber}</strong><p className="mt-1 text-xs text-muted">{formatOrderDate(order.createdAt, language)}</p></div><OrderStatusBadge status={order.status} /></div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="block text-xs text-muted">{localized('Client', 'العميل')}</span><strong>{order.customerName}</strong></div><div><span className="block text-xs text-muted">{localized('Ville', 'المدينة')}</span><strong>{order.city}</strong></div><div><span className="block text-xs text-muted">{localized('Articles', 'المنتجات')}</span><strong dir="ltr">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</strong></div><div><span className="block text-xs text-muted">{localized('Total', 'المجموع')}</span><strong dir="ltr">{formatOrderMoney(order.total, order.currency)}</strong></div></div>
                <div className="mt-4 flex gap-2 border-t border-line pt-3"><button className="btn-secondary min-h-10 flex-1 px-4 text-xs" onClick={() => setSelectedId(order.id)}><Eye size={15} />{localized('Voir', 'عرض')}</button><a onClick={(event) => event.stopPropagation()} className="btn-primary min-h-10 flex-1 px-4 text-xs !bg-[rgb(var(--color-whatsapp))]" href={adminWhatsApp(order, language)} target="_blank" rel="noreferrer"><MessageCircle size={15} />WhatsApp</a></div>
              </article>)}</div>
              <Pagination page={orders.data.page} pages={orders.data.pages} onPage={setPage} />
            </>}
    </section>

    {selectedId && <OrderDetail orderId={selectedId} onClose={() => setSelectedId('')} />}
  </>;
}

function adminWhatsApp(order: Order, language: 'fr' | 'ar'): string {
  return whatsappUrl(order.customerWhatsapp || order.customerPhone, buildAdminOrderMessage(order, language));
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { language } = useI18n();
  return <span className={`inline-flex min-h-7 items-center whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-bold ${orderStatusClass[status]}`}>{orderStatusLabel(status, language)}</span>;
}

function OrderDetail({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { language, localized } = useI18n();
  const queryClient = useQueryClient();
  const close = useCallback(onClose, [onClose]);
  useOverlay(true, close);
  const detail = useQuery({
    queryKey: ['admin-order', orderId],
    queryFn: () => api<Order>(`/api/admin/orders/${orderId}`),
  });
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { if (detail.data) setNote(detail.data.adminNote); }, [detail.data]);
  const refresh = async (order: Order) => {
    queryClient.setQueryData(['admin-order', orderId], order);
    await queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
  };
  const statusMutation = useMutation({
    mutationFn: ({ status, version }: { status: OrderStatus; version: number }) => api<Order>(`/api/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status, version }) }),
    onSuccess: async (order) => { setNotice(localized('Statut mis à jour.', 'تم تحديث الحالة.')); await refresh(order); },
    onError: (error) => setNotice(error instanceof Error ? error.message : localized('Mise à jour impossible.', 'تعذر التحديث.')),
  });
  const noteMutation = useMutation({
    mutationFn: ({ value, version }: { value: string; version: number }) => api<Order>(`/api/admin/orders/${orderId}/note`, { method: 'PATCH', body: JSON.stringify({ note: value, version }) }),
    onSuccess: async (order) => { setNotice(localized('Note enregistrée.', 'تم حفظ الملاحظة.')); await refresh(order); },
    onError: (error) => setNotice(error instanceof Error ? error.message : localized('Enregistrement impossible.', 'تعذر الحفظ.')),
  });

  const changeStatus = (next: OrderStatus) => {
    if (!detail.data || next === detail.data.status || statusMutation.isPending) return;
    if (next === 'cancelled' && !window.confirm(localized('Confirmer l’annulation de cette commande ?', 'هل تؤكدون إلغاء هذا الطلب؟'))) return;
    statusMutation.mutate({ status: next, version: detail.data.version });
  };

  return createPortal(<div className="fixed inset-0 z-[90] bg-charcoal/65 p-2 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={localized('Détail de la commande', 'تفاصيل الطلب')} onMouseDown={onClose}>
    <section className="modal-panel mx-auto flex h-full max-w-6xl flex-col" onMouseDown={(event) => event.stopPropagation()}>
      <header className="flex items-center justify-between gap-4 border-b border-line bg-white px-4 py-4 sm:px-7"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-copper">JAD HOME · {localized('Commande', 'طلب')}</p><h2 className="mt-1 font-display text-2xl font-semibold" dir="ltr">{detail.data?.orderNumber || '—'}</h2></div><button className="icon-btn" onClick={onClose} aria-label={localized('Fermer', 'إغلاق')}><X /></button></header>
      <div className="flex-1 overflow-y-auto bg-ivory p-4 sm:p-7">
        {detail.isLoading ? <LoadingState text={localized('Chargement du détail…', 'جارٍ تحميل التفاصيل…')} />
          : detail.isError || !detail.data ? <ErrorState text={detail.error instanceof Error ? detail.error.message : localized('Commande introuvable.', 'الطلب غير موجود.')} retry={() => detail.refetch()} />
            : <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
              <div className="space-y-5">
                <section className="card p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{localized('Informations commande', 'معلومات الطلب')}</p><h3 className="font-display text-2xl font-semibold" dir="ltr">{detail.data.orderNumber}</h3><p className="mt-2 text-sm text-muted">{formatOrderDate(detail.data.createdAt, language)}</p></div><OrderStatusBadge status={detail.data.status} /></div><div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4"><Info label={localized('Sous-total', 'المجموع الفرعي')} value={formatOrderMoney(detail.data.subtotal, detail.data.currency)} ltr /><Info label={localized('Livraison', 'التوصيل')} value={formatOrderMoney(detail.data.deliveryFee, detail.data.currency)} ltr /><Info label={localized('Total', 'المجموع')} value={formatOrderMoney(detail.data.total, detail.data.currency)} ltr /><Info label={localized('Mise à jour', 'آخر تحديث')} value={formatOrderDate(detail.data.updatedAt, language)} /></div></section>

                <section className="card p-5 sm:p-6"><p className="eyebrow">{localized('Informations client', 'معلومات العميل')}</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Info label={localized('Nom complet', 'الاسم الكامل')} value={detail.data.customerName} /><Info label={localized('Téléphone', 'الهاتف')} value={detail.data.customerPhone} ltr /><Info label="WhatsApp" value={detail.data.customerWhatsapp || detail.data.customerPhone} ltr /><Info label={localized('E-mail', 'البريد الإلكتروني')} value={detail.data.customerEmail || '—'} ltr /><Info label={localized('Ville', 'المدينة')} value={detail.data.city} /><Info label={localized('Adresse', 'العنوان')} value={detail.data.address} /><Info label={localized('Complément', 'تكملة العنوان')} value={detail.data.additionalAddress || '—'} /><Info label={localized('Note client', 'ملاحظة العميل')} value={detail.data.customerNote || '—'} /></div></section>

                <section className="card p-5 sm:p-6"><p className="eyebrow">{localized('Produits', 'المنتجات')}</p><div className="divide-y divide-line">{detail.data.items.map((item) => <article key={`${item.productId}-${item.selectedColor}`} className="grid gap-4 py-5 sm:grid-cols-[90px_1fr_auto]"><SafeImage src={item.imageUrl} alt={language === 'ar' ? item.nameAr : item.nameFr} width="90" height="90" className="size-[90px] rounded-xl bg-cream object-cover" /><div><h4 className="font-semibold">{language === 'ar' ? item.nameAr : item.nameFr}</h4><p className="mt-1 text-xs text-muted" dir="ltr">SKU · {item.sku}</p><div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">{item.selectedColor && <span className="rounded-full bg-cream px-3 py-1">{localized('Couleur', 'اللون')} · {item.selectedColor}</span>}{item.selectedMaterial && <span className="rounded-full bg-cream px-3 py-1">{localized('Matière', 'الخامة')} · {item.selectedMaterial}</span>}{item.selectedDimensions && <span className="rounded-full bg-cream px-3 py-1">{localized('Dimensions', 'الأبعاد')} · {item.selectedDimensions}</span>}</div></div><div className="text-start sm:text-end"><p className="text-xs text-muted">{item.quantity} × <span dir="ltr">{formatOrderMoney(item.unitPrice, detail.data.currency)}</span></p><strong className="mt-1 block" dir="ltr">{formatOrderMoney(item.lineTotal, detail.data.currency)}</strong></div></article>)}</div><div className="ms-auto mt-4 max-w-sm space-y-2 border-t border-line pt-4 text-sm"><TotalLine label={localized('Sous-total', 'المجموع الفرعي')} value={formatOrderMoney(detail.data.subtotal, detail.data.currency)} /><TotalLine label={localized('Livraison', 'التوصيل')} value={formatOrderMoney(detail.data.deliveryFee, detail.data.currency)} /><TotalLine label={localized('Total général', 'المجموع الإجمالي')} value={formatOrderMoney(detail.data.total, detail.data.currency)} strong /></div></section>
              </div>

              <aside className="space-y-5">
                <section className="card p-5"><label className="label">{localized('Modifier le statut', 'تغيير الحالة')}</label><select className="field" value={detail.data.status} disabled={statusMutation.isPending} onChange={(event) => changeStatus(event.target.value as OrderStatus)}>{ORDER_STATUSES.map((status) => <option value={status} key={status}>{orderStatusLabel(status, language)}</option>)}</select>{statusMutation.isPending && <p className="mt-2 flex items-center gap-2 text-xs text-muted"><LoaderCircle className="animate-spin" size={14} />{localized('Mise à jour…', 'جارٍ التحديث…')}</p>}<a className="btn-primary mt-4 w-full !bg-[rgb(var(--color-whatsapp))]" href={adminWhatsApp(detail.data, language)} target="_blank" rel="noreferrer"><MessageCircle size={17} />WhatsApp</a></section>
                <section className="card p-5"><label className="label">{localized('Note administrateur', 'ملاحظة الإدارة')}</label><textarea className="field min-h-32 py-3" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} placeholder={localized('Visible uniquement par l’administration…', 'مرئية للإدارة فقط…')} /><button className="btn-secondary mt-3 w-full" disabled={noteMutation.isPending || note === detail.data.adminNote} onClick={() => noteMutation.mutate({ value: note, version: detail.data!.version })}>{noteMutation.isPending ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}{localized('Enregistrer la note', 'حفظ الملاحظة')}</button></section>
                <section className="card p-5"><p className="eyebrow">{localized('Historique des statuts', 'سجل الحالات')}</p><ol className="space-y-4">{[...detail.data.statusHistory].reverse().map((event, index) => <li key={`${event.changedAt}-${index}`} className="relative border-s border-line ps-4"><span className="absolute -start-1.5 top-1 size-3 rounded-full border-2 border-white bg-gold" /><strong className="block text-sm">{orderStatusLabel(event.newStatus, language)}</strong><span className="mt-1 block text-xs text-muted">{formatOrderDate(event.changedAt, language)} · {event.changedBy}</span></li>)}</ol></section>
                {notice && <div role="status" className={/impossible|erreur|تعذر/i.test(notice) ? 'alert-error' : 'alert-success'}>{notice}</div>}
              </aside>
            </div>}
      </div>
    </section>
  </div>, document.body);
}

function Info({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return <div><span className="block text-xs text-muted">{label}</span><strong className="mt-1 block break-words text-sm" dir={ltr ? 'ltr' : undefined}>{value}</strong></div>;
}

function TotalLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 ${strong ? 'border-t border-line pt-3 text-lg' : ''}`}><span>{label}</span><strong dir="ltr">{value}</strong></div>;
}

function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  const { localized } = useI18n();
  return <div className="flex items-center justify-between border-t border-line p-4"><button className="btn-secondary min-h-10 px-4 text-xs" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="rtl-flip" size={16} />{localized('Précédent', 'السابق')}</button><span className="text-xs font-semibold text-muted" dir="ltr">{page} / {pages}</span><button className="btn-secondary min-h-10 px-4 text-xs" disabled={page >= pages} onClick={() => onPage(page + 1)}>{localized('Suivant', 'التالي')}<ChevronRight className="rtl-flip" size={16} /></button></div>;
}

function LoadingState({ text }: { text: string }) {
  return <div className="grid min-h-72 place-items-center text-center text-muted"><div><LoaderCircle className="mx-auto animate-spin" size={32} /><p className="mt-3 text-sm">{text}</p></div></div>;
}

function ErrorState({ text, retry }: { text: string; retry: () => void }) {
  const { localized } = useI18n();
  return <div className="grid min-h-72 place-items-center p-6 text-center"><div><CircleAlert className="mx-auto text-red-600" size={36} /><p className="mt-3 max-w-md text-sm text-red-800">{text}</p><button className="btn-secondary mt-5" onClick={retry}><RefreshCw size={16} />{localized('Réessayer', 'إعادة المحاولة')}</button></div></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="grid min-h-72 place-items-center p-6 text-center"><div><ShoppingBag className="mx-auto text-taupe" size={42} /><p className="mt-4 text-sm text-muted">{text}</p></div></div>;
}
