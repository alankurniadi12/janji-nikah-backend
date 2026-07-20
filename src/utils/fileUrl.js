import path from "node:path";

import { env } from "../config/env.js";

export function toUploadUrl(filePath) {
  const relativePath = path.relative(env.uploadDir, filePath).split(path.sep).join("/");
  return `/uploads/${relativePath}`;
}

export function toAbsoluteUploadUrl(publicUrl) {
  if (!publicUrl || !publicUrl.startsWith("/uploads/")) {
    return publicUrl || "";
  }

  return `${env.apiUrl.replace(/\/$/, "")}${publicUrl}`;
}

export function toRelativeUploadUrl(publicUrl) {
  if (!publicUrl) {
    return "";
  }

  try {
    const url = new URL(publicUrl);
    return url.pathname.startsWith("/uploads/") ? url.pathname : publicUrl;
  } catch {
    return publicUrl;
  }
}
