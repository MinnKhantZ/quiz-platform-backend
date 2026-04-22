import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { authenticate, requireRole } from "../middleware/auth.js";
import env from "../config/env.js";
import { uploadRateLimiter } from "../middleware/rateLimit.js";

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

router.post("/", uploadRateLimiter, authenticate, requireRole("TEACHER"), upload.single("image"), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

export default router;
