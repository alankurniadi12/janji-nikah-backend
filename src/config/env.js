import dotenv from "dotenv";

dotenv.config();

const requiredKeys = [
  "MONGODB_URI",
  "JWT_SECRET",
  "COOKIE_SECRET"
];

function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toList(value) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readEnv() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isTest = nodeEnv === "test";
  const port = toInteger(process.env.PORT, 5000);
  const appUrl = process.env.APP_URL || "http://localhost:5173";
  const missingKeys = requiredKeys.filter((key) => !process.env[key]);

  if (missingKeys.length > 0 && !isTest) {
    throw new Error(`Missing required environment variables: ${missingKeys.join(", ")}`);
  }

  return {
    nodeEnv,
    port,
    mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/janji-nikah-test",
    appUrl,
    clientUrls: Array.from(new Set([appUrl, ...toList(process.env.CLIENT_URLS)])),
    apiUrl: process.env.API_URL || `http://localhost:${port}`,
    jwtSecret: process.env.JWT_SECRET || "test_jwt_secret",
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    cookieSecret: process.env.COOKIE_SECRET || "test_cookie_secret",
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    googleCallbackUrl:
      process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/google/callback",
    uploadDir: process.env.UPLOAD_DIR || "/var/www/janji-nikah/uploads",
    maxImageSizeMb: toInteger(process.env.MAX_IMAGE_SIZE_MB, 5),
    imageMaxWidth: toInteger(process.env.IMAGE_MAX_WIDTH, 1600),
    imageQuality: toInteger(process.env.IMAGE_QUALITY, 85),
    cleanupIntervalMs: toInteger(process.env.CLEANUP_INTERVAL_MS, 6 * 60 * 60 * 1000),
    adminEmail: process.env.ADMIN_EMAIL || "",
    adminName: process.env.ADMIN_NAME || "Admin Janji Nikah"
  };
}

export const env = readEnv();
