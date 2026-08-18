import crypto from "node:crypto";
import { Router, type RequestHandler } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import bcrypt from "bcrypt";
import { env } from "../config/env.js";
import type { BelgaRepository } from "./types.js";
import { quoteStatuses, type Row, type SheetName } from "./types.js";
import { durableRateLimit } from "../services/rateLimit.js";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(f.mimetype))
      cb(null, true);
    else cb(new Error("Format image non accepté."));
  },
}).single("image");
const cookie = "belga_wood_admin";
const clean = (body: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(body).map(([k, v]) => [
      k,
      typeof v === "string" ? v.trim().slice(0, 10000) : v,
    ]),
  ) as Row;
const protect: RequestHandler = (req, res, next) => {
  try {
    jwt.verify(req.cookies?.[cookie] || "", env.sessionSecret, {
      issuer: "belga-wood",
      audience: "belga-wood-admin",
    });
    next();
  } catch {
    res.status(401).json({
      success: false,
      data: null,
      message: "Authentification requise.",
    });
  }
};
const cloudReady = () =>
  Boolean(
    env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret,
  );
const configure = () =>
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
const productPriceTypes = new Set(["fixed", "starting_from", "on_request"]);
const maxProductImages = 6;
const validateProduct = (body: Row) => {
  const priceType = String(body.priceType || "on_request");
  if (!body.name || !body.categoryId || !body.shortDescription || !body.description)
    throw new Error("Nom, catégorie et descriptions sont requis.");
  if (!productPriceTypes.has(priceType)) throw new Error("Type de prix invalide.");
  if (priceType !== "on_request" && Number(body.price) <= 0) throw new Error("Un prix positif est requis.");
  return { ...body, priceType, currency: String(body.currency || "DH"), price: priceType === "on_request" ? 0 : Number(body.price), oldPrice: Math.max(0, Number(body.oldPrice || 0)) };
};
export function createBelgaRoutes(repo: BelgaRepository) {
  const r = Router(),
    ok = (data: unknown, message = "") => ({ success: true, data, message });
  r.get("/public", async (_q, res, next) => {
    try {
      const data = await repo.publicData();
      res.json(ok({ ...data, settings: { ...data.settings, siteUrl: env.publicSiteUrl } }));
    } catch (e) {
      next(e);
    }
  });
  r.get("/services", async (_q, res, next) => {
    try {
      res.json(
        ok((await repo.list("Services")).filter((x) => x.active === true)),
      );
    } catch (e) {
      next(e);
    }
  });
  r.get("/categories", async (_q, res, next) => {
    try {
      res.json(
        ok((await repo.list("Categories")).filter((x) => x.active === true)),
      );
    } catch (e) {
      next(e);
    }
  });
  r.get("/projects", async (_q, res, next) => {
    try {
      res.json(ok((await repo.publicData()).projects));
    } catch (e) {
      next(e);
    }
  });
  r.get("/products", async (_q, res, next) => {
    try { res.json(ok((await repo.publicData()).products)); } catch (e) { next(e); }
  });
  r.get("/products/:slug", async (req, res, next) => {
    try {
      const data = await repo.publicData();
      const product = data.products.find((item) => item.slug === req.params.slug);
      if (!product) return res.status(404).json({ success: false, data: null, message: "Produit introuvable." });
      return res.json(ok({
        ...product,
        category: data.categories.find((category) => category.id === product.categoryId),
        related: data.products.filter((item) => item.categoryId === product.categoryId && item.id !== product.id).slice(0, 4),
      }));
    } catch (e) { next(e); }
  });
  r.get("/projects/:slug", async (req, res, next) => {
    try {
      const d = await repo.publicData(),
        p = d.projects.find((x) => x.slug === req.params.slug);
      if (!p)
        return res.status(404).json({
          success: false,
          data: null,
          message: "Réalisation introuvable.",
        });
      return res.json(
        ok({
          ...p,
          category: d.categories.find((c) => c.id === p.categoryId),
          related: d.projects
            .filter((x) => x.categoryId === p.categoryId && x.id !== p.id)
            .slice(0, 3),
        }),
      );
    } catch (e) {
      next(e);
    }
  });
  r.get("/settings/public", async (_q, res, next) => {
    try {
      res.json(ok({ ...(await repo.settings()), siteUrl: env.publicSiteUrl }));
    } catch (e) {
      next(e);
    }
  });
  r.post(
    "/quotes",
    durableRateLimit({ name: "quote", windowMs: 600000, limit: 5 }, repo),
    async (req, res, next) => {
      try {
        const b = clean(req.body);
        if (!b.fullName || !b.phone || !b.city || !b.message)
          return res.status(400).json({
            success: false,
            data: null,
            message: "Nom, téléphone, ville et message sont requis.",
          });
        if (!/^[+0-9 ()-]{8,24}$/.test(String(b.phone)))
          return res.status(400).json({
            success: false,
            data: null,
            message: "Numéro de téléphone invalide.",
          });
        if (b.email && !/^\S+@\S+\.\S+$/.test(String(b.email)))
          return res.status(400).json({
            success: false,
            data: null,
            message: "Adresse e-mail invalide.",
          });
        const requestId = String(b.clientRequestId || "");
        if (
          requestId &&
          (await repo.list("QuoteRequests")).some(
            (x) => x.clientRequestId === requestId,
          )
        )
          return res.json(ok({ duplicate: true }, "Demande déjà reçue."));
        const row = await repo.createRow("QuoteRequests", {
          ...b,
          clientRequestId: requestId || crypto.randomUUID(),
          status: "new",
        });
        return res
          .status(201)
          .json(ok(row, "Votre demande a bien été envoyée."));
      } catch (e) {
        next(e);
      }
    },
  );
  r.post(
    "/auth/login",
    durableRateLimit({ name: "admin-login", windowMs: 900000, limit: 8 }, repo),
    async (req, res) => {
      const email = String(req.body?.email || "").toLowerCase(),
        password = String(req.body?.password || "");
      const valid =
        email === env.adminEmail.toLowerCase() &&
        Boolean(password) &&
        Boolean(env.adminPasswordHash) &&
        (await bcrypt.compare(password, env.adminPasswordHash));
      if (!valid)
        return res.status(401).json({
          success: false,
          data: null,
          message: "Identifiants invalides.",
        });
      const value = jwt.sign({ email }, env.sessionSecret, {
        expiresIn: "8h",
        issuer: "belga-wood",
        audience: "belga-wood-admin",
      });
      res.cookie(cookie, value, {
        httpOnly: true,
        sameSite: "lax",
        secure: env.isProduction,
        maxAge: 28800000,
        path: "/",
      });
      return res.json(ok({ email }, "Connexion réussie."));
    },
  );
  r.post("/auth/logout", (_q, res) => {
    res.clearCookie(cookie, { path: "/" });
    res.json(ok(null));
  });
  r.get("/auth/session", protect, (_q, res) =>
    res.json(ok({ authenticated: true, email: env.adminEmail })),
  );
  r.use("/admin", protect);
  r.get("/admin/dashboard", async (_q, res, next) => {
    try {
      const [p, s, t, q] = await Promise.all([
        repo.list("Projects"),
        repo.list("Services"),
        repo.list("Testimonials"),
        repo.list("QuoteRequests"),
      ]);
      const products = await repo.list("Products");
      res.json(
        ok({
          totalProjects: p.length,
          activeProducts: products.filter((x) => x.active === true).length,
          featuredProducts: products.filter((x) => x.active === true && x.featured === true).length,
          publishedProjects: p.filter((x) => x.published === true).length,
          activeServices: s.filter((x) => x.active === true).length,
          newQuotes: q.filter((x) => x.status === "new").length,
          publishedTestimonials: t.filter((x) => x.published === true).length,
          recentQuotes: q.slice(-5).reverse(),
          recentProjects: p.slice(-5).reverse(),
        }),
      );
    } catch (e) {
      next(e);
    }
  });
  const map: Record<string, Exclude<SheetName, "Settings">> = {
    products: "Products",
    "product-images": "ProductImages",
    projects: "Projects",
    services: "Services",
    categories: "Categories",
    testimonials: "Testimonials",
    quotes: "QuoteRequests",
    images: "ProjectImages",
  };
  for (const [route, sheet] of Object.entries(map)) {
    r.get(`/admin/${route}`, async (_q, res, next) => {
      try {
        res.json(ok(await repo.list(sheet)));
      } catch (e) {
        next(e);
      }
    });
    r.post(`/admin/${route}`, async (req, res, next) => {
      try {
        if (sheet === "QuoteRequests") return res.status(405).end();
        const input = sheet === "Products" ? validateProduct(clean(req.body)) : clean(req.body);
        return res
          .status(201)
          .json(
            ok(
              await repo.createRow(sheet, input),
              "Création réussie.",
            ),
          );
      } catch (e) {
        next(e);
      }
    });
    r.put(`/admin/${route}/:id`, async (req, res, next) => {
      try {
        if (
          sheet === "QuoteRequests" &&
          req.body.status &&
          !quoteStatuses.includes(req.body.status)
        )
          return res
            .status(400)
            .json({ success: false, data: null, message: "Statut invalide." });
        const input = sheet === "Products" ? validateProduct({ ...(await repo.list("Products")).find((item) => item.id === req.params.id), ...clean(req.body) }) : clean(req.body);
        return res.json(
          ok(
            await repo.updateRow(sheet, req.params.id, input),
            "Modification enregistrée.",
          ),
        );
      } catch (e) {
        next(e);
      }
    });
    r.delete(`/admin/${route}/:id`, async (req, res, next) => {
      try {
        if (sheet === "Categories") {
          const [products, projects] = await Promise.all([
            repo.list("Products"),
            repo.list("Projects"),
          ]);
          if ([...products, ...projects].some((row) => row.categoryId === req.params.id))
            return res.status(409).json({
              success: false,
              data: null,
              message: "Cette catégorie est utilisée et ne peut pas être supprimée.",
            });
        }
        if (sheet === "Products") {
          const product = (await repo.list("Products")).find((row) => row.id === req.params.id);
          const gallery = (await repo.list("ProductImages")).filter((row) => row.productId === req.params.id);
          if (cloudReady()) {
            configure();
            const publicIds = [product?.coverImagePublicId, ...gallery.map((row) => row.imagePublicId)].map(String).filter((id) => id.startsWith(`${env.cloudinaryUploadFolder}/products/`));
            await Promise.all(publicIds.map((id) => cloudinary.uploader.destroy(id, { resource_type: "image" })));
          }
          for (const image of gallery) await repo.deleteRow("ProductImages", String(image.id));
        }
        if (sheet === "Projects") {
          const project = (await repo.list("Projects")).find((row) => row.id === req.params.id);
          const gallery = (await repo.list("ProjectImages")).filter((row) => row.projectId === req.params.id);
          if (cloudReady()) {
            configure();
            const publicIds = [project?.coverImagePublicId, ...gallery.map((row) => row.imagePublicId)]
              .map(String)
              .filter((id) => id.startsWith(`${env.cloudinaryUploadFolder}/projects/`));
            await Promise.all(publicIds.map((id) => cloudinary.uploader.destroy(id, { resource_type: "image" })));
          }
          for (const image of gallery) await repo.deleteRow("ProjectImages", String(image.id));
        }
        await repo.deleteRow(sheet, req.params.id);
        return res.json(ok(null, "Suppression réussie."));
      } catch (e) {
        next(e);
      }
    });
  }
  r.get("/admin/settings", async (_q, res, next) => {
    try {
      res.json(ok(await repo.settings()));
    } catch (e) {
      next(e);
    }
  });
  r.put("/admin/settings", async (req, res, next) => {
    try {
      res.json(
        ok(
          await repo.updateSettings(
            Object.fromEntries(
              Object.entries(req.body).map(([k, v]) => [
                k,
                String(v).slice(0, 5000),
              ]),
            ),
          ),
          "Paramètres enregistrés.",
        ),
      );
    } catch (e) {
      next(e);
    }
  });
  r.get("/admin/media/status", (_q, res) =>
    res.json(
      ok({ configured: cloudReady(), folder: env.cloudinaryUploadFolder }),
    ),
  );
  r.get("/admin/google-sheet", (_q, res) =>
    res.json(
      ok({
        url: `https://docs.google.com/spreadsheets/d/${encodeURIComponent(repo.getSpreadsheetId())}/edit`,
      }),
    ),
  );
  r.post("/admin/media/upload", upload, async (req, res, next) => {
    try {
      if (!cloudReady())
        return res.status(503).json({
          success: false,
          data: null,
          message: "Cloudinary n’est pas configuré.",
        });
      if (!req.file)
        return res
          .status(400)
          .json({ success: false, data: null, message: "Image requise." });
      const folder = String(req.body.folder || "projects");
      if (!["projects", "products", "services", "categories", "site"].includes(folder))
        return res
          .status(400)
          .json({ success: false, data: null, message: "Dossier invalide." });
      const entityType = String(req.body.entityType || ""),
        entityId = String(req.body.entityId || "");
      if (["product", "product-gallery"].includes(entityType) && entityId) {
        const [products, images] = await Promise.all([
          repo.list("Products"),
          repo.list("ProductImages"),
        ]);
        const product = products.find((row) => row.id === entityId);
        if (!product)
          return res.status(404).json({
            success: false,
            data: null,
            message: "Produit introuvable.",
          });
        const galleryCount = images.filter(
          (row) => row.productId === entityId,
        ).length;
        const total = galleryCount + (product.coverImageUrl ? 1 : 0);
        const addsImage =
          entityType === "product-gallery" || !product.coverImageUrl;
        if (addsImage && total >= maxProductImages)
          return res.status(409).json({
            success: false,
            data: null,
            message: `Un produit accepte au maximum ${maxProductImages} images.`,
          });
      }
      configure();
      const result = await new Promise<Record<string, unknown>>(
        (resolve, reject) =>
          cloudinary.uploader
            .upload_stream(
              {
                folder: `${env.cloudinaryUploadFolder}/${folder}`,
                resource_type: "image",
                format: "webp",
              },
              (e, x) => (e ? reject(e) : resolve(x as Record<string, unknown>)),
            )
            .end(req.file!.buffer),
      );
      const imageUrl = String(result.secure_url || ""),
        imagePublicId = String(result.public_id || "");
      try {
        if (entityType === "product-gallery" && entityId)
          await repo.createRow("ProductImages", { productId: entityId, imageUrl, imagePublicId, altText: String(req.body.altText || ""), displayOrder: Number(req.body.displayOrder || 0) });
        else if (entityType === "product" && entityId)
          await repo.updateRow("Products", entityId, { coverImageUrl: imageUrl, coverImagePublicId: imagePublicId });
        else if (entityType === "project-gallery" && entityId)
          await repo.createRow("ProjectImages", {
            projectId: entityId,
            imageUrl,
            imagePublicId,
            altText: String(req.body.altText || ""),
            displayOrder: Number(req.body.displayOrder || 0),
          });
        else if (entityType === "project" && entityId)
          await repo.updateRow("Projects", entityId, {
            coverImageUrl: imageUrl,
            coverImagePublicId: imagePublicId,
          });
        else if (entityType === "service" && entityId)
          await repo.updateRow("Services", entityId, {
            imageUrl,
            imagePublicId,
          });
        else if (entityType === "category" && entityId)
          await repo.updateRow("Categories", entityId, {
            imageUrl,
            imagePublicId,
          });
      } catch (error) {
        await cloudinary.uploader
          .destroy(imagePublicId, { resource_type: "image" })
          .catch(() => undefined);
        throw error;
      }
      return res.json(ok({ imageUrl, imagePublicId }));
    } catch (e) {
      next(e);
    }
  });
  r.delete("/admin/media", async (req, res, next) => {
    try {
      const id = String(req.body?.publicId || ""),
        sheet = String(req.body?.sheet || "") as Exclude<SheetName, "Settings">,
        allowedFolder: Partial<Record<Exclude<SheetName, "Settings">, string>> = {
          ProductImages: "products",
          Products: "products",
          ProjectImages: "projects",
          Projects: "projects",
          Services: "services",
          Categories: "categories",
        },
        folder = allowedFolder[sheet];
      if (!folder || !id.startsWith(`${env.cloudinaryUploadFolder}/${folder}/`))
        return res.status(400).json({
          success: false,
          data: null,
          message: "Référence image invalide.",
        });
      if (!cloudReady())
        return res.status(503).json({
          success: false,
          data: null,
          message: "Cloudinary n’est pas configuré.",
        });
      configure();
      const result = await cloudinary.uploader.destroy(id, {
        resource_type: "image",
      });
      if (result.result !== "ok" && result.result !== "not found")
        throw new Error("Suppression Cloudinary impossible.");
      const recordId = String(req.body?.recordId || "");
      if (sheet === "ProductImages" && recordId)
        await repo.deleteRow("ProductImages", recordId);
      else if (sheet === "Products" && recordId)
        await repo.updateRow("Products", recordId, { coverImageUrl: "", coverImagePublicId: "" });
      else if (sheet === "ProjectImages" && recordId)
        await repo.deleteRow("ProjectImages", recordId);
      else if (sheet === "Projects" && recordId)
        await repo.updateRow("Projects", recordId, {
          coverImageUrl: "",
          coverImagePublicId: "",
        });
      else if (sheet === "Services" && recordId)
        await repo.updateRow("Services", recordId, {
          imageUrl: "",
          imagePublicId: "",
        });
      else if (sheet === "Categories" && recordId)
        await repo.updateRow("Categories", recordId, {
          imageUrl: "",
          imagePublicId: "",
        });
      return res.json(ok(null, "Image supprimée."));
    } catch (e) {
      next(e);
    }
  });
  return r;
}
