import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "./helpers/prismaMock.js";

vi.mock("../src/config/db.js", () => ({ default: prismaMock }));

// Must import AFTER vi.mock so the mock is in place
const { register, login, getMe } = await import("../src/services/auth.service.js");

describe("auth.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("register", () => {
    it("creates a user and returns a JWT token", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: "uuid-1",
        email: "teacher@test.com",
        name: "Test Teacher",
        role: "TEACHER",
      });

      const result = await register({
        email: "teacher@test.com",
        password: "password123",
        name: "Test Teacher",
        role: "TEACHER",
      });

      expect(result.user.email).toBe("teacher@test.com");
      expect(result.user.role).toBe("TEACHER");
      expect(typeof result.token).toBe("string");
    });

    it("throws 409 when email is already registered", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "existing" });

      await expect(
        register({ email: "dup@test.com", password: "pass", name: "X", role: "STUDENT" })
      ).rejects.toMatchObject({ statusCode: 409, message: "Email already registered" });
    });
  });

  describe("login", () => {
    it("returns user and token with correct credentials", async () => {
      const { default: bcrypt } = await import("bcrypt");
      const hashed = await bcrypt.hash("password123", 10);

      prismaMock.user.findUnique.mockResolvedValue({
        id: "uuid-1",
        email: "student@test.com",
        name: "Student",
        role: "STUDENT",
        password: hashed,
      });

      const result = await login({ email: "student@test.com", password: "password123" });

      expect(result.user.email).toBe("student@test.com");
      expect(typeof result.token).toBe("string");
    });

    it("throws 401 when user does not exist", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        login({ email: "nobody@test.com", password: "pass" })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it("throws 401 when password is wrong", async () => {
      const { default: bcrypt } = await import("bcrypt");
      const hashed = await bcrypt.hash("correct", 10);

      prismaMock.user.findUnique.mockResolvedValue({
        id: "uuid-1",
        email: "user@test.com",
        password: hashed,
      });

      await expect(
        login({ email: "user@test.com", password: "wrong" })
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe("getMe", () => {
    it("returns user by id", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "uuid-1",
        email: "u@test.com",
        name: "U",
        role: "STUDENT",
        createdAt: new Date(),
      });

      const user = await getMe("uuid-1");
      expect(user.id).toBe("uuid-1");
    });

    it("throws 404 when user not found", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(getMe("bad-id")).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
