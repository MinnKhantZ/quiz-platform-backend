import { Router } from "express";
import { z } from "zod";
import * as authController from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { authRateLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter")
    .regex(/[a-z]/, "Password must include at least one lowercase letter")
    .regex(/[0-9]/, "Password must include at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must include at least one special character"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["STUDENT", "TEACHER"], { message: "Role must be STUDENT or TEACHER" }),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

router.post("/register", authRateLimiter, validate(registerSchema), authController.register);
router.post("/login", authRateLimiter, validate(loginSchema), authController.login);
router.get("/me", authenticate, authController.getMe);

export default router;
