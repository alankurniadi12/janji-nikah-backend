import multer from "multer";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

export function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return new AppError(
        413,
        `Ukuran file terlalu besar. Maksimal ${env.maxImageSizeMb} MB per file. Kompres gambar atau pilih file lain, lalu upload ulang.`
      );
    }

    return new AppError(400, "File upload tidak valid. Periksa file yang dipilih, lalu coba lagi.");
  }

  if (error.name === "ValidationError") {
    return new AppError(400, "Data tidak valid.", {
      details: Object.values(error.errors).map((item) => item.message)
    });
  }

  if (error.code === 11000) {
    return new AppError(409, "Data sudah digunakan.", {
      fields: Object.keys(error.keyPattern || {})
    });
  }

  if (error.name === "CastError") {
    return new AppError(400, "Format ID tidak valid.");
  }

  return new AppError(500, "Terjadi kesalahan pada server.");
}

export function errorHandler(error, req, res, next) {
  const normalizedError = normalizeError(error);
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction && normalizedError.statusCode >= 500) {
    console.error(error);
  }

  res.status(normalizedError.statusCode).json({
    success: false,
    message: normalizedError.message,
    ...(normalizedError.meta ? { meta: normalizedError.meta } : {}),
    ...(!isProduction && normalizedError.statusCode >= 500 ? { stack: error.stack } : {})
  });
}
