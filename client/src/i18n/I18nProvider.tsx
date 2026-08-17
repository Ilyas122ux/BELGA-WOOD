import { createContext, useContext, useLayoutEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { Language } from '@jad-home/shared';

const messages = {
  fr: {
    home: 'Accueil', catalogue: 'Catalogue', new: 'Nouveautés', promotions: 'Promotions', about: 'À propos', contact: 'Contact',
    search: 'Rechercher un produit…', cart: 'Panier', discover: 'Découvrir la collection', add: 'Ajouter au panier', quick: 'Aperçu rapide',
    delivery: 'Livraison partout au Maroc · Paiement à la livraison', products: 'produits', empty: 'Aucun produit ne correspond à votre recherche.',
    filters: 'Filtres', reset: 'Réinitialiser', checkout: 'Finaliser la commande', continue: 'Continuer mes achats', total: 'Total',
  },
  ar: {
    home: 'الرئيسية', catalogue: 'الكتالوج', new: 'وصل حديثاً', promotions: 'العروض', about: 'من نحن', contact: 'اتصل بنا',
    search: 'ابحث عن منتج…', cart: 'السلة', discover: 'اكتشف المجموعة', add: 'أضف إلى السلة', quick: 'عرض سريع',
    delivery: 'التوصيل في جميع أنحاء المغرب · الدفع عند الاستلام', products: 'منتجات', empty: 'لا توجد منتجات مطابقة لبحثك.',
    filters: 'التصفية', reset: 'إعادة ضبط', checkout: 'إتمام الطلب', continue: 'متابعة التسوق', total: 'المجموع',
  },
} as const;

type MessageKey = keyof typeof messages.fr;
type I18nValue = { language: Language; setLanguage: (language: Language) => void; t: (key: MessageKey) => string; localized: (fr: string, ar: string) => string };
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>(() => localStorage.getItem('jad_home_language') === 'ar' ? 'ar' : 'fr');
  const setLanguage = (next: Language) => { setLanguageState(next); localStorage.setItem('jad_home_language', next); };
  useLayoutEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.body.dataset.language = language;
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (key: MessageKey) => messages[language][key], localized: (fr: string, ar: string) => language === 'ar' ? ar : fr }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n doit être utilisé dans I18nProvider');
  return context;
}
