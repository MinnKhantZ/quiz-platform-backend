import { Router } from "express";
import { z } from "zod";
import * as attemptController from "../controllers/attempt.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const submitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      selectedOption: z.number().int().optional().nullable(),
      textAnswer: z.string().optional().nullable(),
    })
  ),
});

router.post("/quizzes/:quizId/start", authenticate, requireRole("STUDENT"), attemptController.start);
router.post("/attempts/:id/submit", authenticate, requireRole("STUDENT"), validate(submitSchema), attemptController.submit);
router.get("/attempts/:id", authenticate, attemptController.getById);
router.get("/me/attempts", authenticate, attemptController.history);

export default router;
