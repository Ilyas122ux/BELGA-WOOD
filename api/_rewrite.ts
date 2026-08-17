import type { Request } from "express";

export function restoreRewrittenPath(req: Request) {
  const url = new URL(req.url, "https://vercel.local");
  const apiPath = url.searchParams.get("__api_path");
  const rootPath = url.searchParams.get("__root_path");
  if (!apiPath && !rootPath) return;
  url.searchParams.delete("__api_path");
  url.searchParams.delete("__root_path");
  const pathname = rootPath
    ? `/${rootPath.replace(/^\/+/, "")}`
    : `/api/${String(apiPath).replace(/^\/+/, "")}`;
  const query = url.searchParams.toString();
  req.url = query ? `${pathname}?${query}` : pathname;
}
