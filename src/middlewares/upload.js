import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import multer from "multer";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const allowedImages = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

const allowedAudio = new Map([
  ["audio/mpeg", ".mp3"],
  ["audio/mp3", ".mp3"]
]);

export function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function createSafeFilename(file, allowedTypes) {
  const extension = allowedTypes.get(file.mimetype);
  return `${crypto.randomUUID()}${extension}`;
}

export function createImageUpload(destinationResolver) {
  const storage = multer.diskStorage({
    destination(req, file, cb) {
      try {
        const destination = destinationResolver(req);
        ensureDirectory(destination);
        cb(null, destination);
      } catch (error) {
        cb(error);
      }
    },
    filename(req, file, cb) {
      cb(null, createSafeFilename(file, allowedImages));
    }
  });

  return multer({
    storage,
    limits: {
      fileSize: env.maxImageSizeMb * 1024 * 1024
    },
    fileFilter(req, file, cb) {
      if (!allowedImages.has(file.mimetype)) {
        cb(new AppError(400, "Format gambar harus JPG, PNG, atau WebP."));
        return;
      }

      cb(null, true);
    }
  });
}

export function createAudioUpload(destinationResolver) {
  const storage = multer.diskStorage({
    destination(req, file, cb) {
      try {
        const destination = destinationResolver(req);
        ensureDirectory(destination);
        cb(null, destination);
      } catch (error) {
        cb(error);
      }
    },
    filename(req, file, cb) {
      cb(null, createSafeFilename(file, allowedAudio));
    }
  });

  return multer({
    storage,
    limits: {
      fileSize: env.maxAudioSizeMb * 1024 * 1024
    },
    fileFilter(req, file, cb) {
      if (!allowedAudio.has(file.mimetype)) {
        cb(new AppError(400, "Format musik harus MP3."));
        return;
      }

      cb(null, true);
    }
  });
}

export function createMemoryImageUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: env.maxImageSizeMb * 1024 * 1024
    },
    fileFilter(req, file, cb) {
      if (!allowedImages.has(file.mimetype)) {
        cb(new AppError(400, "Format gambar harus JPG, PNG, atau WebP."));
        return;
      }

      cb(null, true);
    }
  });
}

export function resolveUploadPath(...segments) {
  return path.join(env.uploadDir, ...segments);
}
