import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import morgan from "morgan";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import env from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { setupSocket } from "./socket/index.js";

import authRoutes from "./routes/auth.routes.js";
import quizRoutes from "./routes/quiz.routes.js";
import questionRoutes from "./routes/question.routes.js";
import attemptRoutes from "./routes/attempt.routes.js";
import leaderboardRoutes from "./routes/leaderboard.routes.js";
import uploadRoutes from "./routes/upload.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);

// Socket.io
const io = new Server(server, {
  cors: { origin: env.CORS_ORIGIN, methods: ["GET", "POST"] },
});
setupSocket(io);

// Middleware
app.use(morgan("dev"));
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Start server
server.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

export default app;
