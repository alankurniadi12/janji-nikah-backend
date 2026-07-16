import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

async function startServer() {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`Janji Nikah API running on port ${env.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received. Shutting down Janji Nikah API.`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch((error) => {
  console.error("Failed to start Janji Nikah API", error);
  process.exit(1);
});
