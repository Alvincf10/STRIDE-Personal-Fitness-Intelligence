import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_USERNAME: z.string().min(1).default("owner"),
  APP_PASSWORD: z.string().min(1).default("change-me"),
  AUTH_SECRET: z
    .string()
    .min(16)
    .default("dev-only-auth-secret-change-me"),
  MONGODB_URI: z
    .string()
    .min(1)
    .default("mongodb://127.0.0.1:27017/garmin_fitness"),
  ENCRYPTION_KEY: z.string().optional().default(""),
  GARMIN_API_BASE_URL: z
    .string()
    .optional()
    .default("https://personal.connectapi.garmin.com"),
  SYNC_ACTIVITIES_INTERVAL_MINUTES: z.coerce.number().int().positive().default(30),
  SYNC_HEALTH_INTERVAL_MINUTES: z.coerce.number().int().positive().default(120),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}
