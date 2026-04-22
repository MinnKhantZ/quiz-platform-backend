import prisma from "../config/db.js";
import { AppError } from "../middleware/errorHandler.js";
import { TimerType } from "@prisma/client";

interface QuizFilter {
  teacherId?: string;
  published?: boolean;
}

interface PaginationInput {
  page?: number;
  limit?: number;
}

interface QuizData {
  title?: string;
  description?: string | null;
  category?: string | null;
  timerType?: TimerType;
  timerSeconds?: number | null;
  isPublished?: boolean;
}

export async function createQuiz(teacherId: string, data: QuizData & { title: string }) {
  return prisma.quiz.create({
    data: { ...data, teacherId },
    include: { questions: true },
  });
}

export async function getQuizzes(
  { teacherId, published }: QuizFilter = {},
  { page = 1, limit = 20 }: PaginationInput = {}
) {
  const where: { teacherId?: string; isPublished?: boolean } = {};
  if (teacherId) where.teacherId = teacherId;
  if (published !== undefined) where.isPublished = published;

  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);
  const skip = (safePage - 1) * safeLimit;

  return prisma.quiz.findMany({
    where,
    take: safeLimit,
    skip,
    include: {
      teacher: { select: { id: true, name: true } },
      _count: { select: { questions: true, attempts: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getQuizById(id: string, includeAnswers = false) {
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          type: true,
          text: true,
          imageUrl: true,
          options: true,
          correctAnswer: includeAnswers,
          order: true,
          points: true,
        },
      },
      teacher: { select: { id: true, name: true } },
      _count: { select: { questions: true, attempts: true } },
    },
  });
  if (!quiz) throw new AppError("Quiz not found", 404);
  return quiz;
}

export async function updateQuiz(id: string, teacherId: string, data: QuizData) {
  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz) throw new AppError("Quiz not found", 404);
  if (quiz.teacherId !== teacherId) throw new AppError("Not authorized", 403);

  return prisma.quiz.update({
    where: { id },
    data,
    include: { questions: { orderBy: { order: "asc" } } },
  });
}

export async function deleteQuiz(id: string, teacherId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id } });
  if (!quiz) throw new AppError("Quiz not found", 404);
  if (quiz.teacherId !== teacherId) throw new AppError("Not authorized", 403);

  return prisma.quiz.delete({ where: { id } });
}
