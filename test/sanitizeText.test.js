import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeGuestText } from "../src/utils/sanitizeText.js";

test("sanitizes guest submitted text", () => {
  assert.equal(sanitizeGuestText(" Halo <script>alert(1)</script><b>Andi</b> "), "Halo bAndi/b");
});

test("limits guest submitted text length", () => {
  assert.equal(sanitizeGuestText("abcdef", 3), "abc");
});
