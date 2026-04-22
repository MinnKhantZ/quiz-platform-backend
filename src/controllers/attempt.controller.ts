import { Request, Response, NextFunction } from "express";
import * as attemptService from "../services/attempt.service.js";

export async function start(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await attemptService.startAttempt(req.params.quizId as string, req.user!.id);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function submit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await attemptService.submitAttempt(req.params.id as string, req.user!.id, req.body.answers);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const attempt = await attemptService.getAttempt(req.params.id as string, req.user!.id);
    res.json(attempt);
  } catch (err) {
    next(err);
  }
}

export async function history(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const attempts = await attemptService.getStudentHistory(
      req.user!.id,
      req.query.quizId as string | undefined,
      Number(req.query.page ?? 1),
      Number(req.query.limit ?? 20)
    );
    res.json(attempts);
  } catch (err) {
    next(err);
  }
}
