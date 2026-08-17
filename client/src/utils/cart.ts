import type { CartItem } from '@jad-home/shared';

export const CART_STORAGE_KEY = 'jad_home_cart_v1';
export const cartSubtotal = (items: CartItem[]) => items.reduce((sum, item) => sum + item.price * item.quantity, 0);
export const cartCount = (items: CartItem[]) => items.reduce((sum, item) => sum + item.quantity, 0);
export const clampQuantity = (quantity: number, maxStock: number) => Math.max(1, Math.min(Math.floor(quantity), maxStock));
export const orderReference = () => `JH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
export const formatPrice = (value: number) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value).replace(/[\u00a0\u202f]/g, ' ')} DH`;
