import { Request, Response, NextFunction } from "express";
import * as leaderboardService from "../services/leaderboard.service.js";

export async function analytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await leaderboardService.getQuizAnalytics(req.params.quizId, req.user!.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function leaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await leaderboardService.getLeaderboard(req.params.quizId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
