import assert from "node:assert/strict";
import test from "node:test";

import multer from "multer";

import { normalizeError } from "../src/middlewares/errorHandler.js";

test("normalizes oversized upload errors to actionable 413 response", () => {
  const error = normalizeError(new multer.MulterError("LIMIT_FILE_SIZE"));

  assert.equal(error.statusCode, 413);
  assert.match(error.message, /Ukuran file terlalu besar/);
  assert.match(error.message, /Maksimal 5 MB/);
});
