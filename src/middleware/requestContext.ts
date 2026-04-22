import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incomingRequestId = req.header("x-request-id");
  req.requestId = incomingRequestId || randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}
