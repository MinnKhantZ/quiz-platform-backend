import prisma from "../config/db.js";
import { AppError } from "../middleware/errorHandler.js";
import { TimerType } from "@prisma/client";

interface QuizFilter {
  teacherId?: string;
  published?: boolean;
}

interface QuizData {
  title?: string;
  description?: string | null;
  category?: string | null;
  timerType?: TimerType;
  timerSeconds?: number | null;
  isPublished?: boolean;
}

export async function createQuiz(teacherId: string, data: QuizData) {
  return prisma.quiz.create({
    data: { ...data, teacherId },
    include: { questions: true },
  });
}

export async function getQuizzes({ teacherId, published }: QuizFilter = {}) {
  const where: { teacherId?: string; isPublished?: boolean } = {};
  if (teacherId) where.teacherId = teacherId;
  if (published !== undefined) where.isPublished = published;

  return prisma.quiz.findMany({
    where,
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
