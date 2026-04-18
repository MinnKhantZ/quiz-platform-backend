import prisma from "../config/db.js";
import { AppError } from "../middleware/errorHandler.js";

export async function addQuestion(quizId, teacherId, data) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw new AppError("Quiz not found", 404);
  if (quiz.teacherId !== teacherId) throw new AppError("Not authorized", 403);

  const maxOrder = await prisma.question.aggregate({
    where: { quizId },
    _max: { order: true },
  });

  return prisma.question.create({
    data: {
      ...data,
      quizId,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
}

export async function updateQuestion(id, teacherId, data) {
  const question = await prisma.question.findUnique({
    where: { id },
    include: { quiz: { select: { teacherId: true } } },
  });
  if (!question) throw new AppError("Question not found", 404);
  if (question.quiz.teacherId !== teacherId) throw new AppError("Not authorized", 403);

  return prisma.question.update({ where: { id }, data });
}

export async function deleteQuestion(id, teacherId) {
  const question = await prisma.question.findUnique({
    where: { id },
    include: { quiz: { select: { teacherId: true } } },
  });
  if (!question) throw new AppError("Question not found", 404);
  if (question.quiz.teacherId !== teacherId) throw new AppError("Not authorized", 403);

  return prisma.question.delete({ where: { id } });
}

export async function reorderQuestions(quizId, teacherId, questionIds) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw new AppError("Quiz not found", 404);
  if (quiz.teacherId !== teacherId) throw new AppError("Not authorized", 403);

  const updates = questionIds.map((qId, index) =>
    prisma.question.update({ where: { id: qId }, data: { order: index } })
  );

  return prisma.$transaction(updates);
}
