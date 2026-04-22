import rateLimit from "express-rate-limit";
import env from "../config/env.js";

function createRateLimiter(windowMs: number, max: number, message: string) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });
}

export const apiRateLimiter = createRateLimiter(
  env.API_RATE_LIMIT_WINDOW_MS,
  env.API_RATE_LIMIT_MAX,
  "Too many requests. Please try again later."
);

export const authRateLimiter = createRateLimiter(
  env.AUTH_RATE_LIMIT_WINDOW_MS,
  env.AUTH_RATE_LIMIT_MAX,
  "Too many authentication attempts. Please try again later."
);

export const uploadRateLimiter = createRateLimiter(
  env.UPLOAD_RATE_LIMIT_WINDOW_MS,
  env.UPLOAD_RATE_LIMIT_MAX,
  "Upload rate limit exceeded. Please slow down and try again."
);
