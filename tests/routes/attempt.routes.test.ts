import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const historyMock = vi.fn((req, res) => res.json({ query: req.query }));

vi.mock("../../src/controllers/attempt.controller.js", () => ({
  start: vi.fn((_req, res) => res.status(201).json({ ok: true })),
  submit: vi.fn((_req, res) => res.json({ ok: true })),
  getById: vi.fn((_req, res) => res.json({ ok: true })),
  history: historyMock,
}));

vi.mock("../../src/middleware/auth.js", () => ({
  authenticate: vi.fn((req, _res, next) => {
    req.user = { id: "student-1", email: "s@test.com", name: "Student", role: "STUDENT" };
    next();
  }),
  requireRole: vi.fn(() => (_req, _res, next) => next()),
}));

const { default: attemptRoutes } = await import("../../src/routes/attempt.routes.js");

describe("attempt.routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts valid history pagination query params", async () => {
    const app = express();
    app.use(express.json());
    app.use("/", attemptRoutes);

    const res = await request(app).get("/me/attempts?page=3&limit=25");

    expect(res.status).toBe(200);
    expect(historyMock).toHaveBeenCalledOnce();
    expect(res.body.query).toMatchObject({ page: 3, limit: 25 });
  });

  it("rejects invalid quizId in history query", async () => {
    const app = express();
    app.use(express.json());
    app.use("/", attemptRoutes);

    const res = await request(app).get("/me/attempts?quizId=not-a-uuid");

    expect(res.status).toBe(400);
    expect(historyMock).not.toHaveBeenCalled();
  });
});
