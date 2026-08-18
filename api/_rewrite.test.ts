import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { restoreRewrittenPath } from "./_rewrite.js";

describe("Vercel routing", () => {
  it("keeps API routes outside the SPA fallback", () => {
    const config = JSON.parse(
      fs.readFileSync(path.resolve("vercel.json"), "utf8"),
    ) as { rewrites: Array<{ source: string; destination: string }> };
    expect(config.rewrites[0]).toEqual({
      source: "/api/:path*",
      destination: "/api?__api_path=:path*",
    });
    expect(config.rewrites.at(-1)).toEqual({
      source: "/(.*)",
      destination: "/index.html",
    });
    for (const route of [
      "/",
      "/admin/connexion",
      "/produits",
      "/produits/cuisine-noyer-signature",
      "/realisations",
      "/realisations/cuisine-contemporaine",
      "/services/cuisine-sur-mesure",
    ]) {
      expect(route.startsWith("/api/")).toBe(false);
      expect(config.rewrites.at(-1)?.destination).toBe("/index.html");
    }
  });

  it("does not reinitialize every Google Sheet on each Vercel cold start", () => {
    const entry = fs.readFileSync(path.resolve("api/index.ts"), "utf8");
    expect(entry).not.toContain("repository.initialize()");
    expect(entry).toContain("createApp(repository)");
  });

  it.each([
    ["/api?__api_path=public", "/api/public"],
    ["/api?__api_path=admin%2Fdashboard", "/api/admin/dashboard"],
    ["/api?__api_path=products%2Fcuisine&limit=4", "/api/products/cuisine?limit=4"],
    ["/api?__root_path=robots.txt", "/robots.txt"],
    ["/api?__root_path=sitemap.xml", "/sitemap.xml"],
  ])("restores %s for Express", (input, expected) => {
    const req = { url: input } as Request;
    restoreRewrittenPath(req);
    expect(req.url).toBe(expected);
  });
});
