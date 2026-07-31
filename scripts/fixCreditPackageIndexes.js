import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import CreditPackage from "../src/models/CreditPackage.js";

async function dropIndexIfExists(indexName) {
  const indexes = await CreditPackage.collection.indexes();
  const hasIndex = indexes.some((index) => index.name === indexName);

  if (!hasIndex) {
    console.log(`${indexName} not found.`);
    return;
  }

  await CreditPackage.collection.dropIndex(indexName);
  console.log(`Dropped ${indexName}.`);
}

await connectDatabase();

try {
  await dropIndexIfExists("creditAmount_1");
  await CreditPackage.syncIndexes();
  console.log("Credit package indexes are synced.");
} finally {
  await disconnectDatabase();
}
