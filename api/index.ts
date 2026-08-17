import type { Request, Response } from "express";
import { createApp } from "../server/src/app.js";
import { GoogleSheetsBelgaRepository } from "../server/src/belga/GoogleSheetsBelgaRepository.js";
import { restoreRewrittenPath } from "./_rewrite.js";

const repository = new GoogleSheetsBelgaRepository();
const appPromise = repository.initialize().then(() => createApp(repository));

export default async function handler(req: Request, res: Response) {
  restoreRewrittenPath(req);
  const app = await appPromise;
  return app(req, res);
}
