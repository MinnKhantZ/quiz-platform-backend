import { Router } from "express";
import * as leaderboardController from "../controllers/leaderboard.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/:quizId/analytics", authenticate, requireRole("TEACHER"), leaderboardController.analytics);
router.get("/:quizId/leaderboard", authenticate, leaderboardController.leaderboard);

export default router;
