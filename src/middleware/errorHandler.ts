import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: Error & { statusCode?: number; isOperational?: boolean; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err.isOperational && err.statusCode) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err.code === "P2002") {
    res.status(409).json({ error: "A record with that value already exists." });
    return;
  }

  if (err.code === "P2025") {
    res.status(404).json({ error: "Record not found." });
    return;
  }

  console.error("Unexpected error:", err);
  res.status(500).json({ error: "Internal server error" });
}
