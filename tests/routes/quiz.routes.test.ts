import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listMock = vi.fn((req, res) => res.json({ query: req.query }));

vi.mock("../../src/controllers/quiz.controller.js", () => ({
  list: listMock,
  create: vi.fn((_req, res) => res.status(201).json({ ok: true })),
  getById: vi.fn((_req, res) => res.json({ ok: true })),
  update: vi.fn((_req, res) => res.json({ ok: true })),
  remove: vi.fn((_req, res) => res.json({ ok: true })),
}));

vi.mock("../../src/middleware/auth.js", () => ({
  authenticate: vi.fn((req, _res, next) => {
    req.user = { id: "user-1", email: "u@test.com", name: "User", role: "TEACHER" };
    next();
  }),
  requireRole: vi.fn(() => (_req, _res, next) => next()),
}));

const { default: quizRoutes } = await import("../../src/routes/quiz.routes.js");

describe("quiz.routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts valid pagination query params", async () => {
    const app = express();
    app.use(express.json());
    app.use("/quizzes", quizRoutes);

    const res = await request(app).get("/quizzes?page=2&limit=15");

    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledOnce();
    expect(res.body.query).toMatchObject({ page: 2, limit: 15 });
  });

  it("rejects invalid limit query param", async () => {
    const app = express();
    app.use(express.json());
    app.use("/quizzes", quizRoutes);

    const res = await request(app).get("/quizzes?limit=101");

    expect(res.status).toBe(400);
    expect(listMock).not.toHaveBeenCalled();
  });
});
