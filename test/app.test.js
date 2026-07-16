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
