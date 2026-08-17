import { beforeEach, describe, expect, it } from 'vitest';
import type { Order, Product } from '@jad-home/shared';
import { checkoutSchema } from '@jad-home/shared';
import { useCartStore } from '../store/cartStore';
import { CART_STORAGE_KEY, cartCount, cartSubtotal, clampQuantity } from '../utils/cart';
import { buildAdminOrderMessage, buildOrderMessage, normalizeWhatsAppNumber, whatsappUrl } from '../utils/whatsapp';

const product: Product = {id:'p1',slug:'canape-test',name_fr:'Canapé Test',name_ar:'اختبار',short_description_fr:'',short_description_ar:'',description_fr:'',description_ar:'',category_id:'c1',price:1250,old_price:null,currency:'MAD',stock_quantity:3,stock_status:'in_stock',featured:false,new_arrival:false,promotion:false,active:true,colors:['Ivoire'],dimensions:'',materials:[],images:['/image.webp'],created_at:'',updated_at:''};

beforeEach(()=>{localStorage.clear();useCartStore.setState({items:[],open:false});});

describe('Panier persistant',()=>{
  it('calcule quantité et sous-total',()=>{const items=[{productId:'1',slug:'a',name:'A',image:'',price:100,quantity:2,maxStock:5},{productId:'2',slug:'b',name:'B',image:'',price:75,quantity:1,maxStock:2}];expect(cartCount(items)).toBe(3);expect(cartSubtotal(items)).toBe(275);expect(clampQuantity(9,4)).toBe(4);});
  it('ajoute, fusionne et persiste une ligne',()=>{useCartStore.getState().addProduct(product,1,'Ivoire');useCartStore.getState().addProduct(product,2,'Ivoire');expect(useCartStore.getState().items[0].quantity).toBe(3);expect(localStorage.getItem(CART_STORAGE_KEY)).toContain('canape-test');});
});

describe('Commande',()=>{
  it('valide le formulaire client',()=>{const valid=checkoutSchema.safeParse({fullName:'Sara Test',phone:'0612345678',city:'Rabat',address:'10 rue Exemple Rabat',delivery:'Livraison standard',note:'',acceptTerms:true});expect(valid.success).toBe(true);expect(checkoutSchema.safeParse({fullName:'A',phone:'123',city:'',address:'x',acceptTerms:false}).success).toBe(false);});
  it('inclut articles, quantité et prix dans le message WhatsApp',()=>{const message=buildOrderMessage({reference:'JH-123',fullName:'Sara',phone:'0612345678',city:'Rabat',address:'Adresse complète'},[{productId:'p1',slug:'x',name:'Canapé Test',image:'',price:1250,quantity:2,maxStock:3}]);expect(message).toContain('JH-123');expect(message).toContain('Quantité : 2');expect(message).toContain('2 500,00 DH');});
  it('normalise le numéro marocain et génère le lien WhatsApp administrateur',()=>{
    const now=new Date().toISOString();
    const order:Order={id:'o1',orderNumber:'JH-20260727-ABC12345',clientRequestId:'r1',customerName:'Sara',customerPhone:'0612345678',customerWhatsapp:'',customerEmail:'',city:'Rabat',address:'Adresse',additionalAddress:'',customerNote:'',items:[],currency:'MAD',subtotal:100,total:100,deliveryFee:0,status:'new',adminNote:'',statusHistory:[{previousStatus:null,newStatus:'new',changedAt:now,changedBy:'customer:fr'}],createdAt:now,updatedAt:now,confirmedAt:'',cancelledAt:'',version:1};
    expect(normalizeWhatsAppNumber('06 12 34 56 78')).toBe('212612345678');
    const message=buildAdminOrderMessage(order,'fr');
    expect(message).toContain(order.orderNumber);
    expect(message).toContain('100,00 MAD');
    expect(whatsappUrl(order.customerPhone,message)).toMatch(/^https:\/\/wa\.me\/212612345678\?text=/);
  });
});
