import path from "node:path";
import fs from "node:fs";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import { env, paths } from "./config/env.js";
import type { BelgaRepository } from "./belga/types.js";
import { createBelgaRoutes } from "./belga/routes.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { errorHandler } from "./middleware/errorHandler.js";
export function createApp(repository: BelgaRepository) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());
  app.get("/api/health", (_q, res) =>
    res.json({
      success: true,
      data: { status: "ok", catalogueBackend: "google-sheets" },
      message: "",
    }),
  );
  app.get("/api/ready", async (_q, res, next) => {
    try {
      await repository.list("Settings");
      res.json({
        success: true,
        data: { ready: true, catalogueBackend: "google-sheets" },
        message: "",
      });
    } catch (e) {
      next(e);
    }
  });
  app.get("/sitemap.xml", async (_q, res, next) => {
    try {
      if (!env.publicSiteUrl) return res.status(204).set("Cache-Control", "no-store").end();
      const data = await repository.publicData();
      const paths = [
        "",
        "/produits",
        ...data.products.map((product) => `/produits/${encodeURIComponent(String(product.slug))}`),
        "/realisations",
        ...data.projects.map((project) => `/realisations/${encodeURIComponent(String(project.slug))}`),
        "/services",
        ...data.services.map((service) => `/services/${encodeURIComponent(String(service.slug))}`),
        "/a-propos",
        "/contact",
        "/demande-de-devis",
      ];
      const entries = paths.map((route) => `  <url><loc>${env.publicSiteUrl}${route}</loc></url>`).join("\n");
      return res
        .type("application/xml")
        .set("Cache-Control", "public, max-age=300")
        .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`);
    } catch (error) {
      return next(error);
    }
  });
  app.get("/robots.txt", (_q, res) => {
    const sitemap = env.publicSiteUrl ? `\nSitemap: ${env.publicSiteUrl}/sitemap.xml` : "";
    return res
      .type("text/plain")
      .set("Cache-Control", "public, max-age=300")
      .send(`User-agent: *\nAllow: /\nDisallow: /admin${sitemap}\n`);
  });
  app.use("/api", createBelgaRoutes(repository));
  app.use("/api", notFoundHandler);
  if (env.isProduction && fs.existsSync(paths.clientDist)) {
    app.use(express.static(paths.clientDist, { maxAge: "1y", index: false }));
    app.get("*path", (_q, res, next) =>
      res.sendFile(path.join(paths.clientDist, "index.html"), (e) =>
        e ? next(e) : undefined,
      ),
    );
  }
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
