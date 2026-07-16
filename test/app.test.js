import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";

async function withTestServer(callback) {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");

  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("app foundation exposes health and predictable 404 responses", async () => {
  await withTestServer(async (baseUrl) => {
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    const healthBody = await healthResponse.json();

    assert.equal(healthResponse.status, 200);
    assert.equal(healthBody.success, true);
    assert.equal(healthBody.data.service, "janji-nikah-backend");

    const notFoundResponse = await fetch(`${baseUrl}/api/unknown`);
    const notFoundBody = await notFoundResponse.json();

    assert.equal(notFoundResponse.status, 404);
    assert.equal(notFoundBody.success, false);
    assert.equal(notFoundBody.message, "Endpoint tidak ditemukan.");
  });
});

test("auth routes return predictable validation errors", async () => {
  await withTestServer(async (baseUrl) => {
    const googleResponse = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });
    const googleBody = await googleResponse.json();

    assert.equal(googleResponse.status, 400);
    assert.equal(googleBody.success, false);
    assert.equal(googleBody.message, "Google ID token wajib dikirim.");

    const meResponse = await fetch(`${baseUrl}/api/auth/me`);
    const meBody = await meResponse.json();

    assert.equal(meResponse.status, 401);
    assert.equal(meBody.success, false);
    assert.equal(meBody.message, "Akses membutuhkan token.");
  });
});

test("dashboard routes require authentication", async () => {
  await withTestServer(async (baseUrl) => {
    const memberResponse = await fetch(`${baseUrl}/api/member/dashboard`);
    const memberBody = await memberResponse.json();

    assert.equal(memberResponse.status, 401);
    assert.equal(memberBody.message, "Akses membutuhkan token.");

    const adminResponse = await fetch(`${baseUrl}/api/admin/dashboard`);
    const adminBody = await adminResponse.json();

    assert.equal(adminResponse.status, 401);
    assert.equal(adminBody.message, "Akses membutuhkan token.");
  });
});

test("phase 4 payment routes protect member and admin operations", async () => {
  await withTestServer(async (baseUrl) => {
    const memberTransactionsResponse = await fetch(`${baseUrl}/api/member/transactions`);
    const memberTransactionsBody = await memberTransactionsResponse.json();

    assert.equal(memberTransactionsResponse.status, 401);
    assert.equal(memberTransactionsBody.message, "Akses membutuhkan token.");

    const adminTransactionsResponse = await fetch(`${baseUrl}/api/admin/transactions`);
    const adminTransactionsBody = await adminTransactionsResponse.json();

    assert.equal(adminTransactionsResponse.status, 401);
    assert.equal(adminTransactionsBody.message, "Akses membutuhkan token.");
  });
});

test("invitation builder routes require authentication", async () => {
  await withTestServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/member/invitations`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.message, "Akses membutuhkan token.");

    const photoResponse = await fetch(`${baseUrl}/api/member/invitations/id/photos/main`, {
      method: "POST"
    });
    const photoBody = await photoResponse.json();

    assert.equal(photoResponse.status, 401);
    assert.equal(photoBody.message, "Akses membutuhkan token.");

    const publishResponse = await fetch(`${baseUrl}/api/member/invitations/id/publish`, {
      method: "POST"
    });
    const publishBody = await publishResponse.json();

    assert.equal(publishResponse.status, 401);
    assert.equal(publishBody.message, "Akses membutuhkan token.");
  });
});
