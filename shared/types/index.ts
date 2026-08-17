export type Language = 'fr' | 'ar';

export interface CloudinaryImage {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  altFr: string;
  altAr: string;
  displayOrder: number;
}

export type ProductImage = string | CloudinaryImage;

export interface Product {
  id: string;
  slug: string;
  name_fr: string;
  name_ar: string;
  short_description_fr: string;
  short_description_ar: string;
  description_fr: string;
  description_ar: string;
  category_id: string;
  price: number;
  old_price?: number | null;
  currency: string;
  stock_quantity: number;
  stock_status: 'in_stock' | 'out_of_stock';
  featured: boolean;
  new_arrival: boolean;
  promotion: boolean;
  active: boolean;
  colors: string[];
  dimensions: string;
  materials: string[];
  images: ProductImage[];
  created_at: string;
  updated_at: string;
  version?: number;
  category?: Category;
}

export interface Category {
  id: string;
  slug: string;
  name_fr: string;
  name_ar: string;
  description_fr: string;
  description_ar: string;
  image: string;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  version?: number;
  product_count?: number;
}

export interface Settings {
  [key: string]: string;
}

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  color?: string;
  material?: string;
  dimensions?: string;
  maxStock: number;
}

export function imageUrl(image: ProductImage | undefined): string {
  if (!image) return '';
  return typeof image === 'string' ? image : image.secureUrl;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const ORDER_STATUSES = [
  'new',
  'awaiting_confirmation',
  'confirmed',
  'preparing',
  'ready',
  'delivered',
  'cancelled',
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

export interface OrderItemSnapshot {
  productId: string;
  sku: string;
  slug: string;
  nameFr: string;
  nameAr: string;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  selectedColor: string;
  selectedMaterial: string;
  selectedDimensions: string;
}

export interface OrderStatusHistoryEntry {
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  changedAt: string;
  changedBy: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  clientRequestId: string;
  customerName: string;
  customerPhone: string;
  customerWhatsapp: string;
  customerEmail: string;
  city: string;
  address: string;
  additionalAddress: string;
  customerNote: string;
  items: OrderItemSnapshot[];
  currency: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  adminNote: string;
  statusHistory: OrderStatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  confirmedAt: string;
  cancelledAt: string;
  version: number;
}

export interface OrderCreationResult {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  items: OrderItemSnapshot[];
  createdAt: string;
  duplicate: boolean;
}

export interface OrderSummary {
  new: number;
  awaitingConfirmation: number;
  confirmed: number;
  total: number;
}

export interface PaginatedOrders {
  items: Order[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  summary: OrderSummary;
}
