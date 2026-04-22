import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "./helpers/prismaMock.js";

vi.mock("../src/config/db.js", () => ({ default: prismaMock }));

const { getStudentHistory } = await import("../src/services/attempt.service.js");

describe("attempt.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStudentHistory", () => {
    it("applies pagination values", async () => {
      prismaMock.attempt.findMany.mockResolvedValue([]);

      await getStudentHistory("student-1", undefined, 2, 25);

      expect(prismaMock.attempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 25,
          skip: 25,
          where: expect.objectContaining({ studentId: "student-1" }),
        })
      );
    });

    it("clamps invalid pagination input to safe bounds", async () => {
      prismaMock.attempt.findMany.mockResolvedValue([]);

      await getStudentHistory("student-1", undefined, 0, 500);

      expect(prismaMock.attempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
          skip: 0,
        })
      );
    });
  });
});
