import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  generatePromoCaption,
  normalizeBrandingName,
  renderPromoSvg,
  toPublicBrandingProfile
} from "../src/services/brandingService.js";

test("normalizes branding names for duplicate checks", () => {
  assert.equal(normalizeBrandingName("  Janji.Nikah  Studio! "), "janji nikah studio");
});

test("formats branding profile without exposing normalized business name", () => {
  const profile = toPublicBrandingProfile({
    _id: { toString: () => "branding-id" },
    memberId: { toString: () => "member-id" },
    businessName: "Ayu Wedding",
    normalizedBusinessName: "ayu wedding",
    instagram: "@ayu",
    facebook: "",
    tiktok: "",
    whatsapp: "+628123",
    selectedTemplate: "elegant",
    promoAssets: {
      squareImageUrl: "/uploads/square.webp"
    }
  });

  assert.equal(profile.id, "branding-id");
  assert.equal(profile.memberId, "member-id");
  assert.equal(profile.normalizedBusinessName, undefined);
  assert.equal(profile.promoAssets.squareImageUrl, "/uploads/square.webp");
});

test("generates Indonesian promo caption with contact details", () => {
  const caption = generatePromoCaption({
    businessName: "Ayu Wedding",
    instagram: "@ayu",
    whatsapp: "+628123"
  });

  assert.match(caption, /Ayu Wedding/);
  assert.match(caption, /Konsultasi: \+628123/);
  assert.match(caption, /Instagram: @ayu/);
});

test("renders promo SVG that sharp can parse", async () => {
  const svg = renderPromoSvg(
    {
      businessName: "Ayu Wedding",
      whatsapp: "+628123",
      instagram: "@ayu",
      selectedTemplate: "modern"
    },
    {},
    { width: 1080, height: 1080 },
    "square"
  );
  const metadata = await sharp(Buffer.from(svg)).metadata();

  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 1080);
});
