import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { CheckCircle2, ExternalLink, LoaderCircle, MessageCircle, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  checkoutSchema,
  type CartItem,
  type CheckoutInput,
  type OrderCreationResult,
  type Settings,
} from '@jad-home/shared';
import { api } from '../services/api';
import { useCartStore } from '../store/cartStore';
import { cartSubtotal, formatPrice } from '../utils/cart';
import { buildSavedOrderMessage, whatsappUrl } from '../utils/whatsapp';
import { useSeo } from '../hooks/useSeo';
import { SafeImage } from '../components/SafeImage';
import { useI18n } from '../i18n/I18nProvider';

type Confirmation = {
  order: OrderCreationResult;
  whatsapp: string;
  customerName: string;
};

export default function CheckoutPage() {
  useSeo('Finaliser la commande', 'Finalisez votre commande JAD HOME via WhatsApp.');
  const { language, localized } = useI18n();
  const cart = useCartStore();
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const requestId = useRef('');
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<Settings>('/api/settings/public'),
  });
  const validateCart = useMutation({
    mutationFn: (items: CartItem[]) => api<CartItem[]>('/api/cart/validate', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
    onSuccess: (items) => cart.replace(items),
  });

  useEffect(() => {
    if (cart.items.length) validateCart.mutate(cart.items);
    // Validation once on entry; the order endpoint repeats authoritative validation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<any>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      whatsapp: '',
      email: '',
      additionalAddress: '',
      note: '',
      acceptTerms: false,
    },
  });

  const submit = handleSubmit(async (rawValues) => {
    const values = rawValues as CheckoutInput;
    setNotice('');
    if (!cart.items.length) {
      setNotice(localized('Votre panier est vide.', 'سلتكم فارغة.'));
      return;
    }
    requestId.current ||= crypto.randomUUID();
    try {
      const order = await api<OrderCreationResult>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          clientRequestId: requestId.current,
          customerName: values.fullName,
          customerPhone: values.phone,
          customerWhatsapp: values.whatsapp,
          customerEmail: values.email,
          city: values.city,
          address: values.address,
          additionalAddress: values.additionalAddress,
          customerNote: values.note,
          language,
          items: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            selectedColor: item.color || '',
            selectedMaterial: item.material || '',
            selectedDimensions: item.dimensions || '',
          })),
        }),
      });
      const message = buildSavedOrderMessage(order, {
        fullName: values.fullName,
        phone: values.phone,
        city: values.city,
        address: values.address,
        additionalAddress: values.additionalAddress,
        note: values.note,
      });
      const number = settings.data?.whatsapp_number;
      if (!number) throw new Error('Le numéro WhatsApp BELGA WOOD n’est pas encore configuré.');
      const url = whatsappUrl(number, message);
      setConfirmation({ order, whatsapp: url, customerName: values.fullName });
      cart.clear();
    } catch (error) {
      setNotice(error instanceof Error
        ? error.message
        : localized('Impossible d’enregistrer la commande.', 'تعذر تسجيل الطلب.'));
    }
  });

  const openWhatsApp = () => {
    if (!confirmation) return;
    window.open(confirmation.whatsapp, '_blank', 'noopener,noreferrer');
  };

  const summaryItems = confirmation
    ? confirmation.order.items.map((item) => ({
      key: `${item.productId}-${item.selectedColor}`,
      name: language === 'ar' ? item.nameAr : item.nameFr,
      image: item.imageUrl,
      quantity: item.quantity,
      color: item.selectedColor,
      lineTotal: item.lineTotal,
    }))
    : cart.items.map((item) => ({
      key: `${item.productId}-${item.color}`,
      name: item.name,
      image: item.image,
      quantity: item.quantity,
      color: item.color || '',
      lineTotal: item.price * item.quantity,
    }));
  const summarySubtotal = confirmation?.order.subtotal ?? cartSubtotal(cart.items);

  if (!confirmation && !cart.items.length) {
    return <div className="container-page py-24 text-center">
      <h1 className="section-title mx-auto">{localized('Votre panier est vide', 'سلتك فارغة')}</h1>
      <Link to="/catalogue" className="btn-primary mt-8">{localized('Découvrir les produits', 'اكتشف المنتجات')}</Link>
    </div>;
  }

  return <div className="container-page py-10 sm:py-16">
    <nav className="breadcrumb mb-6"><Link to="/">Accueil</Link><span>/</span><Link to="/panier">{localized('Panier', 'السلة')}</Link><span>/</span><span>{localized('Commande', 'الطلب')}</span></nav>
    <p className="eyebrow">{localized('Commande sécurisée', 'طلب آمن')}</p>
    <h1 className="display-title">{localized('Finaliser votre commande', 'إتمام طلبكم')}</h1>
    <p className="mt-5 max-w-2xl leading-7 text-muted">{localized(
      'Votre commande est enregistrée avant la confirmation finale sur WhatsApp.',
      'يتم تسجيل طلبكم قبل التأكيد النهائي عبر واتساب.',
    )}</p>

    <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_420px] xl:gap-14">
      <form onSubmit={submit} className="card p-5 sm:p-8">
        <div className="mb-7 border-b border-line pb-5">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-copper">01 · {localized('Coordonnées', 'معلومات التواصل')}</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">{localized('Informations de livraison', 'معلومات التوصيل')}</h2>
        </div>
        <fieldset disabled={Boolean(confirmation)} className={confirmation ? 'opacity-65' : ''}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={localized('Nom complet', 'الاسم الكامل')} error={errors.fullName?.message}><input className="field" {...register('fullName')} autoComplete="name" maxLength={120} /></Field>
            <Field label={localized('Téléphone', 'الهاتف')} error={errors.phone?.message}><input className="field" {...register('phone')} placeholder="06 00 00 00 00" inputMode="tel" autoComplete="tel" maxLength={24} /></Field>
            <Field label={localized('WhatsApp si différent', 'واتساب إذا كان مختلفاً')} error={errors.whatsapp?.message}><input className="field" {...register('whatsapp')} inputMode="tel" maxLength={24} /></Field>
            <Field label={localized('E-mail (facultatif)', 'البريد الإلكتروني (اختياري)')} error={errors.email?.message}><input className="field" type="email" {...register('email')} autoComplete="email" maxLength={160} /></Field>
            <Field label={localized('Ville', 'المدينة')} error={errors.city?.message}><input className="field" {...register('city')} autoComplete="address-level2" maxLength={100} /></Field>
            <div className="sm:col-span-2"><Field label={localized('Adresse complète', 'العنوان الكامل')} error={errors.address?.message}><textarea className="field min-h-28 py-3" {...register('address')} autoComplete="street-address" maxLength={500} /></Field></div>
            <div className="sm:col-span-2"><Field label={localized('Complément d’adresse (facultatif)', 'تكملة العنوان (اختياري)')} error={errors.additionalAddress?.message}><input className="field" {...register('additionalAddress')} maxLength={300} /></Field></div>
            <div className="sm:col-span-2"><Field label={localized('Note (facultatif)', 'ملاحظة (اختيارية)')} error={errors.note?.message}><textarea className="field min-h-24 py-3" {...register('note')} maxLength={1000} /></Field></div>
          </div>
          <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm leading-6">
            <input type="checkbox" {...register('acceptTerms')} className="mt-1 size-5 accent-charcoal" />
            <span>{localized('J’accepte les', 'أوافق على')} <Link className="underline" to="/conditions">{localized('conditions générales', 'الشروط العامة')}</Link> {localized('et confirme l’exactitude de mes informations.', 'وأؤكد صحة معلوماتي.')}</span>
          </label>
          {errors.acceptTerms && <p className="mt-1 text-xs text-red-600">{String(errors.acceptTerms.message || localized('Acceptation requise.', 'الموافقة مطلوبة.'))}</p>}
        </fieldset>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button type="submit" disabled={isSubmitting || validateCart.isPending || Boolean(confirmation)} className="btn-primary min-h-14 w-full">
            {isSubmitting ? <LoaderCircle className="animate-spin" /> : confirmation ? <CheckCircle2 /> : <ShoppingBag />}
            {isSubmitting ? localized('Enregistrement…', 'جارٍ التسجيل…') : confirmation ? localized('Commande enregistrée', 'تم تسجيل الطلب') : localized('Commander', 'تأكيد الطلب')}
          </button>
          <button type="button" onClick={openWhatsApp} disabled={!confirmation} className="btn-primary min-h-14 w-full !bg-[rgb(var(--color-whatsapp))]">
            <MessageCircle />
            {localized('Continuer sur WhatsApp', 'المتابعة عبر واتساب')}
            <ExternalLink size={16} />
          </button>
        </div>
        <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-muted"><ShieldCheck size={14} />{localized('Aucun paiement n’est réalisé sur ce site.', 'لا يتم أي دفع على هذا الموقع.')}</p>
        {confirmation && <div role="status" className="alert-success mt-5">
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 shrink-0" size={20} /><div><strong>{localized('Votre commande a bien été enregistrée.', 'تم تسجيل طلبكم بنجاح.')}</strong><p className="mt-2 text-sm leading-6">{localized('Merci pour votre confiance. Notre équipe vous contactera dans les plus brefs délais via WhatsApp afin de confirmer votre commande et d’organiser la livraison.', 'شكراً لثقتكم. سيتواصل معكم فريقنا في أقرب وقت عبر واتساب لتأكيد طلبكم وتنظيم التوصيل.')}</p></div></div>
        </div>}
        {notice && <div role="alert" className="alert-error mt-5">{notice}</div>}
      </form>

      <aside className="surface-soft h-fit p-6 lg:sticky lg:top-36">
        <p className="eyebrow">02 · {localized('Récapitulatif', 'الملخص')}</p>
        <h2 className="font-display text-3xl font-semibold">{localized('Votre commande', 'طلبكم')}</h2>
        <div className="mt-5 divide-y divide-line">{summaryItems.map((item) => <div className="flex gap-3 py-4" key={item.key}>
          <SafeImage src={item.image} alt={item.name} width="72" height="76" className="h-[76px] w-[72px] rounded-lg bg-cream object-cover" />
          <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-muted">{localized('Qté', 'الكمية')} {item.quantity}{item.color ? ` · ${item.color}` : ''}</p></div>
          <strong className="text-sm" dir="ltr">{formatPrice(item.lineTotal)}</strong>
        </div>)}</div>
        <div className="mt-5 flex justify-between border-t border-line pt-5 text-xl font-bold"><span>{localized('Sous-total', 'المجموع الفرعي')}</span><span dir="ltr">{formatPrice(summarySubtotal)}</span></div>
        {confirmation && <div className="mt-3 flex justify-between text-sm"><span>{localized('Total enregistré', 'المجموع المسجل')}</span><strong dir="ltr">{formatPrice(confirmation.order.total)}</strong></div>}
        <p className="mt-4 text-xs leading-5 text-muted">{localized('Les prix, le stock et la livraison sont recalculés par le serveur au moment de la commande.', 'يُعاد احتساب الأسعار والمخزون والتوصيل على الخادم عند الطلب.')}</p>
      </aside>
    </div>
  </div>;
}

function Field({ label, error, children }: { label: string; error?: unknown; children: React.ReactNode }) {
  return <label><span className="label">{label}</span>{children}{typeof error === 'string' && error && <span className="mt-1 block text-xs text-red-600">{error}</span>}</label>;
}
