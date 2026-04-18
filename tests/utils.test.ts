import { describe, it, expect } from "vitest";
import { AppError } from "../src/middleware/errorHandler.js";
import { generateToken, verifyToken } from "../src/utils/jwt.js";

describe("AppError", () => {
  it("sets message and statusCode", () => {
    const err = new AppError("Not found", 404);
    expect(err.message).toBe("Not found");
    expect(err.statusCode).toBe(404);
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("jwt utils", () => {
  const payload = { id: "user-uuid", role: "TEACHER" };

  it("generateToken returns a non-empty string", () => {
    const token = generateToken(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("verifyToken decodes the original payload", () => {
    const token = generateToken(payload);
    const decoded = verifyToken(token);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.role).toBe(payload.role);
  });

  it("verifyToken throws on an invalid token", () => {
    expect(() => verifyToken("bad.token.here")).toThrow();
  });
});
