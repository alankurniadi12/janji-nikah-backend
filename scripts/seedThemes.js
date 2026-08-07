import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import Theme from "../src/models/Theme.js";

const defaultThemes = [
  {
    name: "Elegant Classic",
    key: "elegant-classic",
    thumbnailUrl: "",
    isPublicDemo: true
  },
  {
    name: "Modern Minimal",
    key: "modern-minimal",
    thumbnailUrl: "",
    isPublicDemo: true
  },
  {
    name: "Floral Garden",
    key: "floral-garden",
    thumbnailUrl: "",
    isPublicDemo: true
  },
  {
    name: "Islamic Soft",
    key: "islamic-soft",
    thumbnailUrl: "",
    isPublicDemo: true
  },
  {
    name: "Nusantara Heritage",
    key: "nusantara-heritage",
    thumbnailUrl: "",
    isPublicDemo: true
  },
  {
    name: "Coastal Dawn",
    key: "coastal-dawn",
    thumbnailUrl: "",
    isPublicDemo: true
  }
];

async function seedThemes() {
  for (const themeData of defaultThemes) {
    await Theme.updateOne(
      { key: themeData.key },
      {
        $setOnInsert: {
          ...themeData,
          isActive: true
        }
      },
      { upsert: true }
    );
  }

  console.log("Default invitation themes are ready.");
}

await connectDatabase();

try {
  await seedThemes();
} finally {
  await disconnectDatabase();
}
