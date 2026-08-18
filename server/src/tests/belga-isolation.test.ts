import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcrypt";
import { GoogleSheetsBelgaRepository } from "../belga/GoogleSheetsBelgaRepository.js";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { SHEETS } from "../belga/types.js";
type Args = {
  range: string;
  requestBody: {
    values: unknown[][];
    requests?: Record<string, unknown>[];
    data?: { range: string; values: unknown[][] }[];
  };
};
class FakeSheets {
  tabs = new Map<string, unknown[][]>([
    ["Notes", [["private notes"], ["untouched"]]],
  ]);
  ids = new Map<string, number>([["Notes", 99]]);
  next = 100;
  spreadsheets: Record<string, unknown>;
  constructor() {
    this.spreadsheets = {
      get: async () => ({
        data: {
          sheets: [...this.tabs.keys()].map((title) => ({
            properties: { title, sheetId: this.ids.get(title) },
          })),
        },
      }),
      batchUpdate: async ({
        requestBody,
      }: {
        requestBody: { requests: Record<string, any>[] };
      }) => {
        for (const q of requestBody.requests || []) {
          if (q.addSheet) {
            this.tabs.set(q.addSheet.properties.title, []);
            this.ids.set(q.addSheet.properties.title, this.next++);
          }
          if (q.deleteDimension) {
            const title = [...this.ids].find(
              ([, id]) => id === q.deleteDimension.range.sheetId,
            )?.[0];
            if (title)
              this.tabs
                .get(title)
                ?.splice(
                  q.deleteDimension.range.startIndex,
                  q.deleteDimension.range.endIndex -
                    q.deleteDimension.range.startIndex,
                );
          }
        }
        return { data: {} };
      },
      values: {
        get: async ({ range }: Args) => {
          const title = range.split("!")[0]!,
            rows = this.tabs.get(title) || [];
          return {
            data: {
              values: range.includes("1:1")
                ? rows.slice(0, 1)
                : rows.map((r) => [...r]),
            },
          };
        },
        update: async ({ range, requestBody }: Args) => {
          this.write(range, requestBody.values[0] || []);
          return { data: {} };
        },
        append: async ({ range, requestBody }: Args) => {
          this.tabs
            .get(range.split("!")[0]!)!
            .push([...(requestBody.values[0] || [])]);
          return { data: { updates: {} } };
        },
        batchUpdate: async ({ requestBody }: Args) => {
          for (const d of requestBody.data || [])
            this.write(d.range, d.values[0] || []);
          return { data: {} };
        },
      },
    };
  }
  write(range: string, row: unknown[]) {
    const [title, address] = range.split("!"),
      n = Number(address?.match(/\d+/)?.[0] || 1),
      rows = this.tabs.get(title!)!;
    while (rows.length < n) rows.push([]);
    rows[n - 1] = [...row];
  }
  manual(sheet: keyof typeof SHEETS, row: Record<string, unknown>) {
    this.tabs.get(sheet)!.push(SHEETS[sheet].map((h) => row[h] ?? ""));
  }
}
let fake: FakeSheets, repo: GoogleSheetsBelgaRepository;
beforeEach(async () => {
  fake = new FakeSheets();
  repo = new GoogleSheetsBelgaRepository("belga-sheet-test", fake as never, 1);
  await repo.initialize();
  env.adminEmail = "admin@belga.test";
  env.adminPasswordHash = await bcrypt.hash("StrongPassword!42", 4);
  env.sessionSecret = "belga-test-session-secret-at-least-32-characters";
  env.cloudinaryCloudName = "";
  env.cloudinaryApiKey = "";
  env.cloudinaryApiSecret = "";
});
describe("Google Sheets BELGA WOOD", () => {
  it("creates required tabs and headers without touching unrelated tabs", async () => {
    expect([...fake.tabs.keys()]).toEqual(
      expect.arrayContaining([...Object.keys(SHEETS), "Notes"]),
    );
    expect(fake.tabs.get("Notes")).toEqual([["private notes"], ["untouched"]]);
    expect(await repo.list("Categories")).toHaveLength(7);
    expect(await repo.list("Projects")).toHaveLength(0);
  });
  it("reflects manual rows, normalizes booleans and uses IDs after sorting", async () => {
    fake.manual("Categories", {
      id: "cat-office",
      name: "Bureaux",
      slug: "bureaux",
      active: "TRUE",
      displayOrder: "8",
    });
    expect(
      (await repo.publicData()).categories.some((x) => x.name === "Bureaux"),
    ).toBe(true);
    const p = await repo.createRow("Projects", {
      title: "Bureau Anfa",
      categoryId: "cat-office",
      published: true,
      featured: true,
    });
    const rows = fake.tabs.get("Projects")!,
      header = rows.shift()!;
    rows.reverse();
    rows.unshift(header);
    await repo.updateRow("Projects", String(p.id), { published: false });
    expect((await repo.publicData()).projects).toHaveLength(0);
  });
  it("persists duplicate-safe quotes and protects admin APIs", async () => {
    const app = createApp(repo),
      payload = {
        clientRequestId: crypto.randomUUID(),
        fullName: "Sara",
        phone: "0612345678",
        city: "Casablanca",
        message: "Cuisine",
      };
    expect((await request(app).post("/api/quotes").send(payload)).status).toBe(
      201,
    );
    expect(
      (await request(app).post("/api/quotes").send(payload)).body.data
        .duplicate,
    ).toBe(true);
    expect(await repo.list("QuoteRequests")).toHaveLength(1);
    expect((await request(app).get("/api/public")).status).toBe(200);
    expect((await request(app).get("/api/admin/projects")).status).toBe(401);
    const agent = request.agent(app);
    await agent
      .post("/api/auth/login")
      .send({ email: env.adminEmail, password: "StrongPassword!42" });
    expect((await agent.get("/api/admin/projects")).status).toBe(200);
    expect(
      (await agent.get("/api/admin/google-sheet")).body.data.url,
    ).toContain("belga-sheet-test");
  });
  it("uses persistent Google Sheets throttling in production", async () => {
    const previous = env.isProduction;
    env.isProduction = true;
    try {
      const response = await request(createApp(repo)).post("/api/quotes").send({
        clientRequestId: crypto.randomUUID(),
        fullName: "Sara",
        phone: "0612345678",
        city: "Casablanca",
        message: "Cuisine",
      });
      expect(response.status).toBe(201);
      const events = await repo.list("SecurityEvents");
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ name: "quote" });
      expect(String(events[0]?.keyHash)).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      env.isProduction = previous;
    }
  });
  it("keeps Cloudinary optional for public reads", async () => {
    expect((await repo.publicData()).settings.companyName).toBe("BELGA WOOD");
    const agent = request.agent(createApp(repo));
    await agent
      .post("/api/auth/login")
      .send({ email: env.adminEmail, password: "StrongPassword!42" });
    expect(
      (await agent.get("/api/admin/media/status")).body.data.configured,
    ).toBe(false);
  });
  it("limits the public product gallery to six images including the cover", async () => {
    const product = await repo.createRow("Products", {
      name: "Cuisine Galerie",
      categoryId: "category-test",
      shortDescription: "Cuisine sur mesure",
      description: "Description complète",
      priceType: "on_request",
      coverImageUrl: "https://example.test/cover.webp",
      active: true,
    });
    for (let index = 1; index <= 7; index += 1)
      await repo.createRow("ProductImages", {
        productId: product.id,
        imageUrl: `https://example.test/${index}.webp`,
        displayOrder: index,
      });
    const visible = (await repo.publicData()).products.find(
      (row) => row.id === product.id,
    );
    expect(visible?.images).toHaveLength(5);
    expect([visible?.coverImageUrl, ...(visible?.images || [])]).toHaveLength(6);
  });
  it("creates a unique URL slug for every product", async () => {
    const input = {
      name: "Dressing Élégance",
      categoryId: "category-test",
      shortDescription: "Dressing sur mesure",
      description: "Description complète",
      priceType: "on_request",
      active: true,
    };
    const first = await repo.createRow("Products", input);
    const second = await repo.createRow("Products", input);
    const third = await repo.createRow("Products", input);
    expect([first.slug, second.slug, third.slug]).toEqual([
      "dressing-elegance",
      "dressing-elegance-2",
      "dressing-elegance-3",
    ]);
  });
});
