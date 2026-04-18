import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "./helpers/prismaMock.js";

vi.mock("../src/config/db.js", () => ({ default: prismaMock }));

const { createQuiz, getQuizzes, getQuizById, updateQuiz, deleteQuiz } =
  await import("../src/services/quiz.service.js");

const TEACHER_ID = "teacher-uuid";
const QUIZ_ID = "quiz-uuid";

const mockQuiz = {
  id: QUIZ_ID,
  title: "Math Quiz",
  description: "Chapter 1",
  teacherId: TEACHER_ID,
  isPublished: false,
  timerType: "NONE",
  questions: [],
};

describe("quiz.service", () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── createQuiz ──────────────────────────────────────────────────────────────

  describe("createQuiz", () => {
    it("creates a quiz belonging to the teacher", async () => {
      prismaMock.quiz.create.mockResolvedValue(mockQuiz);

      const result = await createQuiz(TEACHER_ID, { title: "Math Quiz" });

      expect(prismaMock.quiz.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ teacherId: TEACHER_ID }),
        })
      );
      expect(result.title).toBe("Math Quiz");
    });
  });

  // ─── getQuizzes ──────────────────────────────────────────────────────────────

  describe("getQuizzes", () => {
    it("returns all quizzes with no filter", async () => {
      prismaMock.quiz.findMany.mockResolvedValue([mockQuiz]);

      const result = await getQuizzes();
      expect(result).toHaveLength(1);
      expect(prismaMock.quiz.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
    });

    it("filters by teacherId", async () => {
      prismaMock.quiz.findMany.mockResolvedValue([mockQuiz]);

      await getQuizzes({ teacherId: TEACHER_ID });

      expect(prismaMock.quiz.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teacherId: TEACHER_ID } })
      );
    });

    it("filters published quizzes for students", async () => {
      prismaMock.quiz.findMany.mockResolvedValue([]);

      await getQuizzes({ published: true });

      expect(prismaMock.quiz.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublished: true } })
      );
    });
  });

  // ─── getQuizById ─────────────────────────────────────────────────────────────

  describe("getQuizById", () => {
    it("returns quiz when found", async () => {
      prismaMock.quiz.findUnique.mockResolvedValue(mockQuiz);

      const result = await getQuizById(QUIZ_ID);
      expect(result.id).toBe(QUIZ_ID);
    });

    it("throws 404 when quiz not found", async () => {
      prismaMock.quiz.findUnique.mockResolvedValue(null);

      await expect(getQuizById("missing")).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─── updateQuiz ──────────────────────────────────────────────────────────────

  describe("updateQuiz", () => {
    it("updates quiz when teacher owns it", async () => {
      prismaMock.quiz.findUnique.mockResolvedValue(mockQuiz);
      prismaMock.quiz.update.mockResolvedValue({ ...mockQuiz, title: "Updated" });

      const result = await updateQuiz(QUIZ_ID, TEACHER_ID, { title: "Updated" });
      expect(result.title).toBe("Updated");
    });

    it("throws 403 when teacher does not own quiz", async () => {
      prismaMock.quiz.findUnique.mockResolvedValue(mockQuiz);

      await expect(
        updateQuiz(QUIZ_ID, "other-teacher", { title: "X" })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("throws 404 when quiz not found", async () => {
      prismaMock.quiz.findUnique.mockResolvedValue(null);

      await expect(
        updateQuiz("bad-id", TEACHER_ID, {})
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─── deleteQuiz ──────────────────────────────────────────────────────────────

  describe("deleteQuiz", () => {
    it("deletes quiz when teacher owns it", async () => {
      prismaMock.quiz.findUnique.mockResolvedValue(mockQuiz);
      prismaMock.quiz.delete.mockResolvedValue(mockQuiz);

      await expect(deleteQuiz(QUIZ_ID, TEACHER_ID)).resolves.toBeDefined();
      expect(prismaMock.quiz.delete).toHaveBeenCalledWith({ where: { id: QUIZ_ID } });
    });

    it("throws 403 when teacher does not own quiz", async () => {
      prismaMock.quiz.findUnique.mockResolvedValue(mockQuiz);

      await expect(deleteQuiz(QUIZ_ID, "intruder")).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
