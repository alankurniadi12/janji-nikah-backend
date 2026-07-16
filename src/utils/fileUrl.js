import path from "node:path";

import { env } from "../config/env.js";

export function toUploadUrl(filePath) {
  const relativePath = path.relative(env.uploadDir, filePath).split(path.sep).join("/");
  return `/uploads/${relativePath}`;
}
