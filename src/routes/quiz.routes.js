import { Router } from "express";
import { z } from "zod";
import * as quizController from "../controllers/quiz.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const createQuizSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  timerType: z.enum(["NONE", "PER_QUIZ", "PER_QUESTION"]).default("NONE"),
  timerSeconds: z.number().int().positive().optional(),
  isPublished: z.boolean().default(false),
});

const updateQuizSchema = createQuizSchema.partial();

router.get("/", authenticate, quizController.list);
router.post("/", authenticate, requireRole("TEACHER"), validate(createQuizSchema), quizController.create);
router.get("/:id", authenticate, quizController.getById);
router.put("/:id", authenticate, requireRole("TEACHER"), validate(updateQuizSchema), quizController.update);
router.delete("/:id", authenticate, requireRole("TEACHER"), quizController.remove);

export default router;
