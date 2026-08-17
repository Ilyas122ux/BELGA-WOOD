export type Row = Record<string, string | number | boolean | null>;
export const SHEETS = {
  Products: [
    "id", "name", "slug", "categoryId", "shortDescription", "description",
    "price", "oldPrice", "priceType", "currency", "coverImageUrl",
    "coverImagePublicId", "featured", "active", "displayOrder", "createdAt", "updatedAt",
  ],
  ProductImages: [
    "id", "productId", "imageUrl", "imagePublicId", "altText", "displayOrder", "createdAt",
  ],
  Projects: [
    "id",
    "title",
    "slug",
    "categoryId",
    "shortDescription",
    "description",
    "location",
    "coverImageUrl",
    "coverImagePublicId",
    "featured",
    "published",
    "displayOrder",
    "createdAt",
    "updatedAt",
  ],
  Categories: [
    "id",
    "name",
    "slug",
    "description",
    "imageUrl",
    "imagePublicId",
    "displayOrder",
    "active",
    "createdAt",
    "updatedAt",
  ],
  Services: [
    "id",
    "title",
    "slug",
    "shortDescription",
    "description",
    "imageUrl",
    "imagePublicId",
    "featured",
    "active",
    "displayOrder",
    "createdAt",
    "updatedAt",
  ],
  ProjectImages: [
    "id",
    "projectId",
    "imageUrl",
    "imagePublicId",
    "altText",
    "displayOrder",
    "createdAt",
  ],
  Testimonials: [
    "id",
    "clientName",
    "clientLocation",
    "content",
    "rating",
    "published",
    "displayOrder",
    "createdAt",
    "updatedAt",
  ],
  QuoteRequests: [
    "id",
    "fullName",
    "phone",
    "email",
    "city",
    "serviceId",
    "projectType",
    "budgetRange",
    "message",
    "status",
    "clientRequestId",
    "createdAt",
    "updatedAt",
  ],
  Settings: ["key", "value"],
} as const;
export type SheetName = keyof typeof SHEETS;
export const quoteStatuses = [
  "new",
  "contacted",
  "qualified",
  "in_progress",
  "completed",
  "archived",
];
export interface BelgaRepository {
  getSpreadsheetId(): string;
  initialize(): Promise<void>;
  list(sheet: SheetName): Promise<Row[]>;
  settings(): Promise<Record<string, string>>;
  createRow(sheet: Exclude<SheetName, "Settings">, input: Row): Promise<Row>;
  updateRow(
    sheet: Exclude<SheetName, "Settings">,
    id: string,
    input: Row,
  ): Promise<Row>;
  deleteRow(sheet: Exclude<SheetName, "Settings">, id: string): Promise<void>;
  updateSettings(
    values: Record<string, string>,
  ): Promise<Record<string, string>>;
  publicData(): Promise<{
    categories: Row[];
    products: (Row & { images: Row[] })[];
    services: Row[];
    projects: (Row & { images: Row[] })[];
    testimonials: Row[];
    settings: Record<string, string>;
  }>;
}
