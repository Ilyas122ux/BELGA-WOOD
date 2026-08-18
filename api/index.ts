import type { Request, Response } from "express";
import { createApp } from "../server/src/app.js";
import { GoogleSheetsBelgaRepository } from "../server/src/belga/GoogleSheetsBelgaRepository.js";
import { restoreRewrittenPath } from "./_rewrite.js";

type App = ReturnType<typeof createApp>;
let appPromise: Promise<App> | undefined;

function getApp() {
  appPromise ??= Promise.resolve().then(async () => {
    const repository = new GoogleSheetsBelgaRepository();
    await repository.initialize();
    return createApp(repository);
  });
  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  restoreRewrittenPath(req);
  try {
    const app = await getApp();
    return app(req, res);
  } catch (error) {
    appPromise = undefined;
    console.error("[vercel-api] initialization failed", error);
    return res.status(503).json({
      success: false,
      data: null,
      message: "Le service est momentanément indisponible.",
    });
  }
}
