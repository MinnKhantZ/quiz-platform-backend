import prisma from "../config/db.js";
import { AppError } from "../middleware/errorHandler.js";

export async function getQuizAnalytics(quizId: string, teacherId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw new AppError("Quiz not found", 404);
  if (quiz.teacherId !== teacherId) throw new AppError("Not authorized", 403);

  const attempts = await prisma.attempt.findMany({
    where: { quizId, completedAt: { not: null } },
    include: {
      student: { select: { id: true, name: true, email: true } },
      answers: true,
    },
    orderBy: { completedAt: "desc" },
  });

  const totalAttempts = attempts.length;
  if (totalAttempts === 0) {
    return {
      totalAttempts: 0,
      averageScore: 0,
      averagePercentage: 0,
      scoreDistribution: [],
      questionStats: [],
      recentAttempts: [],
    };
  }

  const averageScore = attempts.reduce((s, a) => s + a.score, 0) / totalAttempts;
  const averagePercentage = attempts.reduce((s, a) => s + a.percentage, 0) / totalAttempts;

  // Score distribution buckets: 0-20, 21-40, 41-60, 61-80, 81-100
  const buckets = [0, 0, 0, 0, 0];
  for (const a of attempts) {
    const idx = Math.min(Math.floor(a.percentage / 20), 4);
    buckets[idx]++;
  }
  const scoreDistribution = [
    { range: "0-20%", count: buckets[0] },
    { range: "21-40%", count: buckets[1] },
    { range: "41-60%", count: buckets[2] },
    { range: "61-80%", count: buckets[3] },
    { range: "81-100%", count: buckets[4] },
  ];

  // Per-question accuracy
  const questions = await prisma.question.findMany({
    where: { quizId },
    orderBy: { order: "asc" },
  });

  const questionStats = questions.map((q) => {
    const allAnswers = attempts.flatMap((a) => a.answers.filter((ans) => ans.questionId === q.id));
    const correct = allAnswers.filter((a) => a.isCorrect).length;
    return {
      questionId: q.id,
      text: q.text,
      totalAnswers: allAnswers.length,
      correctAnswers: correct,
      accuracy: allAnswers.length > 0 ? (correct / allAnswers.length) * 100 : 0,
    };
  });

  return {
    totalAttempts,
    averageScore: Math.round(averageScore * 100) / 100,
    averagePercentage: Math.round(averagePercentage * 100) / 100,
    scoreDistribution,
    questionStats,
    recentAttempts: attempts.slice(0, 20).map((a) => ({
      id: a.id,
      student: a.student,
      score: a.score,
      totalPoints: a.totalPoints,
      percentage: a.percentage,
      timeTaken: a.timeTaken,
      completedAt: a.completedAt,
    })),
  };
}

export async function getLeaderboard(quizId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw new AppError("Quiz not found", 404);

  // Best attempt per student (highest score, then lowest time)
  const attempts = await prisma.attempt.findMany({
    where: { quizId, completedAt: { not: null } },
    include: { student: { select: { id: true, name: true } } },
    orderBy: [{ score: "desc" }, { timeTaken: "asc" }],
  });

  // Keep only best attempt per student
  const seen = new Set<string>();
  const leaderboard: Array<{
    rank: number;
    student: { id: string; name: string };
    score: number;
    totalPoints: number;
    percentage: number;
    timeTaken: number;
    completedAt: Date | null;
  }> = [];

  for (const attempt of attempts) {
    if (!seen.has(attempt.studentId)) {
      seen.add(attempt.studentId);
      leaderboard.push({
        rank: leaderboard.length + 1,
        student: attempt.student,
        score: attempt.score,
        totalPoints: attempt.totalPoints,
        percentage: attempt.percentage,
        timeTaken: attempt.timeTaken,
        completedAt: attempt.completedAt,
      });
    }
  }

  return leaderboard;
}
