import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("7d"),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  UPLOAD_DIR: z.string().default("uploads"),
});

const env = envSchema.parse(process.env);

export default env;
