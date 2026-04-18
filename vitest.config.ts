import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      JWT_SECRET: "test-secret-for-vitest-at-least-32-chars",
      JWT_EXPIRES_IN: "7d",
      PORT: "3001",
      CORS_ORIGIN: "http://localhost:5173",
      UPLOAD_DIR: "uploads",
    },
  },
});
