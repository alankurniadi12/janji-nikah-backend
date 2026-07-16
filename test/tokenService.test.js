import assert from "node:assert/strict";
import test from "node:test";

import {
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} from "../src/services/tokenService.js";
import { AppError } from "../src/utils/AppError.js";

const user = {
  _id: {
    toString: () => "507f1f77bcf86cd799439011"
  },
  role: "member"
};

test("creates and verifies access tokens", () => {
  const token = createAccessToken(user);
  const payload = verifyAccessToken(token);

  assert.equal(payload.sub, "507f1f77bcf86cd799439011");
  assert.equal(payload.role, "member");
  assert.equal(payload.type, "access");
});

test("creates and verifies refresh tokens", () => {
  const token = createRefreshToken(user);
  const payload = verifyRefreshToken(token);

  assert.equal(payload.sub, "507f1f77bcf86cd799439011");
  assert.equal(payload.type, "refresh");
});

test("rejects refresh token when access token is required", () => {
  const token = createRefreshToken(user);

  assert.throws(() => verifyAccessToken(token), AppError);
});
