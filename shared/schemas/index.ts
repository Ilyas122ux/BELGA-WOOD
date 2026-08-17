import { z } from 'zod';
import { ORDER_STATUSES } from '../types/index.js';

const boolish = z.union([z.boolean(), z.enum(['true', 'false'])]).transform((value) => value === true || value === 'true');
const listish = z.union([z.array(z.string()), z.string()]).transform((value) =>
  Array.isArray(value) ? value : value.split(',').map((item) => item.trim()).filter(Boolean),
);

export const cloudinaryImageSchema = z.object({
  publicId: z.string().trim().regex(/^jad-home\/(?:products|categories|legacy-migration)\/[a-zA-Z0-9/_-]+$/),
  secureUrl: z.string().url().regex(/^https:\/\/res\.cloudinary\.com\//),
  width: z.coerce.number().int().positive().max(10_000),
  height: z.coerce.number().int().positive().max(10_000),
  format: z.enum(['jpg', 'jpeg', 'png', 'webp', 'avif']).or(z.string().regex(/^[a-z0-9]+$/)),
  bytes: z.coerce.number().int().positive().max(8 * 1024 * 1024),
  altFr: z.string().trim().max(180).default(''),
  altAr: z.string().trim().max(180).default(''),
  displayOrder: z.coerce.number().int().min(0).max(99).default(0),
});

export const imageReferenceSchema = z.union([z.string().trim().min(1), cloudinaryImageSchema]);

const imageListish = z.union([z.array(imageReferenceSchema), z.string()]).transform((value) => {
  if (Array.isArray(value)) return value;
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return z.array(imageReferenceSchema).parse(parsed);
  } catch {
    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
});

export const productSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name_fr: z.string().trim().min(2).max(160),
  name_ar: z.string().trim().min(2).max(160),
  short_description_fr: z.string().trim().max(280).default(''),
  short_description_ar: z.string().trim().max(280).default(''),
  description_fr: z.string().trim().max(5000).default(''),
  description_ar: z.string().trim().max(5000).default(''),
  category_id: z.string().trim().min(1),
  price: z.coerce.number().positive().max(10_000_000),
  old_price: z.union([z.coerce.number().positive(), z.literal(''), z.null()]).optional().transform((v) => v === '' ? null : v),
  currency: z.string().trim().default('MAD'),
  stock_quantity: z.coerce.number().int().min(0).max(1_000_000),
  featured: boolish.default(false),
  new_arrival: boolish.default(false),
  promotion: boolish.default(false),
  active: boolish.default(true),
  colors: listish.default([]),
  dimensions: z.string().trim().max(200).default(''),
  materials: listish.default([]),
  existing_images: imageListish.default([]),
  version: z.coerce.number().int().min(1).optional(),
});

export const categorySchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name_fr: z.string().trim().min(2).max(100),
  name_ar: z.string().trim().min(2).max(100),
  description_fr: z.string().trim().max(1000).default(''),
  description_ar: z.string().trim().max(1000).default(''),
  image: z.string().trim().default(''),
  display_order: z.coerce.number().int().min(0).max(999),
  active: boolish.default(true),
  version: z.coerce.number().int().min(1).optional(),
});

const phoneSchema = z.string().trim().min(8, 'Le numéro est trop court').max(24, 'Le numéro est trop long')
  .regex(/^\+?[\d\s().-]+$/, 'Format de téléphone invalide')
  .refine((value) => {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
  }, 'Format de téléphone invalide');

const optionalEmailSchema = z.string().trim().max(160).refine(
  (value) => !value || z.string().email().safeParse(value).success,
  'Adresse e-mail invalide',
);

export const checkoutSchema = z.object({
  fullName: z.string().trim().min(3, 'Le nom complet est requis').max(120),
  phone: phoneSchema,
  whatsapp: z.string().trim().max(24).refine(
    (value) => !value || phoneSchema.safeParse(value).success,
    'Format WhatsApp invalide',
  ).default(''),
  email: optionalEmailSchema.default(''),
  city: z.string().trim().min(2, 'La ville est requise').max(100),
  address: z.string().trim().min(8, 'Adresse trop courte').max(500),
  additionalAddress: z.string().trim().max(300).default(''),
  note: z.string().trim().max(1000).optional().default(''),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Vous devez accepter les conditions' }) }),
});

export const orderItemRequestSchema = z.object({
  productId: z.string().trim().min(1).max(120),
  quantity: z.coerce.number().int().min(1).max(99),
  selectedColor: z.string().trim().max(100).default(''),
  selectedMaterial: z.string().trim().max(120).default(''),
  selectedDimensions: z.string().trim().max(200).default(''),
}).strict();

export const createOrderSchema = z.object({
  clientRequestId: z.string().uuid(),
  customerName: z.string().trim().min(3).max(120),
  customerPhone: phoneSchema,
  customerWhatsapp: z.string().trim().max(24).refine(
    (value) => !value || phoneSchema.safeParse(value).success,
    'Format WhatsApp invalide',
  ).default(''),
  customerEmail: optionalEmailSchema.default(''),
  city: z.string().trim().min(2).max(100),
  address: z.string().trim().min(8).max(500),
  additionalAddress: z.string().trim().max(300).default(''),
  customerNote: z.string().trim().max(1000).default(''),
  language: z.enum(['fr', 'ar']).default('fr'),
  items: z.array(orderItemRequestSchema).min(1, 'Le panier est vide').max(50),
}).strict();

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  version: z.coerce.number().int().positive().optional(),
}).strict();

export const updateOrderNoteSchema = z.object({
  note: z.string().trim().max(2000),
  version: z.coerce.number().int().positive().optional(),
}).strict();

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export type ProductInput = z.input<typeof productSchema>;
export type CategoryInput = z.input<typeof categorySchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderItemRequest = z.infer<typeof orderItemRequestSchema>;
