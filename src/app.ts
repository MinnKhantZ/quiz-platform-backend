import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import env from "./config/env.js";
import prisma from "./config/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiRateLimiter } from "./middleware/rateLimit.js";
import { requestContext } from "./middleware/requestContext.js";
import { setupSocket } from "./socket/index.js";
import logger from "./utils/logger.js";

import authRoutes from "./routes/auth.routes.js";
import quizRoutes from "./routes/quiz.routes.js";
import questionRoutes from "./routes/question.routes.js";
import attemptRoutes from "./routes/attempt.routes.js";
import leaderboardRoutes from "./routes/leaderboard.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
const server = createServer(app);

if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

// Socket.io
const io = new Server(server, {
  cors: { origin: env.CORS_ORIGIN, methods: ["GET", "POST"] },
});
setupSocket(io);

// Middleware
app.use(requestContext);
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed"));
    },
  })
);
app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.URLENCODED_BODY_LIMIT }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info({
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
});

app.use("/api", apiRateLimiter);

// Static files for uploads
app.use("/uploads", express.static(path.join(__dirname, "..", env.UPLOAD_DIR)));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api", questionRoutes);
app.use("/api", attemptRoutes);
app.use("/api/quizzes", leaderboardRoutes);
app.use("/api/upload", uploadRoutes);

// Health check
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  } catch {
    res.status(503).json({
      status: "degraded",
      timestamp: new Date().toISOString(),
    });
  }
});

// Error handler
app.use(errorHandler);

// Start server
server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "Server started");
});

function shutdown(signal: "SIGINT" | "SIGTERM"): void {
  logger.info({ signal }, "Shutting down server");
  io.close(() => {
    server.close(async (error) => {
      await prisma.$disconnect();
      if (error) {
        logger.error({ err: error }, "Error while closing HTTP server");
        process.exit(1);
      }
      logger.info("HTTP server closed");
      process.exit(0);
    });
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export default app;
