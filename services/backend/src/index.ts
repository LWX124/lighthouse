import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { getRedis, closeRedis } from "./lib/redis.js";
import { registerQueues, closeQueues } from "./queues/registry.js";

async function main() {
  const config = loadConfig();

  const app = Fastify({ logger: true });

  // Routes
  await app.register(healthRoutes);

  // Initialize Redis connection
  getRedis(config.redisUrl);

  // Register queues and workers
  await registerQueues(config);

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info("Shutting down...");
    await closeQueues();
    await closeRedis();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start server
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`Backend service running on port ${config.port}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
