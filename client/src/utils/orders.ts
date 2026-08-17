import type { Language, OrderStatus } from '@jad-home/shared';

const labels: Record<Language, Record<OrderStatus, string>> = {
  fr: {
    new: 'Nouvelle',
    awaiting_confirmation: 'En attente de confirmation',
    confirmed: 'Confirmée',
    preparing: 'En préparation',
    ready: 'Prête',
    delivered: 'Livrée',
    cancelled: 'Annulée',
  },
  ar: {
    new: 'جديدة',
    awaiting_confirmation: 'في انتظار التأكيد',
    confirmed: 'مؤكدة',
    preparing: 'قيد التحضير',
    ready: 'جاهزة',
    delivered: 'تم التسليم',
    cancelled: 'ملغاة',
  },
};

export const orderStatusLabel = (status: OrderStatus, language: Language) => labels[language][status];

export const orderStatusClass: Record<OrderStatus, string> = {
  new: 'border-blue-200 bg-blue-50 text-blue-800',
  awaiting_confirmation: 'border-orange-200 bg-orange-50 text-orange-800',
  confirmed: 'border-green-200 bg-green-50 text-green-800',
  preparing: 'border-violet-200 bg-violet-50 text-violet-800',
  ready: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  delivered: 'border-emerald-700/20 bg-emerald-800 text-white',
  cancelled: 'border-red-200 bg-red-50 text-red-800',
};

export function formatOrderDate(value: string, language: Language, withTime = true): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-MA' : 'fr-MA', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' as const } : {}),
  }).format(date);
}

export function formatOrderMoney(value: number, currency = 'MAD'): string {
  return `${new Intl.NumberFormat('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`;
}
