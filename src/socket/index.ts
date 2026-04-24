import { Server, Socket } from "socket.io";
import prisma from "../config/db.js";
import { Prisma } from "@prisma/client";
import { verifyToken, JwtPayload } from "../utils/jwt.js";
import { Question } from "@prisma/client";
import logger from "../utils/logger.js";

interface AuthenticatedSocket extends Socket {
  user: JwtPayload;
  sessionId?: string;
}

export function setupSocket(io: Server): void {
  // Authenticate socket connections
  io.use((socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: string }).token;
      if (!token) return next(new Error("Authentication required"));
      const decoded = verifyToken(token);
      (socket as AuthenticatedSocket).user = decoded;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    logger.info({ userId: socket.user.id }, "Socket connected");

    // Teacher creates a live session
    socket.on("create-session", async ({ quizId }: { quizId: string }, callback: (res: object) => void) => {
      try {
        const joinCode = generateJoinCode();
        const session = await prisma.liveSession.create({
          data: { quizId, teacherId: socket.user.id, joinCode },
          include: { quiz: { include: { questions: { orderBy: { order: "asc" } } } } },
        });
        socket.join(`session:${session.id}`);
        socket.sessionId = session.id;
        callback({ success: true, session: { id: session.id, joinCode, quiz: session.quiz } });
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    // Student joins a live session
    socket.on("join-session", async ({ joinCode }: { joinCode: string }, callback: (res: object) => void) => {
      try {
        const session = await prisma.liveSession.findUnique({
          where: { joinCode },
          include: { quiz: { select: { id: true, title: true } } },
        });
        if (!session) return callback({ success: false, error: "Session not found" });
        if (session.status === "FINISHED") return callback({ success: false, error: "Session has ended" });

        const user = await prisma.user.findUnique({
          where: { id: socket.user.id },
          select: { id: true, name: true },
        });

        socket.join(`session:${session.id}`);
        socket.sessionId = session.id;

        // Notify teacher
        socket.to(`session:${session.id}`).emit("student-joined", { student: user });

        callback({ success: true, session: { id: session.id, quiz: session.quiz, status: session.status } });
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    // Teacher starts the session
    socket.on("start-session", async (callback: (res: object) => void) => {
      try {
        const session = await prisma.liveSession.update({
          where: { id: socket.sessionId },
          data: { status: "IN_PROGRESS", currentQuestion: 0, startedAt: new Date() },
          include: { quiz: { include: { questions: { orderBy: { order: "asc" } } } } },
        });

        const question = session.quiz.questions[0];
        if (question) {
          io.to(`session:${session.id}`).emit("question", {
            index: 0,
            total: session.quiz.questions.length,
            question: sanitizeQuestion(question),
          });
        }

        callback({ success: true });
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    // Teacher advances to next question
    socket.on("next-question", async (callback: (res: object) => void) => {
      try {
        const session = await prisma.liveSession.findUnique({
          where: { id: socket.sessionId },
          include: { quiz: { include: { questions: { orderBy: { order: "asc" } } } } },
        });
        if (!session) return callback({ success: false, error: "Session not found" });

        const nextIndex = session.currentQuestion + 1;
        if (nextIndex >= session.quiz.questions.length) {
          // All questions done — finalize session and create attempts
          await prisma.liveSession.update({
            where: { id: session.id },
            data: { status: "FINISHED" },
          });

          const results = await createAttemptsForSession(session.id, session.quizId, session.quiz.questions, session.startedAt);

          // Notify students (teacher is excluded via socket.to)
          socket.to(`session:${session.id}`).emit("session-finished", { results });

          return callback({ success: true, finished: true, results });
        }

        await prisma.liveSession.update({
          where: { id: session.id },
          data: { currentQuestion: nextIndex },
        });

        const question = session.quiz.questions[nextIndex];
        io.to(`session:${session.id}`).emit("question", {
          index: nextIndex,
          total: session.quiz.questions.length,
          question: sanitizeQuestion(question),
        });

        callback({ success: true, finished: false });
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    // Student submits an answer in live session
    socket.on(
      "live-answer",
      async (
        { questionId, selectedOption, textAnswer }: { questionId: string; selectedOption?: number; textAnswer?: string },
        callback: (res: object) => void
      ) => {
        try {
          const session = await prisma.liveSession.findUnique({
            where: { id: socket.sessionId },
            include: { quiz: { include: { questions: true } } },
          });
          if (!session) return callback({ success: false, error: "Session not found" });

          const question = session.quiz.questions.find((q) => q.id === questionId);
          if (!question) return callback({ success: false, error: "Question not found" });

          const options = question.options as Array<{ text: string; isCorrect: boolean }> | null;

          let isCorrect = false;
          if (question.type === "MCQ" || question.type === "TRUE_FALSE") {
            if (options) {
              const correctIndex = options.findIndex((opt) => opt.isCorrect);
              isCorrect = selectedOption === correctIndex;
            }
          } else if (question.type === "FILL_BLANK") {
            isCorrect =
              !!question.correctAnswer &&
              question.correctAnswer.trim().toLowerCase() === textAnswer?.trim().toLowerCase();
          }

          // Notify teacher of the answer
          socket.to(`session:${session.id}`).emit("answer-received", {
            studentId: socket.user.id,
            questionId,
            selectedOption,
            isCorrect,
          });

          // Persist to LiveAnswer (upsert handles retries gracefully)
          await prisma.liveAnswer.upsert({
            where: {
              sessionId_studentId_questionId: {
                sessionId: socket.sessionId!,
                studentId: socket.user.id,
                questionId,
              },
            },
            update: {
              selectedOption: typeof selectedOption === "number" ? selectedOption : null,
              textAnswer: textAnswer ?? null,
              isCorrect,
            },
            create: {
              sessionId: socket.sessionId!,
              studentId: socket.user.id,
              questionId,
              selectedOption: typeof selectedOption === "number" ? selectedOption : null,
              textAnswer: textAnswer ?? null,
              isCorrect,
            },
          });

          callback({ success: true, isCorrect });
        } catch (err) {
          callback({ success: false, error: (err as Error).message });
        }
      }
    );

    // Teacher toggles result/leaderboard visibility for students
    socket.on(
      "set-session-state",
      ({ showResults, showLeaderboard }: { showResults: boolean; showLeaderboard: boolean }, callback: (res: object) => void) => {
        try {
          socket.to(`session:${socket.sessionId}`).emit("session-state", { showResults, showLeaderboard });
          callback({ success: true });
        } catch (err) {
          callback({ success: false, error: (err as Error).message });
        }
      }
    );

    // Teacher ends session (terminate)
    socket.on("end-session", async (callback: (res: object) => void) => {
      try {
        if (socket.sessionId) {
          await prisma.liveSession.update({
            where: { id: socket.sessionId },
            data: { status: "FINISHED" },
          });
          io.to(`session:${socket.sessionId}`).emit("session-terminated");
        }
        callback({ success: true });
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    socket.on("disconnect", () => {
      logger.info({ userId: socket.user.id }, "Socket disconnected");
    });
  });
}

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function sanitizeQuestion(question: Question) {
  const options = question.options as Array<{ text: string; isCorrect: boolean }> | null;
  return {
    id: question.id,
    type: question.type,
    text: question.text,
    imageUrl: question.imageUrl,
    options: options?.map((o) => ({ text: o.text })),
    points: question.points,
  };
}

interface LiveResult {
  studentId: string;
  studentName: string;
  score: number;
  totalPoints: number;
  percentage: number;
  attemptId: string;
}

async function createAttemptsForSession(
  sessionId: string,
  quizId: string,
  questions: Question[],
  sessionStartedAt: Date | null = null
): Promise<LiveResult[]> {
  const liveAnswers = await prisma.liveAnswer.findMany({
    where: { sessionId },
  });

  // Group answers by student
  const answersByStudent = new Map<string, typeof liveAnswers>();
  for (const ans of liveAnswers) {
    if (!answersByStudent.has(ans.studentId)) answersByStudent.set(ans.studentId, []);
    answersByStudent.get(ans.studentId)!.push(ans);
  }

  if (answersByStudent.size === 0) return [];

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  const results = await Promise.all(
    Array.from(answersByStudent.entries()).map(async ([studentId, studentAnswers]) => {
      let score = 0;
      const answerData = questions.map((q) => {
        const ans = studentAnswers.find((a) => a.questionId === q.id);
        const isCorrect = ans?.isCorrect ?? false;
        const points = isCorrect ? q.points : 0;
        score += points;
        return {
          questionId: q.id,
          selectedOption: ans?.selectedOption != null ? ans.selectedOption : Prisma.DbNull,
          textAnswer: ans?.textAnswer ?? null,
          isCorrect,
          points,
        };
      });

      const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0;

      const completedAt = new Date();
      const timeTaken = sessionStartedAt
        ? Math.floor((completedAt.getTime() - sessionStartedAt.getTime()) / 1000)
        : 0;

      const attempt = await prisma.attempt.create({
        data: {
          quizId,
          studentId,
          score,
          totalPoints,
          percentage,
          timeTaken,
          completedAt,
          isLive: true,
          liveSessionId: sessionId,
          answers: { create: answerData },
        },
        include: { student: { select: { id: true, name: true } } },
      });

      return {
        studentId,
        studentName: attempt.student.name,
        score,
        totalPoints,
        percentage: Math.round(percentage * 100) / 100,
        attemptId: attempt.id,
      };
    })
  );

  results.sort((a, b) => b.score - a.score || a.studentName.localeCompare(b.studentName));
  return results;
}
