import crypto from "node:crypto";
import { google, type sheets_v4 } from "googleapis";
import { env } from "../config/env.js";
import {
  SHEETS,
  type BelgaRepository,
  type Row,
  type SheetName,
} from "./types.js";
const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const bool = (v: unknown) =>
  v === true ||
  v === 1 ||
  ["true", "1", "yes", "oui"].includes(String(v).trim().toLowerCase());
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const text = (v: unknown) => (v == null ? "" : String(v).trim());
const booleanFields = new Set(["featured", "published", "active"]);
const numberFields = new Set(["displayOrder", "rating", "price", "oldPrice"]);
function normalized(sheet: SheetName, row: Row): Row {
  const out: Row = {};
  for (const h of SHEETS[sheet])
    out[h] = booleanFields.has(h)
      ? bool(row[h])
      : numberFields.has(h)
        ? num(row[h])
        : text(row[h]);
  return out;
}
type Located = { row: Row; rowNumber: number };
export class GoogleSheetsBelgaRepository implements BelgaRepository {
  private client: sheets_v4.Sheets;
  private queue: Promise<void> = Promise.resolve();
  private cache?: {
    expires: number;
    data: Awaited<ReturnType<GoogleSheetsBelgaRepository["buildPublicData"]>>;
  };
  constructor(
    private spreadsheetId = env.googleSheetsSpreadsheetId,
    client?: sheets_v4.Sheets,
    private ttl = 30000,
  ) {
    if (client) this.client = client;
    else {
      if (!spreadsheetId || !env.googleServiceAccountJsonBase64)
        throw new Error("Configuration Google Sheets BELGA WOOD manquante.");
      let credentials: { client_email: string; private_key: string };
      try {
        credentials = JSON.parse(
          Buffer.from(env.googleServiceAccountJsonBase64, "base64").toString(
            "utf8",
          ),
        ) as { client_email: string; private_key: string };
        if (!credentials.client_email || !credentials.private_key)
          throw new Error("missing service-account fields");
      } catch {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 est invalide.");
      }
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      this.client = google.sheets({ version: "v4", auth });
    }
  }
  async initialize() {
    const book = await this.client.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });
    const existing = new Map(
      (book.data.sheets || []).map((s) => [
        s.properties?.title,
        s.properties?.sheetId,
      ]),
    );
    const missing = Object.keys(SHEETS).filter((n) => !existing.has(n));
    if (missing.length)
      await this.client.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: missing.map((title) => ({
            addSheet: { properties: { title } },
          })),
        },
      });
    for (const [name, headers] of Object.entries(SHEETS)) {
      const current = await this.client.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${name}!1:1`,
      });
      const row = (current.data.values?.[0] || []).map(String);
      const missingHeaders = headers.filter((header) => !row.includes(header));
      if (missingHeaders.length)
        await this.client.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${name}!${columnName(row.length + 1)}1`,
          valueInputOption: "RAW",
          requestBody: { values: [missingHeaders] },
        });
    }
    await this.seed();
  }
  private async seed() {
    const now = new Date().toISOString();
    if (!(await this.list("Categories")).length)
      for (const [name, i] of [
        "Cuisines",
        "Placards",
        "Dressings",
        "Meubles TV",
        "Portes",
        "Aménagement intérieur",
        "Autres réalisations",
      ].map((x, i) => [x, i] as const))
        await this.createRow("Categories", {
          name,
          active: true,
          displayOrder: i + 1,
        });
    if (!(await this.list("Services")).length)
      for (const [title, i] of [
        "Cuisine sur mesure",
        "Placards sur mesure",
        "Dressings",
        "Meubles TV",
        "Portes",
        "Aménagement intérieur",
        "Mobilier sur mesure",
      ].map((x, i) => [x, i] as const))
        await this.createRow("Services", {
          title,
          active: true,
          featured: i < 6,
          displayOrder: i + 1,
        });
    if (!(await this.list("Settings")).length)
      await this.updateSettings({
        companyName: "BELGA WOOD",
        heroTitle: "L’élégance du sur-mesure",
        heroSubtitle:
          "Cuisines, dressings, placards et aménagements intérieurs pensés pour votre espace.",
        aboutTitle: "Le détail donne sa valeur à l’espace",
        aboutText: "",
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
        seoTitle: "BELGA WOOD — Menuiserie sur mesure à Casablanca",
        seoDescription: "",
      });
    void now;
  }
  private async located(sheet: SheetName): Promise<Located[]> {
    const response = await this.client.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${sheet}!A:Z`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const values = response.data.values || [],
      expected = [...SHEETS[sheet]],
      headers = (values[0] || []).map(String);
    return values
      .slice(1)
      .map((cells, index) => {
        const raw: Row = {};
        expected.forEach((h) => (raw[h] = cells[headers.indexOf(h)] ?? ""));
        return { row: normalized(sheet, raw), rowNumber: index + 2 };
      })
      .filter(({ row }) => {
        if (sheet === "Settings") return Boolean(row.key);
        if (!row.id) {
          console.warn(`[sheets] ${sheet}: ligne ignorée sans id`);
          return false;
        }
        return true;
      });
  }
  async list(sheet: SheetName) {
    return (await this.located(sheet)).map((x) => x.row);
  }
  private async headers(sheet: SheetName) {
    const response = await this.client.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${sheet}!1:1`,
    });
    return (response.data.values?.[0] || []).map(String);
  }
  async settings() {
    return Object.fromEntries(
      (await this.list("Settings")).map((x) => [
        String(x.key),
        String(x.value || ""),
      ]),
    );
  }
  private exclusive<T>(fn: () => Promise<T>) {
    const previous = this.queue;
    let done!: () => void;
    this.queue = new Promise<void>((r) => {
      done = r;
    });
    return previous.then(fn).finally(done);
  }
  private invalidate() {
    this.cache = undefined;
  }
  async createRow(sheet: Exclude<SheetName, "Settings">, input: Row) {
    return this.exclusive(async () => {
      const now = new Date().toISOString(),
        row: Row = {
          ...input,
          id: crypto.randomUUID(),
          slug:
            input.slug ||
            ("title" in input || "name" in input
              ? slugify(String(input.title || input.name))
              : ""),
          createdAt: now,
          updatedAt: now,
        };
      const headers = await this.headers(sheet);
      await this.client.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${sheet}!A:A`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [headers.map((h) => row[h] ?? "")] },
      });
      this.invalidate();
      return normalized(sheet, row);
    });
  }
  async updateRow(
    sheet: Exclude<SheetName, "Settings">,
    id: string,
    input: Row,
  ) {
    return this.exclusive(async () => {
      const found = (await this.located(sheet)).find((x) => x.row.id === id);
      if (!found) throw new Error("Élément introuvable.");
      const row: Row = {
        ...found.row,
        ...input,
        id,
        updatedAt: new Date().toISOString(),
      };
      const headers = await this.headers(sheet);
      const currentResponse = await this.client.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${sheet}!${found.rowNumber}:${found.rowNumber}`,
      });
      const returnedRows = currentResponse.data.values || [];
      const current = returnedRows.length === 1
        ? returnedRows[0] || []
        : returnedRows[found.rowNumber - 1] || [];
      const values = headers.map((header, index) =>
        (SHEETS[sheet] as readonly string[]).includes(header)
          ? row[header] ?? ""
          : current[index] ?? "",
      );
      await this.client.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheet}!A${found.rowNumber}`,
        valueInputOption: "RAW",
        requestBody: { values: [values] },
      });
      const verify = (await this.located(sheet)).find((x) => x.row.id === id);
      if (!verify) throw new Error("Vérification Google Sheets impossible.");
      this.invalidate();
      return verify.row;
    });
  }
  async deleteRow(sheet: Exclude<SheetName, "Settings">, id: string) {
    return this.exclusive(async () => {
      if (
        sheet === "Categories" &&
        (await this.list("Projects")).some((x) => x.categoryId === id)
      )
        throw new Error("Cette catégorie est utilisée par une réalisation.");
      const found = (await this.located(sheet)).find((x) => x.row.id === id);
      if (!found) throw new Error("Élément introuvable.");
      const meta = await this.client.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });
      const sheetId = meta.data.sheets?.find(
        (s) => s.properties?.title === sheet,
      )?.properties?.sheetId;
      if (sheetId == null)
        throw new Error("Feuille Google Sheets introuvable.");
      await this.client.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: "ROWS",
                  startIndex: found.rowNumber - 1,
                  endIndex: found.rowNumber,
                },
              },
            },
          ],
        },
      });
      this.invalidate();
    });
  }
  async updateSettings(values: Record<string, string>) {
    return this.exclusive(async () => {
      const rows = await this.located("Settings"),
        data = [] as { range: string; values: string[][] }[];
      for (const [k, v] of Object.entries(values)) {
        const found = rows.find((x) => x.row.key === k);
        if (found)
          data.push({
            range: `Settings!A${found.rowNumber}:B${found.rowNumber}`,
            values: [[k, v]],
          });
        else
          await this.client.spreadsheets.values.append({
            spreadsheetId: this.spreadsheetId,
            range: "Settings!A:B",
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: [[k, v]] },
          });
      }
      if (data.length)
        await this.client.spreadsheets.values.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: { valueInputOption: "RAW", data },
        });
      this.invalidate();
      return this.settings();
    });
  }
  private async buildPublicData() {
    const [categories, services, products, productImages, projects, images, testimonials, settings] =
      await Promise.all([
        this.list("Categories"),
        this.list("Services"),
        this.list("Products"),
        this.list("ProductImages"),
        this.list("Projects"),
        this.list("ProjectImages"),
        this.list("Testimonials"),
        this.settings(),
      ]);
    const publishedProjects = projects
      .filter((x) => bool(x.published))
      .sort((a, b) => num(a.displayOrder) - num(b.displayOrder));
    return {
      categories: categories
        .filter((x) => bool(x.active))
        .sort((a, b) => num(a.displayOrder) - num(b.displayOrder))
        .map((category) => ({
          ...category,
          projectCount: publishedProjects.filter(
            (project) => project.categoryId === category.id,
          ).length,
        })),
      products: products
        .filter((x) => bool(x.active))
        .sort((a, b) => num(a.displayOrder) - num(b.displayOrder))
        .map((product) => Object.assign({}, product, {
          images: productImages
            .filter((image) => image.productId === product.id)
            .sort((a, b) => num(a.displayOrder) - num(b.displayOrder)),
        })),
      services: services
        .filter((x) => bool(x.active))
        .sort((a, b) => num(a.displayOrder) - num(b.displayOrder)),
      projects: publishedProjects
        .map((p) =>
          Object.assign({}, p, {
            images: images
              .filter((i) => i.projectId === p.id)
              .sort((a, b) => num(a.displayOrder) - num(b.displayOrder)),
          }),
        ),
      testimonials: testimonials
        .filter((x) => bool(x.published))
        .sort((a, b) => num(a.displayOrder) - num(b.displayOrder)),
      settings,
    };
  }
  async publicData() {
    if (this.cache && this.cache.expires > Date.now()) return this.cache.data;
    const data = await this.buildPublicData();
    this.cache = { expires: Date.now() + this.ttl, data };
    return data;
  }
  getSpreadsheetId() {
    return this.spreadsheetId;
  }
}

function columnName(index: number) {
  let result = "";
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26))
    result = String.fromCharCode(65 + ((n - 1) % 26)) + result;
  return result;
}
