import type { CartItem } from '@jad-home/shared';

export type OrderDetails = {
  reference: string; fullName: string; phone: string; city: string; address: string; note?: string;
};

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value).replace(/[\u00a0\u202f]/g, ' ');
}

export function buildWhatsAppMessage(details: OrderDetails, items: CartItem[]): string {
  const lines = items.map((item, index) => [
    `${index + 1}. ${item.name}`,
    `Couleur : ${item.color || 'Non précisée'}`,
    `Quantité : ${item.quantity}`,
    `Prix unitaire : ${formatMoney(item.price)} DH`,
    `Sous-total : ${formatMoney(item.price * item.quantity)} DH`,
  ].join('\n')).join('\n\n');
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return [
    '🛒 Nouvelle commande — JAD HOME', '',
    `🔖 Référence : ${details.reference}`, `👤 Client : ${details.fullName}`, `📞 Téléphone : ${details.phone}`,
    `📍 Ville : ${details.city}`, `🏠 Adresse : ${details.address}`, '', '📦 Produits commandés :', '', lines, '',
    `💰 Total de la commande : ${formatMoney(total)} DH`, '', '📝 Remarque :', details.note || 'Aucune', '',
    'Merci de confirmer la disponibilité et la livraison.',
  ].join('\n');
}

export function buildWhatsAppUrl(number: string, message: string): string {
  return `https://wa.me/${number.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
}
