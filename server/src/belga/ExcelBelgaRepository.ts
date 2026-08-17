import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import ExcelJS from "exceljs";
import lockfile from "proper-lockfile";
import writeFileAtomic from "write-file-atomic";
import { SHEETS, type Row, type SheetName } from "./types.js";
const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const cell = (v: ExcelJS.CellValue): string | number | boolean =>
  v == null
    ? ""
    : v instanceof Date
      ? v.toISOString()
      : typeof v === "object"
        ? String("text" in v ? v.text : "result" in v ? v.result : "")
        : v;
export class ExcelBelgaRepository {
  constructor(
    public readonly file: string,
    public readonly backups: string,
    private retention = 30,
  ) {}
  async initialize() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.mkdir(this.backups, { recursive: true });
    try {
      await fs.access(this.file);
      await this.validate(this.file);
    } catch {
      await this.create();
    }
  }
  private async create() {
    const wb = new ExcelJS.Workbook();
    wb.creator = "BELGA WOOD";
    for (const [name, headers] of Object.entries(SHEETS)) {
      const s = wb.addWorksheet(name);
      s.addRow(headers);
      s.getRow(1).font = { bold: true };
    }
    const now = new Date().toISOString();
    const cats = [
      "Cuisines",
      "Placards",
      "Dressings",
      "Meubles TV",
      "Portes",
      "Aménagement intérieur",
      "Autres réalisations",
    ];
    cats.forEach((name, i) =>
      wb
        .getWorksheet("Categories")!
        .addRow([
          crypto.randomUUID(),
          name,
          slugify(name),
          "",
          "",
          "",
          i + 1,
          true,
          now,
          now,
        ]),
    );
    const services = [
      "Cuisine sur mesure",
      "Placards sur mesure",
      "Dressings",
      "Meubles TV",
      "Portes",
      "Aménagement intérieur",
      "Mobilier sur mesure",
    ];
    services.forEach((title, i) =>
      wb
        .getWorksheet("Services")!
        .addRow([
          crypto.randomUUID(),
          title,
          slugify(title),
          "",
          "",
          "",
          "",
          i < 6,
          true,
          i + 1,
          now,
          now,
        ]),
    );
    const defaults: Record<string, string> = {
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
    };
    Object.entries(defaults).forEach(([k, v]) =>
      wb.getWorksheet("Settings")!.addRow([k, v, now]),
    );
    await wb.xlsx.writeFile(this.file);
  }
  private async validate(file: string) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    for (const [name, headers] of Object.entries(SHEETS)) {
      const s = wb.getWorksheet(name);
      if (!s) throw new Error(`Feuille manquante: ${name}`);
      const actual = (s.getRow(1).values as ExcelJS.CellValue[])
        .slice(1)
        .map(String);
      if (headers.some((h, i) => actual[i] !== h))
        throw new Error(`En-têtes invalides: ${name}`);
    }
    return wb;
  }
  private async rows(sheet: SheetName) {
    const wb = await this.validate(this.file),
      s = wb.getWorksheet(sheet)!;
    const headers = [...SHEETS[sheet]];
    const out: Row[] = [];
    s.eachRow((r, i) => {
      if (i === 1) return;
      const x: Row = {};
      headers.forEach((h, j) => (x[h] = cell(r.getCell(j + 1).value)));
      if (Object.values(x).some(Boolean)) out.push(x);
    });
    return out;
  }
  async list(sheet: SheetName) {
    return this.rows(sheet);
  }
  async settings() {
    return Object.fromEntries(
      (await this.rows("Settings")).map((x) => [
        String(x.key),
        String(x.value || ""),
      ]),
    );
  }
  private async backup() {
    try {
      await fs.access(this.file);
    } catch {
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.copyFile(
      this.file,
      path.join(this.backups, `belga-wood-${stamp}.xlsx`),
    );
    const names = (await fs.readdir(this.backups))
      .filter((x) => x.endsWith(".xlsx"))
      .sort()
      .reverse();
    await Promise.all(
      names
        .slice(this.retention)
        .map((x) => fs.rm(path.join(this.backups, x), { force: true })),
    );
  }
  private async mutate(op: (wb: ExcelJS.Workbook) => void | Promise<void>) {
    const release = await lockfile.lock(this.file, {
      retries: { retries: 8, minTimeout: 30, maxTimeout: 300 },
    });
    try {
      await this.backup();
      const wb = await this.validate(this.file);
      await op(wb);
      const tmp = `${this.file}.${crypto.randomUUID()}.tmp.xlsx`;
      await wb.xlsx.writeFile(tmp);
      await this.validate(tmp);
      await writeFileAtomic(this.file, await fs.readFile(tmp));
      await fs.rm(tmp, { force: true });
    } finally {
      await release();
    }
  }
  async createRow(sheet: Exclude<SheetName, "Settings">, input: Row) {
    const now = new Date().toISOString();
    const row: Row = {
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
    await this.mutate((wb) => {
      const s = wb.getWorksheet(sheet)!;
      s.addRow(SHEETS[sheet].map((h) => row[h] ?? ""));
    });
    return row;
  }
  async updateRow(
    sheet: Exclude<SheetName, "Settings">,
    id: string,
    input: Row,
  ) {
    let result: Row | undefined;
    await this.mutate((wb) => {
      const s = wb.getWorksheet(sheet)!;
      s.eachRow((r, i) => {
        if (i > 1 && String(r.getCell(1).value) === id) {
          const old: Row = Object.fromEntries(
            SHEETS[sheet].map((h, j) => [h, cell(r.getCell(j + 1).value)]),
          );
          result = {
            ...old,
            ...input,
            id,
            updatedAt: new Date().toISOString(),
          };
          SHEETS[sheet].forEach(
            (h, j) => (r.getCell(j + 1).value = result![h] ?? ""),
          );
        }
      });
    });
    if (!result) throw new Error("Élément introuvable.");
    return result;
  }
  async deleteRow(sheet: Exclude<SheetName, "Settings">, id: string) {
    if (
      sheet === "Categories" &&
      (await this.rows("Projects")).some((x) => x.categoryId === id)
    )
      throw new Error("Cette catégorie est utilisée par une réalisation.");
    await this.mutate((wb) => {
      const s = wb.getWorksheet(sheet)!;
      for (let i = s.rowCount; i > 1; i--)
        if (String(s.getRow(i).getCell(1).value) === id) s.spliceRows(i, 1);
    });
  }
  async updateSettings(values: Record<string, string>) {
    await this.mutate((wb) => {
      const s = wb.getWorksheet("Settings")!;
      const current = new Map<string, number>();
      s.eachRow((r, i) => {
        if (i > 1) current.set(String(r.getCell(1).value), i);
      });
      for (const [k, v] of Object.entries(values)) {
        const i = current.get(k);
        if (i) s.getRow(i).values = [k, v, new Date().toISOString()];
        else s.addRow([k, v, new Date().toISOString()]);
      }
    });
    return this.settings();
  }
  async publicData(): Promise<{
    categories: Row[];
    services: Row[];
    projects: (Row & { images: Row[] })[];
    testimonials: Row[];
    settings: Record<string, string>;
  }> {
    const [categories, services, projects, images, testimonials, settings] =
      await Promise.all([
        this.rows("Categories"),
        this.rows("Services"),
        this.rows("Projects"),
        this.rows("ProjectImages"),
        this.rows("Testimonials"),
        this.settings(),
      ]);
    return {
      categories: categories.filter((x) => x.active === true),
      services: services.filter((x) => x.active === true),
      projects: projects
        .filter((x) => x.published === true)
        .map((p) =>
          Object.assign({}, p, {
            images: images.filter((i) => i.projectId === p.id),
          }),
        ),
      testimonials: testimonials.filter((x) => x.published === true),
      settings,
    };
  }
}
