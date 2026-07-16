import assert from "node:assert/strict";
import test from "node:test";

import { toPublicMusic, toPublicTheme } from "../src/services/catalogService.js";

test("formats theme for API responses", () => {
  const theme = toPublicTheme({
    _id: { toString: () => "theme-id" },
    name: "Klasik",
    key: "klasik",
    thumbnailUrl: "/uploads/theme.webp",
    isActive: true,
    isPublicDemo: false
  });

  assert.equal(theme.id, "theme-id");
  assert.equal(theme.key, "klasik");
});

test("formats music for API responses", () => {
  const music = toPublicMusic({
    _id: { toString: () => "music-id" },
    title: "Akad Syahdu",
    category: "akad",
    duration: 120,
    fileUrl: "/uploads/music/akad.mp3",
    isActive: true
  });

  assert.equal(music.id, "music-id");
  assert.equal(music.title, "Akad Syahdu");
});
