import { createHash, timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const MIDTRANS_BASE_URLS = {
  sandbox: {
    api: "https://api.sandbox.midtrans.com",
    snap: "https://app.sandbox.midtrans.com"
  },
  production: {
    api: "https://api.midtrans.com",
    snap: "https://app.midtrans.com"
  }
};

export class MidtransApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "MidtransApiError";
    this.statusCode = statusCode;
  }
}

export function getMidtransBaseUrls() {
  return MIDTRANS_BASE_URLS[env.midtransEnv] || MIDTRANS_BASE_URLS.sandbox;
}

export function assertMidtransConfigured() {
  if (!env.midtransServerKey) {
    throw new AppError(503, "Konfigurasi Midtrans belum tersedia di server.");
  }
}

export function createMidtransSignature({ orderId, statusCode, grossAmount }) {
  assertMidtransConfigured();
  return createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${env.midtransServerKey}`)
    .digest("hex");
}

export function isValidMidtransSignature(payload = {}) {
  if (!payload.signature_key || !payload.order_id || !payload.status_code || !payload.gross_amount) {
    return false;
  }

  const expectedSignature = createMidtransSignature({
    orderId: payload.order_id,
    statusCode: payload.status_code,
    grossAmount: payload.gross_amount
  });

  const actual = Buffer.from(payload.signature_key, "hex");
  const expected = Buffer.from(expectedSignature, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createMidtransSnapTransaction(payload) {
  const data = await midtransFetch("snap", "/snap/v1/transactions", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return {
    token: data.token || "",
    redirectUrl: data.redirect_url || ""
  };
}

export async function getMidtransTransactionStatus(orderIdOrTransactionId) {
  return midtransFetch("api", `/v2/${encodeURIComponent(orderIdOrTransactionId)}/status`);
}

async function midtransFetch(baseType, path, options = {}) {
  assertMidtransConfigured();

  const baseUrls = getMidtransBaseUrls();
  const authString = Buffer.from(`${env.midtransServerKey}:`).toString("base64");
  const headers = {
    Accept: "application/json",
    Authorization: `Basic ${authString}`,
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(`${baseUrls[baseType]}${path}`, {
    ...options,
    headers
  });
  const body = await readMidtransBody(response);
  const statusCode = Number(body?.status_code || response.status);

  if (!response.ok || statusCode >= 400) {
    if (env.nodeEnv !== "production") {
      console.error("Midtrans API error response", {
        statusCode,
        statusMessage: body?.status_message,
        errorMessages: body?.error_messages || null
      });
    }

    throw new MidtransApiError(
      body?.status_message || body?.error_messages?.join(", ") || `Midtrans API error ${response.status}`,
      statusCode
    );
  }

  return body;
}

async function readMidtransBody(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new MidtransApiError("Respons Midtrans tidak valid.", response.status);
  }
}
