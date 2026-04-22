import { Server, Socket } from "socket.io";
import prisma from "../config/db.js";
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
          data: { status: "IN_PROGRESS", currentQuestion: 0 },
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
          await prisma.liveSession.update({
            where: { id: session.id },
            data: { status: "FINISHED" },
          });
          io.to(`session:${session.id}`).emit("session-ended");
          return callback({ success: true, finished: true });
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

          callback({ success: true, isCorrect });
        } catch (err) {
          callback({ success: false, error: (err as Error).message });
        }
      }
    );

    // Teacher ends session
    socket.on("end-session", async (callback: (res: object) => void) => {
      try {
        if (socket.sessionId) {
          await prisma.liveSession.update({
            where: { id: socket.sessionId },
            data: { status: "FINISHED" },
          });
          io.to(`session:${socket.sessionId}`).emit("session-ended");
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
