import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { AppError } from "./errorHandler.js";

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(", ");
      return next(new AppError(message, 400));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(", ");
      return next(new AppError(message, 400));
    }
    req.query = result.data as Record<string, string>;
    next();
  };
}
