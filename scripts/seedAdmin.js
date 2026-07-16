import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { env } from "../src/config/env.js";
import User from "../src/models/User.js";
import { createAvailableUsername } from "../src/services/usernameService.js";

async function seedAdmin() {
  if (!env.adminEmail) {
    throw new Error("ADMIN_EMAIL wajib diisi untuk membuat admin.");
  }

  const existingAdmin = await User.findOne({ email: env.adminEmail.toLowerCase() });

  if (existingAdmin) {
    existingAdmin.name = env.adminName;
    existingAdmin.role = "admin";
    existingAdmin.status = "active";
    existingAdmin.username =
      existingAdmin.username || (await createAvailableUsername(env.adminName, env.adminEmail));
    existingAdmin.termsAcceptedAt = existingAdmin.termsAcceptedAt || new Date();
    await existingAdmin.save();

    console.log(`Admin updated: ${existingAdmin.email}`);
    return;
  }

  const username = await createAvailableUsername(env.adminName, env.adminEmail);
  const admin = await User.create({
    email: env.adminEmail.toLowerCase(),
    name: env.adminName,
    role: "admin",
    status: "active",
    username,
    termsAcceptedAt: new Date()
  });

  console.log(`Admin created: ${admin.email}`);
}

await connectDatabase();

try {
  await seedAdmin();
} finally {
  await disconnectDatabase();
}
