import path from "node:path";
import dotenv from "dotenv";

const cwd = process.cwd();
export const projectRoot =
  path.basename(cwd) === "server" ? path.resolve(cwd, "..") : cwd;
export const serverRoot = path.join(projectRoot, "server");
dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(serverRoot, ".env") });
const production = process.env.NODE_ENV === "production";
const configuredSiteUrl = process.env.SITE_URL || process.env.CLIENT_URL || "";
export const productionSiteUrl = (() => {
  try {
    const url = new URL(configuredSiteUrl);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return "";
    return url.origin;
  } catch {
    return "";
  }
})();

export const paths = {
  clientDist: path.resolve(serverRoot, "../client/dist"),
};
export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: production,
  catalogueBackend: "google-sheets" as const,
  clientUrl:
    process.env.SITE_URL || process.env.CLIENT_URL || "http://localhost:5173",
  publicSiteUrl: productionSiteUrl,
  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || "",
  sessionSecret: process.env.SESSION_SECRET || "",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  cloudinaryUploadFolder: process.env.CLOUDINARY_FOLDER || "belga-wood",
  googleSheetsSpreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "",
  googleServiceAccountJsonBase64:
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 || "",
};
if (
  production &&
  (!env.adminEmail || !env.adminPasswordHash || env.sessionSecret.length < 32)
)
  throw new Error(
    "ADMIN_EMAIL, ADMIN_PASSWORD et SESSION_SECRET (32 caractères minimum) sont requis en production.",
  );
if (
  production &&
  (!env.googleSheetsSpreadsheetId || !env.googleServiceAccountJsonBase64)
)
  throw new Error(
    "GOOGLE_SHEETS_SPREADSHEET_ID et GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 sont requis en production.",
  );
if (
  env.cloudinaryUploadFolder !== "belga-wood" &&
  !env.cloudinaryUploadFolder.startsWith("belga-wood/")
)
  throw new Error("CLOUDINARY_FOLDER doit rester dans belga-wood.");
