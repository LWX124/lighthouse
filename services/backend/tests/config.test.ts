import { describe, it, expect, vi, beforeEach } from "vitest";

describe("config", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws when SUPABASE_URL is missing", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");

    const { loadConfig } = await import("../src/config.js");
    expect(() => loadConfig()).toThrow();
  });

  it("loads valid config from env", async () => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
    vi.stubEnv("PORT", "4000");

    const { loadConfig } = await import("../src/config.js");
    const config = loadConfig();

    expect(config.supabaseUrl).toBe("https://test.supabase.co");
    expect(config.supabaseServiceRoleKey).toBe("test-service-key");
    expect(config.redisUrl).toBe("redis://localhost:6379");
    expect(config.anthropicApiKey).toBe("sk-ant-test-key");
    expect(config.port).toBe(4000);
  });

  it("uses default port 3001 when PORT is not set", async () => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");

    const { loadConfig } = await import("../src/config.js");
    const config = loadConfig();
    expect(config.port).toBe(3001);
  });
});
