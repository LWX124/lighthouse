import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  ANTHROPIC_API_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
});

export interface AppConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  redisUrl: string;
  anthropicApiKey: string;
  port: number;
}

export function loadConfig(): AppConfig {
  const parsed = envSchema.parse(process.env);
  return {
    supabaseUrl: parsed.SUPABASE_URL,
    supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
    redisUrl: parsed.REDIS_URL,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
    port: parsed.PORT,
  };
}
