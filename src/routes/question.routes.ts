import { Router } from "express";
import { z } from "zod";
import * as questionController from "../controllers/question.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const addQuestionSchema = z.object({
  type: z.enum(["MCQ", "TRUE_FALSE", "FILL_BLANK"]),
  text: z.string().min(1, "Question text is required"),
  imageUrl: z.union([z.string().url(), z.string().startsWith("/uploads/")]).optional().nullable(),
  options: z
    .array(z.object({ text: z.string(), isCorrect: z.boolean() }))
    .optional()
    .nullable(),
  correctAnswer: z.string().optional().nullable(),
  points: z.number().int().positive().default(1),
});

const updateQuestionSchema = addQuestionSchema.partial();

const reorderSchema = z.object({
  questionIds: z.array(z.string().uuid()),
});

router.post("/:quizId/questions", authenticate, requireRole("TEACHER"), validate(addQuestionSchema), questionController.add);
router.put("/questions/:id", authenticate, requireRole("TEACHER"), validate(updateQuestionSchema), questionController.update);
router.delete("/questions/:id", authenticate, requireRole("TEACHER"), questionController.remove);
router.patch("/:quizId/questions/reorder", authenticate, requireRole("TEACHER"), validate(reorderSchema), questionController.reorder);

export default router;
