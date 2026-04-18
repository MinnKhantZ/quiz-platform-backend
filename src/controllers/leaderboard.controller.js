import * as leaderboardService from "../services/leaderboard.service.js";

export async function analytics(req, res, next) {
  try {
    const data = await leaderboardService.getQuizAnalytics(req.params.quizId, req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function leaderboard(req, res, next) {
  try {
    const data = await leaderboardService.getLeaderboard(req.params.quizId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
