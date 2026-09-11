import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const MAYAR_BASE_URLS = {
  sandbox: "https://api.mayar.io/hl/v2",
  production: "https://api.mayar.id/hl/v2"
};

export class MayarApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "MayarApiError";
    this.statusCode = statusCode;
  }
}

export function getMayarBaseUrl() {
  return MAYAR_BASE_URLS[env.mayarEnv] || MAYAR_BASE_URLS.sandbox;
}

export function assertMayarConfigured() {
  if (!env.mayarApiKey) {
    throw new AppError(503, "Konfigurasi Mayar belum tersedia di server.");
  }
}

export async function mayarFetch(path, options = {}) {
  assertMayarConfigured();

  const headers = {
    Authorization: `Bearer ${env.mayarApiKey}`,
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(`${getMayarBaseUrl()}${path}`, {
    ...options,
    headers
  });
  const body = await readMayarBody(response);
  const statusCode = body?.statusCode || response.status;

  if (!response.ok || statusCode >= 400) {
    throw new MayarApiError(body?.messages || body?.message || `Mayar API error ${response.status}`, statusCode);
  }

  return body.data;
}

export async function createMayarPaymentRequest(payload) {
  return mayarFetch("/payments/create", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getMayarTransactionDetail(transactionId) {
  return mayarFetch(`/transactions/${encodeURIComponent(transactionId)}`);
}

async function readMayarBody(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new MayarApiError("Respons Mayar tidak valid.", response.status);
  }
}
