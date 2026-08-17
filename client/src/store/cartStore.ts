import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { imageUrl, type CartItem, type Product } from '@jad-home/shared';
import { CART_STORAGE_KEY, clampQuantity } from '../utils/cart';

type CartState = {
  items: CartItem[]; open: boolean;
  setOpen: (open: boolean) => void;
  addProduct: (product: Product, quantity?: number, color?: string) => void;
  updateQuantity: (productId: string, quantity: number, color?: string) => void;
  removeItem: (productId: string, color?: string) => void;
  clear: () => void;
  replace: (items: CartItem[]) => void;
};

const sameLine = (item: CartItem, productId: string, color?: string) => item.productId === productId && item.color === color;
const cleanItem = (item: CartItem): CartItem => ({
  productId: item.productId, slug: item.slug, name: item.name, image: item.image,
  price: item.price, quantity: item.quantity, color: item.color, material: item.material,
  dimensions: item.dimensions, maxStock: item.maxStock,
});

export const useCartStore = create<CartState>()(persist((set) => ({
  items: [], open: false,
  setOpen: (open) => set({ open }),
  addProduct: (product, quantity = 1, color) => set((state) => {
    if (!product.active || product.stock_quantity < 1) return state;
    const found = state.items.find((item) => sameLine(item, product.id, color));
    const items = found
      ? state.items.map((item) => sameLine(item, product.id, color) ? { ...item, quantity: clampQuantity(item.quantity + quantity, product.stock_quantity), price: product.price } : item)
      : [...state.items, { productId: product.id, slug: product.slug, name: product.name_fr, image: imageUrl(product.images[0]), price: product.price, quantity: clampQuantity(quantity, product.stock_quantity), color, maxStock: product.stock_quantity }];
    return { items, open: true };
  }),
  updateQuantity: (productId, quantity, color) => set((state) => ({ items: state.items.map((item) => sameLine(item, productId, color) ? { ...item, quantity: clampQuantity(quantity, item.maxStock) } : item) })),
  removeItem: (productId, color) => set((state) => ({ items: state.items.filter((item) => !sameLine(item, productId, color)) })),
  clear: () => set({ items: [] }),
  replace: (items) => set({ items }),
}), {
  name: CART_STORAGE_KEY,
  version: 2,
  migrate: (persisted) => {
    const state = persisted as Partial<CartState>;
    return { ...state, items: Array.isArray(state.items) ? state.items.map(cleanItem) : [] } as CartState;
  },
  partialize: (state) => ({ items: state.items.map(cleanItem) }),
}));
