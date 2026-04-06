import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  app.get("/health/ready", async () => {
    return { status: "ready", timestamp: new Date().toISOString() };
  });
}
