import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/controllers/auth.controller.js", () => ({
  register: vi.fn((_req, res) => res.status(201).json({ ok: true })),
  login: vi.fn((_req, res) => res.json({ ok: true })),
  getMe: vi.fn((_req, res) => res.json({ ok: true })),
}));

vi.mock("../../src/middleware/auth.js", () => ({
  authenticate: vi.fn((_req, _res, next) => next()),
}));

const { default: authRoutes } = await import("../../src/routes/auth.routes.js");

describe("auth rate limiting", () => {
  it("returns 429 after exceeding login limit", async () => {
    const app = express();
    app.use(express.json());
    app.use("/auth", authRoutes);

    for (let i = 0; i < 10; i++) {
      const res = await request(app).post("/auth/login").send({ email: "a@test.com", password: "x" });
      expect(res.status).toBe(200);
    }

    const limited = await request(app).post("/auth/login").send({ email: "a@test.com", password: "x" });
    expect(limited.status).toBe(429);
  });
});
