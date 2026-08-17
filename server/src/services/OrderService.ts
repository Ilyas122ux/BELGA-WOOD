import type { CreateOrderInput, Order, OrderCreationResult, OrderItemSnapshot, Product } from '@jad-home/shared';
import { imageUrl } from '@jad-home/shared';
import type { CatalogueRepository } from '../repositories/CatalogueRepository.js';
import type { OrderRepository } from '../repositories/OrderRepository.js';
import { OrderRepositoryError } from '../repositories/OrderRepository.js';
import { cleanText } from '../utils/strings.js';

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function orderNumber(clientRequestId: string, createdAt: string): string {
  const date = createdAt.slice(0, 10).replaceAll('-', '');
  const suffix = clientRequestId.replaceAll('-', '').slice(0, 8).toUpperCase();
  return `JH-${date}-${suffix}`;
}

function selectedValue(value: string, available: string[], label: string): string {
  const cleaned = cleanText(value);
  if (cleaned && available.length && !available.includes(cleaned)) {
    throw new OrderRepositoryError(`${label} indisponible pour ce produit.`, 409);
  }
  return cleaned;
}

function snapshot(product: Product, input: CreateOrderInput['items'][number]): OrderItemSnapshot {
  if (!product.active) throw new OrderRepositoryError(`Le produit « ${product.name_fr} » n'est plus disponible.`, 409);
  if (product.stock_quantity < input.quantity) {
    throw new OrderRepositoryError(`Stock insuffisant pour « ${product.name_fr} ».`, 409);
  }
  if (product.price <= 0 || !Number.isFinite(product.price)) {
    throw new OrderRepositoryError(`Le prix de « ${product.name_fr} » est indisponible.`, 409);
  }
  const quantity = input.quantity;
  const unitPrice = money(product.price);
  return {
    productId: product.id,
    sku: product.id,
    slug: product.slug,
    nameFr: product.name_fr,
    nameAr: product.name_ar,
    imageUrl: imageUrl(product.images[0]),
    quantity,
    unitPrice,
    lineTotal: money(unitPrice * quantity),
    selectedColor: selectedValue(input.selectedColor, product.colors, 'Cette couleur'),
    selectedMaterial: selectedValue(input.selectedMaterial, product.materials, 'Cette matière'),
    selectedDimensions: cleanText(input.selectedDimensions || product.dimensions),
  };
}

function result(order: Order, duplicate: boolean): OrderCreationResult {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    currency: order.currency,
    items: order.items,
    createdAt: order.createdAt,
    duplicate,
  };
}

export class OrderService {
  constructor(
    private readonly catalogue: CatalogueRepository,
    private readonly orders: OrderRepository,
  ) {}

  async create(input: CreateOrderInput): Promise<OrderCreationResult> {
    const existing = await this.orders.findByClientRequestId(input.clientRequestId);
    if (existing) return result(existing, true);

    const settings = await this.catalogue.getSettings();
    const configuredCurrency = cleanText(settings.currency).toUpperCase() || 'MAD';
    if (configuredCurrency !== 'MAD') {
      throw new OrderRepositoryError('La devise de la boutique est temporairement invalide.', 503);
    }
    const deliveryFeeValue = Number(settings.delivery_fee || 0);
    const deliveryFee = money(Number.isFinite(deliveryFeeValue) && deliveryFeeValue >= 0 ? deliveryFeeValue : 0);
    const items: OrderItemSnapshot[] = [];

    for (const requested of input.items) {
      const product = await this.catalogue.getProduct(requested.productId, true);
      if (!product) throw new OrderRepositoryError('Un produit du panier est introuvable.', 409);
      if (cleanText(product.currency).toUpperCase() !== configuredCurrency) {
        throw new OrderRepositoryError(`La devise de « ${product.name_fr} » est invalide.`, 409);
      }
      items.push(snapshot(product, requested));
    }

    const subtotal = money(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const createdAt = new Date().toISOString();
    const order: Order = {
      id: input.clientRequestId,
      orderNumber: orderNumber(input.clientRequestId, createdAt),
      clientRequestId: input.clientRequestId,
      customerName: cleanText(input.customerName),
      customerPhone: cleanText(input.customerPhone),
      customerWhatsapp: cleanText(input.customerWhatsapp),
      customerEmail: cleanText(input.customerEmail),
      city: cleanText(input.city),
      address: cleanText(input.address),
      additionalAddress: cleanText(input.additionalAddress),
      customerNote: cleanText(input.customerNote),
      items,
      currency: configuredCurrency,
      subtotal,
      deliveryFee,
      total: money(subtotal + deliveryFee),
      status: 'new',
      adminNote: '',
      statusHistory: [{
        previousStatus: null,
        newStatus: 'new',
        changedAt: createdAt,
        changedBy: `customer:${input.language}`,
      }],
      createdAt,
      updatedAt: createdAt,
      confirmedAt: '',
      cancelledAt: '',
      version: 1,
    };
    const stored = await this.orders.createIfAbsent(order);
    return result(stored.order, !stored.created);
  }
}
