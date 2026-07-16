import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import CreditPackage from "../src/models/CreditPackage.js";

const defaultPackages = [
  { name: "1 Kredit", creditAmount: 1, price: 25000 },
  { name: "5 Kredit", creditAmount: 5, price: 120000 },
  { name: "10 Kredit", creditAmount: 10, price: 225000 }
];

async function seedCreditPackages() {
  for (const packageData of defaultPackages) {
    await CreditPackage.updateOne(
      { creditAmount: packageData.creditAmount },
      {
        $setOnInsert: {
          ...packageData,
          isActive: true
        }
      },
      { upsert: true }
    );
  }

  console.log("Default credit packages are ready.");
}

await connectDatabase();

try {
  await seedCreditPackages();
} finally {
  await disconnectDatabase();
}
