import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(8000),

  API_PREFIX: z
    .string()
    .default("api"),

  API_VERSION: z
    .string()
    .default("v1"),

  MONGODB_URI: z
    .string()
    .min(1),

  API_FOOTBALL_BASE_URL: z
    .string()
    .url(),

  API_FOOTBALL_KEY: z
    .string()
    .default(""),
FLASHSCORE_BASE_URL: z
  .string()
  .url()
  .default("http://127.0.0.1:8100"),

  API_FOOTBALL_LIVE_CACHE_MS:
  z.coerce
    .number()
    .int()
    .positive()
    .default(
      1_200_000
    ),

FLASHSCORE_LIVE_CACHE_MS:
  z.coerce
    .number()
    .int()
    .positive()
    .default(
      20_000
    ),
	RADAR_SCAN_INTERVAL_MS:
  z.coerce
    .number()
    .int()
    .positive()
    .default(30_000),

RADAR_SIGNAL_TTL_MS:
  z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),

	RADAR_HISTORY_TTL_MS:
  z.coerce
    .number()
    .int()
    .positive()
    .default(
      6 * 60 * 60 * 1000
    ),

RADAR_HISTORY_MAX_ITEMS:
  z.coerce
    .number()
    .int()
    .positive()
    .default(200),
	
	AUTH_JWT_SECRET: z
  .string()
  .min(32),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors
  );


  process.exit(1);
}

export const env = parsed.data;
