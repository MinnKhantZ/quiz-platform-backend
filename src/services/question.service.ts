import prisma from "../config/db.js";
import { AppError } from "../middleware/errorHandler.js";
import { QuestionType } from "@prisma/client";

interface QuestionData {
  type?: QuestionType;
  text?: string;
  imageUrl?: string | null;
  options?: Array<{ text: string; isCorrect: boolean }> | null;
  correctAnswer?: string | null;
  points?: number;
}

export async function addQuestion(quizId: string, teacherId: string, data: QuestionData) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw new AppError("Quiz not found", 404);
  if (quiz.teacherId !== teacherId) throw new AppError("Not authorized", 403);

  const maxOrder = await prisma.question.aggregate({
    where: { quizId },
    _max: { order: true },
  });

  return prisma.question.create({
    data: {
      ...(data as {
        type: QuestionType;
        text: string;
        imageUrl?: string | null;
        options?: Array<{ text: string; isCorrect: boolean }> | null;
        correctAnswer?: string | null;
        points?: number;
      }),
      quizId,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
}

export async function updateQuestion(id: string, teacherId: string, data: QuestionData) {
  const question = await prisma.question.findUnique({
    where: { id },
    include: { quiz: { select: { teacherId: true } } },
  });
  if (!question) throw new AppError("Question not found", 404);
  if (question.quiz.teacherId !== teacherId) throw new AppError("Not authorized", 403);

  return prisma.question.update({ where: { id }, data });
}

export async function deleteQuestion(id: string, teacherId: string) {
  const question = await prisma.question.findUnique({
    where: { id },
    include: { quiz: { select: { teacherId: true } } },
  });
  if (!question) throw new AppError("Question not found", 404);
  if (question.quiz.teacherId !== teacherId) throw new AppError("Not authorized", 403);

  return prisma.question.delete({ where: { id } });
}

export async function reorderQuestions(quizId: string, teacherId: string, questionIds: string[]) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw new AppError("Quiz not found", 404);
  if (quiz.teacherId !== teacherId) throw new AppError("Not authorized", 403);

  const updates = questionIds.map((qId, index) =>
    prisma.question.update({ where: { id: qId }, data: { order: index } })
  );

  return prisma.$transaction(updates);
}
