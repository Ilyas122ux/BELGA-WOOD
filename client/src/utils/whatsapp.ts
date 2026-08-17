import type { CartItem, Order, OrderCreationResult } from '@jad-home/shared';

type Details = { reference: string; fullName: string; phone: string; city: string; address: string; note?: string };
const money = (value: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value).replace(/[\u00a0\u202f]/g, ' ');

export function buildOrderMessage(details: Details, items: CartItem[]): string {
  const products = items.map((item,index)=>`${index+1}. ${item.name}\nCouleur : ${item.color||'Non précisée'}\nQuantité : ${item.quantity}\nPrix unitaire : ${money(item.price)} DH\nSous-total : ${money(item.price*item.quantity)} DH`).join('\n\n');
  const total = items.reduce((sum,item)=>sum+item.price*item.quantity,0);
  return `🛒 Nouvelle commande — JAD HOME\n\n🔖 Référence : ${details.reference}\n👤 Client : ${details.fullName}\n📞 Téléphone : ${details.phone}\n📍 Ville : ${details.city}\n🏠 Adresse : ${details.address}\n\n📦 Produits commandés :\n\n${products}\n\n💰 Total de la commande : ${money(total)} DH\n\n📝 Remarque :\n${details.note||'Aucune'}\n\nMerci de confirmer la disponibilité et la livraison.`;
}

export function normalizeWhatsAppNumber(number: string): string {
  let digits = number.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^0[5-7]\d{8}$/.test(digits)) digits = `212${digits.slice(1)}`;
  else if (/^[5-7]\d{8}$/.test(digits)) digits = `212${digits}`;
  return digits.slice(0, 15);
}

type SavedOrderCustomer = {
  fullName: string;
  phone: string;
  city: string;
  address: string;
  additionalAddress?: string;
  note?: string;
};

export function buildSavedOrderMessage(order: OrderCreationResult, customer: SavedOrderCustomer): string {
  const products = order.items.map((item, index) => [
    `${index + 1}. ${item.nameFr}`,
    item.selectedColor ? `Couleur : ${item.selectedColor}` : '',
    item.selectedMaterial ? `Matière : ${item.selectedMaterial}` : '',
    item.selectedDimensions ? `Dimensions : ${item.selectedDimensions}` : '',
    `Quantité : ${item.quantity}`,
    `Prix unitaire : ${money(item.unitPrice)} MAD`,
    `Sous-total : ${money(item.lineTotal)} MAD`,
  ].filter(Boolean).join('\n')).join('\n\n');
  return [
    '🛒 Nouvelle commande — JAD HOME',
    '',
    `🔖 N° de commande : ${order.orderNumber}`,
    `👤 Client : ${customer.fullName}`,
    `📞 Téléphone : ${customer.phone}`,
    `📍 Ville : ${customer.city}`,
    `🏠 Adresse : ${customer.address}${customer.additionalAddress ? ` — ${customer.additionalAddress}` : ''}`,
    '',
    '📦 Produits commandés :',
    '',
    products,
    '',
    `Sous-total : ${money(order.subtotal)} MAD`,
    `Livraison : ${money(order.deliveryFee)} MAD`,
    `💰 Total : ${money(order.total)} MAD`,
    '',
    `📝 Remarque : ${customer.note || 'Aucune'}`,
    '',
    'Merci de confirmer la disponibilité et la livraison.',
  ].join('\n');
}

export function buildAdminOrderMessage(order: Order, language: 'fr' | 'ar'): string {
  if (language === 'ar') {
    return [
      `مرحباً ${order.customerName}،`,
      '',
      `توصلنا بطلبكم لدى JAD HOME رقم ${order.orderNumber} بمبلغ إجمالي قدره ${money(order.total)} درهم.`,
      '',
      'نتواصل معكم لتأكيد المنتجات والعنوان والتوصيل.',
      '',
      'شكراً لثقتكم.',
    ].join('\n');
  }
  return [
    `Bonjour ${order.customerName},`,
    '',
    `Nous avons bien reçu votre commande JAD HOME n° ${order.orderNumber} d’un montant total de ${money(order.total)} MAD.`,
    '',
    'Nous vous contactons afin de confirmer les produits, l’adresse et la livraison.',
    '',
    'Merci pour votre confiance.',
  ].join('\n');
}

export const whatsappUrl = (number:string,message:string)=>`https://wa.me/${normalizeWhatsAppNumber(number)}?text=${encodeURIComponent(message)}`;
