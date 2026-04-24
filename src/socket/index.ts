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

interface LiveAnswerEntry {
  studentId: string;
  questionId: string;
  selectedOption: number | null;
  isCorrect: boolean;
}

interface LiveResultInternal {
  studentId: string;
  studentName: string;
  score: number;
  totalPoints: number;
  percentage: number;
  attemptId: string;
}

interface SessionSnapshot {
  session: {
    id: string;
    quizId: string;
    teacherId: string;
    joinCode: string;
    status: string;
    currentQuestion: number;
    showResults: boolean;
    showLeaderboard: boolean;
    quiz?: { id: string; title: string };
  };
  currentQuestion: ReturnType<typeof sanitizeQuestion> | null;
  questionIndex: number;
  totalQuestions: number;
  participants: { studentId: string; name: string; online: boolean }[];
  answers: LiveAnswerEntry[];
  sessionFinished: boolean;
  sessionResults: LiveResultInternal[];
  teacherOnline: boolean;
}

// In-memory grace timers: sessionId -> timer handle
const teacherGraceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const TEACHER_GRACE_MS = 30_000;

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

    // ── Teacher creates a live session ─────────────────────────────────
    socket.on("create-session", async ({ quizId }: { quizId: string }, callback: (res: object) => void) => {
      logger.info({ userId: socket.user.id, quizId }, "create-session received");
      try {
        // Prevent duplicate active sessions for this teacher
        const existing = await prisma.liveSession.findFirst({
          where: { teacherId: socket.user.id, status: { in: ["WAITING", "IN_PROGRESS"] } },
        });
        if (existing) {
          logger.info({ userId: socket.user.id, existingId: existing.id }, "create-session blocked: active session exists");
          return callback({ success: false, error: "active_session_exists", sessionId: existing.id });
        }

        const joinCode = generateJoinCode();
        const created = await prisma.liveSession.create({
          data: { quizId, teacherId: socket.user.id, joinCode },
        });

        socket.join(`session:${created.id}`);
        socket.sessionId = created.id;
        cancelGraceTimer(created.id);

        const snapshot = await buildSnapshot(created.id);
        callback({ success: true, snapshot });
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    // ── Student joins a live session ───────────────────────────────────
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
        if (!user) return callback({ success: false, error: "User not found" });

        // Upsert participant — idempotent on re-join
        await prisma.liveParticipant.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId: socket.user.id } },
          update: { online: true, leftAt: null },
          create: { sessionId: session.id, studentId: socket.user.id, name: user.name, online: true },
        });

        socket.join(`session:${session.id}`);
        socket.sessionId = session.id;

        // Notify teacher (everyone else in the room)
        socket.to(`session:${session.id}`).emit("participant-update", {
          studentId: user.id,
          name: user.name,
          online: true,
        });

        const snapshot = await buildSnapshot(session.id);
        callback({ success: true, snapshot });
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    // ── Resume an existing active session (teacher or student) ─────────
    socket.on("resume-session", async ({ sessionId }: { sessionId: string }, callback: (res: object) => void) => {
      try {
        const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
        if (!session) return callback({ success: false, error: "Session not found" });
        // Allow FINISHED sessions — they may still be in the result phase (teacher
        // hasn't called end-session yet). Presence updates are skipped for finished sessions.
        if (session.status !== "WAITING" && session.status !== "IN_PROGRESS" && session.status !== "FINISHED") {
          return callback({ success: false, error: "Session has ended" });
        }

        const isActive = session.status !== "FINISHED";

        if (socket.user.role === "TEACHER") {
          if (session.teacherId !== socket.user.id) {
            return callback({ success: false, error: "Unauthorized" });
          }
          if (isActive) {
            // Cancel grace timer — teacher is back
            cancelGraceTimer(session.id);
            socket.to(`session:${session.id}`).emit("teacher-status", { online: true });
          }
          socket.join(`session:${session.id}`);
          socket.sessionId = session.id;
        } else {
          // Student resume — always update presence so teacher roster stays accurate
          const user = await prisma.user.findUnique({
            where: { id: socket.user.id },
            select: { id: true, name: true },
          });
          if (!user) return callback({ success: false, error: "User not found" });

          await prisma.liveParticipant.upsert({
            where: { sessionId_studentId: { sessionId: session.id, studentId: socket.user.id } },
            update: { online: true, leftAt: null },
            create: { sessionId: session.id, studentId: socket.user.id, name: user.name, online: true },
          });

          socket.to(`session:${session.id}`).emit("participant-update", {
            studentId: user.id,
            name: user.name,
            online: true,
          });

          socket.join(`session:${session.id}`);
          socket.sessionId = session.id;
        }

        const snapshot = await buildSnapshot(session.id);
        callback({ success: true, snapshot });
      } catch (err) {
        callback({ success: false, error: (err as Error).message });
      }
    });

    // ── Explicit leave (page unload / navigate away) ───────────────────
    socket.on("leave-session", () => {
      handleLeave(socket, io).catch((err) =>
        logger.error({ err, userId: socket.user.id }, "Error in leave-session handler")
      );
    });

    // ── Teacher starts the session ─────────────────────────────────────
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

    // ── Teacher advances to next question ──────────────────────────────
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

          const results = await createAttemptsForSession(
            session.id,
            session.quizId,
            session.quiz.questions,
            session.startedAt
          );

          // Notify students (teacher excluded via socket.to)
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

    // ── Student submits an answer in live session ──────────────────────
    socket.on(
      "live-answer",
      async (
        {
          questionId,
          selectedOption,
          textAnswer,
        }: { questionId: string; selectedOption?: number; textAnswer?: string },
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

          socket.to(`session:${session.id}`).emit("answer-received", {
            studentId: socket.user.id,
            questionId,
            selectedOption,
            isCorrect,
          });

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

    // ── Teacher toggles result/leaderboard visibility ──────────────────
    socket.on(
      "set-session-state",
      async (
        { showResults, showLeaderboard }: { showResults: boolean; showLeaderboard: boolean },
        callback: (res: object) => void
      ) => {
        try {
          // Persist to DB so reconnecting students receive the correct state
          await prisma.liveSession.update({
            where: { id: socket.sessionId },
            data: { showResults, showLeaderboard },
          });
          socket.to(`session:${socket.sessionId}`).emit("session-state", { showResults, showLeaderboard });
          callback({ success: true });
        } catch (err) {
          callback({ success: false, error: (err as Error).message });
        }
      }
    );

    // ── Teacher ends session (explicit terminate) ──────────────────────
    socket.on("end-session", async (callback: (res: object) => void) => {
      try {
        if (socket.sessionId) {
          cancelGraceTimer(socket.sessionId);
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

    // ── Implicit disconnect ────────────────────────────────────────────
    socket.on("disconnect", () => {
      logger.info({ userId: socket.user.id }, "Socket disconnected");
      handleLeave(socket, io).catch((err) =>
        logger.error({ err, userId: socket.user.id }, "Error in disconnect handler")
      );
    });
  });
}

// ── Presence & lifecycle helpers ───────────────────────────────────────────

async function handleLeave(socket: AuthenticatedSocket, io: Server): Promise<void> {
  if (!socket.sessionId) return;

  if (socket.user.role === "TEACHER") {
    // Only start a new grace timer if one isn't already running
    if (!teacherGraceTimers.has(socket.sessionId)) {
      io.to(`session:${socket.sessionId}`).emit("teacher-status", { online: false });

      const sessionId = socket.sessionId;
      const timer = setTimeout(() => {
        teacherGraceTimers.delete(sessionId);
        terminateSessionByTimeout(sessionId, io).catch((err) =>
          logger.error({ err, sessionId }, "Error in teacher timeout termination")
        );
      }, TEACHER_GRACE_MS);
      teacherGraceTimers.set(socket.sessionId, timer);
    }
  } else {
    // Mark student offline and notify teacher
    try {
      const session = await prisma.liveSession.findUnique({ where: { id: socket.sessionId } });
      if (!session) return;

      const participant = await prisma.liveParticipant.findUnique({
        where: { sessionId_studentId: { sessionId: socket.sessionId, studentId: socket.user.id } },
      });
      if (!participant) return;

      await prisma.liveParticipant.update({
        where: { sessionId_studentId: { sessionId: socket.sessionId, studentId: socket.user.id } },
        data: { online: false, leftAt: new Date() },
      });

      socket.to(`session:${socket.sessionId}`).emit("participant-update", {
        studentId: socket.user.id,
        name: participant.name,
        online: false,
      });
    } catch (err) {
      logger.error({ err, userId: socket.user.id }, "Error updating participant on leave");
    }
  }
}

function cancelGraceTimer(sessionId: string): void {
  const timer = teacherGraceTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    teacherGraceTimers.delete(sessionId);
  }
}

async function terminateSessionByTimeout(sessionId: string, io: Server): Promise<void> {
  try {
    const session = await prisma.liveSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status === "FINISHED") return;

    await prisma.liveSession.update({ where: { id: sessionId }, data: { status: "FINISHED" } });
    io.to(`session:${sessionId}`).emit("session-terminated", { reason: "teacher-timeout" });
    logger.info({ sessionId }, "Session terminated due to teacher timeout");
  } catch (err) {
    logger.error({ err, sessionId }, "Failed to terminate session by timeout");
  }
}

async function buildSnapshot(sessionId: string): Promise<SessionSnapshot> {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      quiz: { include: { questions: { orderBy: { order: "asc" } } } },
      participants: { select: { studentId: true, name: true, online: true } },
    },
  });
  if (!session) throw new Error("Session not found");

  const questions = session.quiz.questions;
  const isInProgress = session.status === "IN_PROGRESS";
  const isFinished = session.status === "FINISHED";

  const currentQuestion =
    isInProgress && session.currentQuestion < questions.length
      ? sanitizeQuestion(questions[session.currentQuestion])
      : null;

  const currentAnswers: LiveAnswerEntry[] =
    isInProgress && questions[session.currentQuestion]
      ? (
          await prisma.liveAnswer.findMany({
            where: { sessionId, questionId: questions[session.currentQuestion].id },
          })
        ).map((a) => ({
          studentId: a.studentId,
          questionId: a.questionId,
          selectedOption: a.selectedOption,
          isCorrect: a.isCorrect,
        }))
      : [];

  let sessionResults: LiveResultInternal[] = [];
  if (isFinished) {
    const attempts = await prisma.attempt.findMany({
      where: { liveSessionId: sessionId, isLive: true },
      include: { student: { select: { id: true, name: true } } },
    });
    sessionResults = attempts
      .map((a) => ({
        studentId: a.studentId,
        studentName: a.student.name,
        score: a.score,
        totalPoints: a.totalPoints,
        percentage: Math.round(a.percentage * 100) / 100,
        attemptId: a.id,
      }))
      .sort((a, b) => b.score - a.score || a.studentName.localeCompare(b.studentName));
  }

  return {
    session: {
      id: session.id,
      quizId: session.quizId,
      teacherId: session.teacherId,
      joinCode: session.joinCode,
      status: session.status,
      currentQuestion: session.currentQuestion,
      showResults: session.showResults,
      showLeaderboard: session.showLeaderboard,
      quiz: { id: session.quiz.id, title: session.quiz.title },
    },
    currentQuestion,
    questionIndex: session.currentQuestion,
    totalQuestions: questions.length,
    participants: session.participants,
    answers: currentAnswers,
    sessionFinished: isFinished,
    sessionResults,
    teacherOnline: !teacherGraceTimers.has(sessionId),
  };
}

// ── Utility helpers ────────────────────────────────────────────────────────

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

async function createAttemptsForSession(
  sessionId: string,
  quizId: string,
  questions: Question[],
  sessionStartedAt: Date | null = null
): Promise<LiveResultInternal[]> {
  const liveAnswers = await prisma.liveAnswer.findMany({
    where: { sessionId },
  });

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
