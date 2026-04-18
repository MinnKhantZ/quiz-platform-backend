import prisma from "../config/db.js";
import { AppError } from "../middleware/errorHandler.js";

interface AnswerInput {
  questionId: string;
  selectedOption?: number | null;
  textAnswer?: string | null;
}

export async function startAttempt(quizId: string, studentId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          type: true,
          text: true,
          imageUrl: true,
          options: true,
          order: true,
          points: true,
        },
      },
    },
  });

  if (!quiz) throw new AppError("Quiz not found", 404);
  if (!quiz.isPublished) throw new AppError("Quiz is not published", 400);

  const attempt = await prisma.attempt.create({
    data: {
      quizId,
      studentId,
      totalPoints: quiz.questions.reduce((sum, q) => sum + q.points, 0),
    },
  });

  return {
    attempt: { id: attempt.id, startedAt: attempt.startedAt },
    quiz: {
      id: quiz.id,
      title: quiz.title,
      timerType: quiz.timerType,
      timerSeconds: quiz.timerSeconds,
    },
    questions: quiz.questions,
  };
}

export async function submitAttempt(attemptId: string, studentId: string, answers: AnswerInput[]) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { quiz: { include: { questions: true } } },
  });

  if (!attempt) throw new AppError("Attempt not found", 404);
  if (attempt.studentId !== studentId) throw new AppError("Not authorized", 403);
  if (attempt.completedAt) throw new AppError("Attempt already submitted", 400);

  const questionMap = new Map(attempt.quiz.questions.map((q) => [q.id, q]));
  let score = 0;

  const answerRecords = answers.map((ans) => {
    const question = questionMap.get(ans.questionId);
    if (!question) throw new AppError(`Question ${ans.questionId} not found`, 400);

    let isCorrect = false;
    const options = question.options as Array<{ text: string; isCorrect: boolean }> | null;

    if (question.type === "MCQ" || question.type === "TRUE_FALSE") {
      if (options) {
        const correctIndex = options.findIndex((opt) => opt.isCorrect);
        isCorrect = ans.selectedOption === correctIndex;
      }
    } else if (question.type === "FILL_BLANK") {
      isCorrect =
        !!question.correctAnswer &&
        ans.textAnswer?.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
    }

    const points = isCorrect ? question.points : 0;
    score += points;

    return {
      attemptId,
      questionId: ans.questionId,
      selectedOption: ans.selectedOption ?? null,
      textAnswer: ans.textAnswer ?? null,
      isCorrect,
      points,
    };
  });

  const timeTaken = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
  const percentage = attempt.totalPoints > 0 ? (score / attempt.totalPoints) * 100 : 0;

  const [, updatedAttempt] = await prisma.$transaction([
    prisma.answer.createMany({ data: answerRecords }),
    prisma.attempt.update({
      where: { id: attemptId },
      data: { score, percentage, timeTaken, completedAt: new Date() },
      include: {
        answers: { include: { question: true } },
      },
    }),
  ]);

  return updatedAttempt;
}

export async function getAttempt(attemptId: string, userId: string) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: { select: { id: true, title: true, teacherId: true } },
      answers: {
        include: {
          question: {
            select: { id: true, type: true, text: true, imageUrl: true, options: true, correctAnswer: true, points: true },
          },
        },
      },
      student: { select: { id: true, name: true } },
    },
  });

  if (!attempt) throw new AppError("Attempt not found", 404);
  if (attempt.studentId !== userId && attempt.quiz.teacherId !== userId) {
    throw new AppError("Not authorized", 403);
  }

  return attempt;
}

export async function getStudentHistory(studentId: string, quizId?: string) {
  const where: { studentId: string; quizId?: string; completedAt: { not: null } } = {
    studentId,
    completedAt: { not: null },
  };
  if (quizId) where.quizId = quizId;

  return prisma.attempt.findMany({
    where,
    include: {
      quiz: { select: { id: true, title: true, category: true } },
    },
    orderBy: { completedAt: "desc" },
  });
}
