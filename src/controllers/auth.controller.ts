import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service.js";

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.register(req.body as Parameters<typeof authService.register>[0]);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body as Parameters<typeof authService.login>[0]);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getMe(req.user!.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
}
