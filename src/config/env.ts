import { z } from "zod";

const boolFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  TRUST_PROXY: boolFromEnv.default(false),
  JSON_BODY_LIMIT: z.string().default("1mb"),
  URLENCODED_BODY_LIMIT: z.string().default("1mb"),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(60_000),
  API_RATE_LIMIT_MAX: z.coerce.number().positive().default(120),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(15 * 60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().positive().default(10),
  UPLOAD_RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(60_000),
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().positive().default(20),
  UPLOAD_DIR: z.string().default("uploads"),
});

const env = envSchema.parse(process.env);

export default env;
