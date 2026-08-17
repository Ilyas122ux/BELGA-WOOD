export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  displayOrder: number;
  active: boolean;
  projectCount?: number;
};
export type Service = {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  imageUrl: string;
  icon: string;
  displayOrder: number;
  featured: boolean;
  active: boolean;
};
export type ProjectImage = {
  id: string;
  projectId: string;
  imageUrl: string;
  altText: string;
  displayOrder: number;
};
export type Project = {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  location: string;
  coverImageUrl: string;
  featured: boolean;
  published: boolean;
  images: ProjectImage[];
};
export type ProductImage = { id: string; productId: string; imageUrl: string; imagePublicId: string; altText: string; displayOrder: number };
export type Product = {
  id: string; name: string; slug: string; categoryId: string;
  shortDescription: string; description: string; price: number; oldPrice: number;
  priceType: "fixed" | "starting_from" | "on_request"; currency: string;
  coverImageUrl: string; coverImagePublicId: string; featured: boolean; active: boolean;
  displayOrder: number; createdAt: string; updatedAt: string; images: ProductImage[];
};
export type Testimonial = {
  id: string;
  clientName: string;
  clientLocation: string;
  content: string;
  rating: number | null;
  published: boolean;
  displayOrder: number;
};
export const QUOTE_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "in_progress",
  "completed",
  "archived",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export type QuoteRequest = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  serviceId: string | null;
  projectType: string;
  budgetRange: string;
  city: string;
  message: string;
  status: QuoteStatus;
  createdAt: string;
};
export type SiteSettings = {
  siteUrl: string;
  companyName: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutText: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  googleMapsUrl: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  workingHours: string;
  seoTitle: string;
  seoDescription: string;
};

export const settings: SiteSettings = {
  siteUrl: "",
  companyName: "BELGA WOOD",
  heroTitle: "L’élégance du sur-mesure",
  heroSubtitle:
    "Cuisines, dressings, placards et aménagements intérieurs pensés pour votre espace et réalisés avec précision à Casablanca.",
  aboutTitle: "Le détail donne sa valeur à l’espace",
  aboutText:
    "BELGA WOOD imagine et réalise des agencements intérieurs où usage, proportions et matière trouvent leur juste équilibre.",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  city: "Casablanca",
  googleMapsUrl: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  workingHours: "",
  seoTitle: "BELGA WOOD — Menuiserie et aménagement sur mesure à Casablanca",
  seoDescription:
    "Cuisines, dressings, placards et mobilier sur mesure à Casablanca.",
};
